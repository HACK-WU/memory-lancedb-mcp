/**
 * memory-lancedb-mcp — Main Entry Point
 *
 * createMemoryRuntime() is the core factory function.
 * It loads the plugin, registers it with FakeOpenClawApi, and returns
 * a runtime object ready to serve MCP requests or CLI commands.
 */

import { FakeOpenClawApi, type ToolCallContext, type ToolResult } from "./fake-api.js";
import { loadConfig, toPluginConfig, type MemConfig } from "./config.js";
import { extractInputSchema, type JsonSchema } from "./schema.js";
import { createJiti } from "jiti";

// ============================================================================
// Types
// ============================================================================

/** Tag markdown prefix format: 【标签:x,y】 text */
const TAG_PREFIX_RE = /^【标签:(.+?)】\s*/;

/**
 * Allowed characters in normalized tags:
 *   - ASCII letters / digits / `_` / `-` (\w covers a-zA-Z0-9_)
 *   - colon `:` and slash `/` (common in scoped tags like ns:foo)
 *   - dot `.` (e.g. semver-like tags)
 *   - CJK unified ideographs (\u4e00-\u9fff)
 *   - comma `,` (the tag separator itself)
 * Notably forbidden: 【 】 (would break the prefix grammar), whitespace,
 * control characters, emoji, and any other punctuation.
 */
const TAG_CHAR_WHITELIST = /^[\w\-:/.\u4e00-\u9fff,]+$/u;

/**
 * Normalize and validate a raw tags string.
 * - Trim outer whitespace
 * - Convert full-width comma to half-width
 * - Strip all internal whitespace
 * - Reject any character outside the whitelist (throws Error)
 * Returns empty string when input is empty / whitespace-only.
 */
export function normalizeTags(tags: string | undefined): string {
  if (!tags || !tags.trim()) return "";
  const normalized = tags.trim().replace(/，/g, ",").replace(/\s+/g, "");
  if (!TAG_CHAR_WHITELIST.test(normalized)) {
    throw new Error(
      `Invalid tag value: ${JSON.stringify(tags)}. ` +
      `Tags may only contain letters, digits, '_', '-', ':', '/', '.', CJK characters, ` +
      `and ',' as separator. Reserved characters '【' and '】' are not allowed.`
    );
  }
  return normalized;
}

/** Assemble tag string into a text prefix. Returns empty string if no tags. */
function assembleTags(tags: string | undefined): string {
  const normalized = normalizeTags(tags);
  if (!normalized) return "";
  return `【标签:${normalized}】 `;
}

/** Strip tag prefix from text, returning the clean content. */
function stripTags(text: string): string {
  return text.replace(TAG_PREFIX_RE, "");
}

/** MCP tools that support tags injection. */
const TAG_AWARE_TOOLS = new Set(["memory_store", "memory_recall", "memory_list"]);

/** Tag parameter schema fragment for tool injection. */
const TAGS_SCHEMA: Record<string, JsonSchema> = {
  tags: {
    type: "string",
    description: "自定义标签，逗号分隔（如 profile,project,tech）。存储时嵌入文本前缀，检索时作为过滤条件。",
  },
};

export interface MemoryRuntime {
  /** The fake API instance (for advanced usage) */
  api: FakeOpenClawApi;
  /** Loaded configuration */
  config: MemConfig;

  /** Call a tool by name */
  callTool(name: string, params: Record<string, unknown>, ctx?: ToolCallContext): Promise<ToolResult>;

  /** List all available tools with their JSON Schema definitions */
  listTools(): ToolInfo[];

  /** Emit a lifecycle event (e.g., gateway_start, agent_end) */
  emitEvent(event: string, payload?: unknown, ctx?: unknown): Promise<unknown[]>;

  /** Trigger a named hook (e.g., command:new) */
  triggerHook(name: string, payload?: unknown): Promise<void>;

  /** Get the CLI commander instance for CLI integration */
  getCliInstance(): unknown;
}

export interface ToolInfo {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

export interface RuntimeOptions {
  /** Path to config file (overrides MEM_CONFIG_PATH env) */
  configPath?: string;
  /** Direct config object (bypasses file loading) */
  config?: MemConfig;
  /** Suppress debug logs */
  quiet?: boolean;
  /** Project scope for memory isolation (e.g. "myapp", "backend-service").
   *  Sets agentId for all tool calls, creating an isolated agent:<id> scope.
   *  Different projects = different agent IDs = completely isolated memories. */
  scope?: string;
}

// ============================================================================
// Plugin Loading
// ============================================================================

/** Sanitize scope string to valid agent scope id */
function scopeToAgentScope(scope: string): string {
  return scope.replace(/[^a-zA-Z0-9:_-]/g, "_");
}

/**
 * Load the memory-lancedb-pro plugin from npm using jiti.
 * jiti compiles TypeScript on-the-fly, allowing us to use the npm-published
 * source files directly without needing a local build of the parent project.
 */
async function loadPlugin(): Promise<{ register: (api: unknown) => void }> {
  try {
    // Use jiti to load TS source directly from node_modules
    // Falls back to local dist/ if available (development mode)
    const jiti = createJiti(import.meta.url);
    let mod: Record<string, unknown>;
    try {
      mod = jiti("memory-lancedb-pro") as Record<string, unknown>;
    } catch {
      // Fallback: local dist for development
      // @ts-ignore - local dist has no type declarations
      mod = await import("../../dist/index.js") as Record<string, unknown>;
    }
    const plugin = (mod.default || mod) as { register: (api: unknown) => void };
    if (typeof plugin.register !== "function") {
      throw new Error("Plugin does not export a register() function");
    }
    return plugin;
  } catch (err) {
    throw new Error(
      `Failed to load memory-lancedb-pro plugin.\n` +
      `Install it: npm install memory-lancedb-pro@beta\n` +
      `Original error: ${err}`
    );
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a MemoryRuntime instance.
 *
 * This is the main entry point for the wrapper. It:
 * 1. Loads config from YAML (or uses provided config)
 * 2. If scope is set, overrides scopes.default for project isolation
 * 3. Creates a FakeOpenClawApi
 * 4. Calls plugin.register(fakeApi) — this initializes all core components
 * 5. Returns a runtime object with tool calling, event emission, etc.
 *
 * @example
 * ```typescript
 * const runtime = await createMemoryRuntime({ scope: "project:myapp" });
 * // All store/recall operations now scoped to project:myapp
 * const result = await runtime.callTool("memory_store", { text: "hello", importance: 0.8 });
 * ```
 */
export async function createMemoryRuntime(options: RuntimeOptions = {}): Promise<MemoryRuntime> {
  // 1. Load configuration
  const baseConfig = options.config || loadConfig(options.configPath);

  // 2. Apply scope override (project isolation via agent-based scoping)
  const config = options.scope
    ? {
        ...baseConfig,
        scopes: {
          ...(baseConfig.scopes || {}),
          definitions: {
            ...(baseConfig.scopes?.definitions || {}),
            [options.scope]: { description: `Project: ${options.scope}` },
          },
          agentAccess: {
            ...(baseConfig.scopes?.agentAccess || {}),
            [options.scope]: ["global", scopeToAgentScope(options.scope)],
          },
        },
      }
    : baseConfig;

  // 3. Create FakeOpenClawApi
  const pluginConfig = toPluginConfig(config);
  const api = new FakeOpenClawApi({
    pluginConfig,
    quiet: options.quiet ?? false,
  });

  // 4. Load and register the plugin
  const plugin = await loadPlugin();
  plugin.register(api);

  // 5. Emit gateway_start to trigger auto-compaction etc.
  await api.emitEvent("gateway_start", {}, {});

  // 6. Build and return the runtime
  const runtime: MemoryRuntime = {
    api,
    config,

    async callTool(name: string, params: Record<string, unknown>, ctx?: ToolCallContext): Promise<ToolResult> {
      // --- Tag preprocessing ---
      // effectiveName may differ from name when memory_list+tags is rewritten to memory_recall.
      let effectiveName = name;
      const normalized: Record<string, unknown> = { ...params };
      if (TAG_AWARE_TOOLS.has(effectiveName) && typeof normalized.tags === "string") {
        const tags = normalized.tags as string;
        const prefix = assembleTags(tags);
        delete normalized.tags;
        if (prefix) {
          if (effectiveName === "memory_store") {
            normalized.text = prefix + (normalized.text || "");
          } else if (effectiveName === "memory_recall") {
            normalized.query = prefix + (normalized.query || "");
          } else if (effectiveName === "memory_list") {
            // Rewrite list+tags to recall(query=prefix) so that tag filtering
            // actually takes effect (BM25 hits the embedded prefix).
            // Preserve scope/category/limit; drop offset (recall doesn't support it).
            effectiveName = "memory_recall";
            normalized.query = prefix;
            delete normalized.offset;
          }
        }
      }

      // --- Scope injection ---
      const effectiveCtx = options.scope
        ? { ...ctx, agentId: options.scope }
        : ctx;

      const result = await api.callTool(effectiveName, normalized, effectiveCtx);

      // --- Tag postprocessing: strip tag prefixes from result text ---
      // Use original `name` so that even rewritten memory_list calls have prefixes stripped.
      if (TAG_AWARE_TOOLS.has(name) && result.content) {
        for (const item of result.content) {
          if (typeof item.text === "string") {
            item.text = stripTags(item.text);
          }
        }
      }

      return result;
    },

    listTools(): ToolInfo[] {
      const defs = api.getAllToolDefinitions();
      return defs.map((def) => {
        const tool: ToolInfo = {
          name: def.name,
          description: def.description,
          inputSchema: extractInputSchema(def.parameters),
        };
        // Inject tags parameter into tag-aware tools
        if (TAG_AWARE_TOOLS.has(def.name) && tool.inputSchema?.properties) {
          tool.inputSchema = {
            ...tool.inputSchema,
            properties: { ...tool.inputSchema.properties, ...TAGS_SCHEMA },
          };
        }
        return tool;
      });
    },

    async emitEvent(event: string, payload?: unknown, ctx?: unknown): Promise<unknown[]> {
      return api.emitEvent(event, payload, ctx);
    },

    async triggerHook(name: string, payload?: unknown): Promise<void> {
      return api.triggerHook(name, payload);
    },

    getCliInstance(): unknown {
      return api.getCliInstance();
    },
  };

  return runtime;
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export { FakeOpenClawApi } from "./fake-api.js";
export { loadConfig, initConfig, getConfigPath, getDefaultConfigDir } from "./config.js";
export { typeboxToJsonSchema, extractInputSchema } from "./schema.js";
export {
  triggerAutoRecall,
  triggerAutoCapture,
  triggerSessionEnd,
  triggerMessageReceived,
} from "./lifecycle.js";
export type { MemConfig, ToolCallContext, ToolResult };
export type { RecallResult, Message, LifecycleContext } from "./lifecycle.js";

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
      // Inject agentId from scope for per-project isolation
      const effectiveCtx = options.scope
        ? { ...ctx, agentId: options.scope }
        : ctx;
      return api.callTool(name, params, effectiveCtx);
    },

    listTools(): ToolInfo[] {
      const defs = api.getAllToolDefinitions();
      return defs.map((def) => ({
        name: def.name,
        description: def.description,
        inputSchema: extractInputSchema(def.parameters),
      }));
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

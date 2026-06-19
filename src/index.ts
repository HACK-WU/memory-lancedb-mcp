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

/** Strip tag prefix from text, returning the clean content. */
function stripTags(text: string): string {
  return text.replace(TAG_PREFIX_RE, "");
}

/**
 * Check whether a recall result entry (array of lines) contains a tag prefix
 * that matches ALL of the requested tag tokens. Supports subset matching:
 * if the entry has tags ["scope测试", "global"] and the request is ["scope测试"],
 * it still matches because the entry contains the requested tag.
 */
function entryMatchesTags(entryLines: string[], requestedTokens: string[]): boolean {
  const TAG_RE = /【标签:([^】]+)】/;
  for (const line of entryLines) {
    const m = line.match(TAG_RE);
    if (!m) continue;
    const entryTokens = m[1].split(",").map((t) => t.trim());
    // All requested tokens must be present in the entry's tags.
    return requestedTokens.every((rt) => entryTokens.includes(rt));
  }
  return false;
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
 * Build a server name annotated with the active scope (if any).
 * Helps distinguish multiple MCP server instances in client UIs when
 * different projects share the same machine.
 */
export function buildServerName(baseName: string, scope?: string): string {
  return scope ? `${baseName} (scope: ${scope})` : baseName;
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
      // --- Synthetic tool: list_scopes ---
      // Returns a clean, structured list of scopes by merging:
      //   1. Configured scope definitions (config.scopes.definitions) — includes empty scopes
      //   2. Scopes that actually have memories stored (from memory_stats.scopeCounts)
      // This guarantees the caller sees both registered-but-empty and ad-hoc scopes.
      if (name === "list_scopes") {
        try {
          // "system" is a reserved bypass agentId in the scope manager — it skips all
          // scope ACLs so memory_stats returns cross-scope counts (see plugin's src/scopes.ts).
          const statsResult = await api.callTool("memory_stats", {}, { agentId: "system" });

          // Best-effort parse of stats.details.stats.scopeCounts (the structured payload).
          const statsObj = (statsResult.details?.stats as
            | { scopeCounts?: Record<string, number> }
            | undefined) ?? {};
          const scopeCounts: Record<string, number> = statsObj.scopeCounts ?? {};

          const definitions = config.scopes?.definitions ?? {};

          // Merge: definitions first (preserves description), then any extras from scopeCounts.
          const scopes: Array<{ name: string; description?: string; count: number }> = [];
          const seen = new Set<string>();
          for (const [scopeName, def] of Object.entries(definitions)) {
            scopes.push({
              name: scopeName,
              description: def?.description,
              count: scopeCounts[scopeName] ?? 0,
            });
            seen.add(scopeName);
          }
          for (const [scopeName, count] of Object.entries(scopeCounts)) {
            if (!seen.has(scopeName)) {
              scopes.push({ name: scopeName, count });
            }
          }
          // Sort: defined scopes first (preserve config order), undefined ones alphabetically at end.
          // Already in that order by construction.

          const defaultScope = config.scopes?.default ?? "global";
          const lines = [
            `Available scopes (${scopes.length}):`,
            ...scopes.map((s) => {
              const isDefault = s.name === defaultScope ? " [default]" : "";
              const desc = s.description ? ` — ${s.description}` : "";
              return `  • ${s.name}${isDefault} (${s.count} memories)${desc}`;
            }),
            ``,
            `Use the 'scope' parameter on memory_recall / memory_list / memory_stats to query a specific scope.`,
          ];

          return {
            content: [{ type: "text", text: lines.join("\n") }],
            details: { scopes, defaultScope },
          };
        } catch (err) {
          return {
            content: [{
              type: "text",
              text: `Error listing scopes: ${err instanceof Error ? err.message : String(err)}`,
            }],
          };
        }
      }

      // --- Tag preprocessing ---
      // For memory_store: embed the 【标签:...】 prefix into text (unchanged).
      // For memory_list + tags: paginate through all pages, filter by tag prefix,
      //   and return matching entries.  This avoids relying on vector search which
      //   has cold-start / reranker reliability issues for short tag queries.
      // For memory_recall + tags: prepend plain tag text to the query so that
      //   BM25 can match the embedded tag prefix.
      let effectiveName = name;
      const normalized: Record<string, unknown> = { ...params };
      // Track whether we need tag post-filtering (set when tags param is present).
      let tagFilterRequested = "";
      // For memory_list + tags, handle via paginated scan (bypass normal flow).
      let listTagScan = false;
      // Original limit before tag-boost (used to truncate post-filter results).
      let tagRecallOrigLimit = 0;
      if (TAG_AWARE_TOOLS.has(effectiveName) && typeof normalized.tags === "string") {
        const tags = normalized.tags as string;
        const normalizedTagStr = normalizeTags(tags);
        delete normalized.tags;
        if (normalizedTagStr) {
          tagFilterRequested = normalizedTagStr;
          if (effectiveName === "memory_store") {
            // Store: embed full bracket prefix into text for BM25 indexing.
            normalized.text = `【标签:${normalizedTagStr}】 ` + (normalized.text || "");
            tagFilterRequested = ""; // no filtering needed for store
          } else if (effectiveName === "memory_recall") {
            // Recall: prepend plain tag text so BM25 can match.
            const existingQuery = (normalized.query as string) || "";
            normalized.query = normalizedTagStr + (existingQuery ? " " + existingQuery : "");
            // Boost recall limit so the tag post-filter has enough candidates.
            // Tagged entries may be ranked lower by semantic search, so we
            // need a larger pool to find them after hard-filtering.
            const TAG_RECALL_BOOST = 10;
            const origLimit = typeof normalized.limit === "number" ? normalized.limit as number
              : parseInt(String(normalized.limit), 10) || 5;
            tagRecallOrigLimit = origLimit;
            normalized.limit = origLimit * TAG_RECALL_BOOST;
          } else if (effectiveName === "memory_list") {
            // Use paginated scan to find all tagged entries.
            listTagScan = true;
          }
        }
      }

      // --- Scope injection ---
      // When a server-level scope is active (--scope X), force ALL operations into that scope:
      //   - Override normalized.scope to X regardless of what the caller passed.
      //   - Use agentId="system" (bypass) so isAccessible() returns true for scope X.
      //     Using agentId=X would fail because X's ACL only contains ["global", "agent:X"],
      //     not "X" itself.
      //
      // When no scope is set (cross-scope mode, agentId="system"):
      //   - memory_store without explicit scope → auto-inject default scope (e.g. "global")
      //     so the write doesn't land in "agent:system" (the bypass agentId's private scope).
      //   - memory_store/update/forget WITH explicit scope → keep agentId="system" because
      //     isSystemBypassId("system")=true makes isAccessible() return true for any valid scope.
      let effectiveCtx: ToolCallContext;
      const baseCtx: ToolCallContext = ctx ?? {};
      if (options.scope) {
        // Server-level scope is active (--scope X).
        // If the caller explicitly specifies a scope that differs from X, reject the request.
        const callerScope = typeof normalized.scope === "string" && normalized.scope.trim().length > 0
          ? normalized.scope.trim()
          : null;
        if (callerScope !== null && callerScope !== options.scope) {
          return {
            content: [{
              type: "text",
              text: `Scope mismatch: this server is locked to scope "${options.scope}", ` +
                `but the request targets scope "${callerScope}". ` +
                `Operations on other scopes are not allowed.`,
            }],
          };
        }
        normalized.scope = options.scope;
        // Use "system" bypass so ACL checks pass for the target scope
        effectiveCtx = { ...baseCtx, agentId: "system" };
      } else {
        const isWriteOp = name === "memory_store" || name === "memory_update" || name === "memory_forget";
        if (isWriteOp && name === "memory_store") {
          const hasExplicitScope = typeof normalized.scope === "string" && normalized.scope.trim().length > 0;
          if (!hasExplicitScope) {
            // No scope specified for store — inject default scope to avoid
            // writing into "agent:system" (the bypass agentId's private namespace).
            const defaultScope = config.scopes?.default ?? "global";
            normalized.scope = defaultScope;
          }
          // Keep agentId="system" so isSystemBypassId bypasses ACL on the target scope.
          effectiveCtx = baseCtx;
        } else {
          effectiveCtx = baseCtx;
        }
      }

      // --- Paginated tag scan for memory_list + tags ---
      // When memory_list is called with tags, we paginate through all entries
      // to find those matching the requested tag prefix.  This is necessary
      // because the plugin caps memory_list at 50 results per page, and tagged
      // entries may be beyond the first page.  Vector search (memory_recall) is
      // unreliable for short tag queries due to embedding cold-start / reranker
      // timeout issues.
      if (listTagScan) {
        const requestedTokens = tagFilterRequested.split(",").map((t) => t.trim()).filter(Boolean);
        const PAGE_SIZE = 50;
        const MAX_PAGES = 20; // safety cap: scan up to 1000 entries
        const matchedEntries: Array<{ id: string; text: string; category?: string; scope?: string; importance?: number }> = [];
        let offset = 0;
        let pagesScanned = 0;

        // Scan ALL pages to find tagged entries — do NOT truncate here.
        // Callers (CLI list, CLI search) apply their own offset/limit or
        // substring filtering on the full matched set.
        while (pagesScanned < MAX_PAGES) {
          const pageParams: Record<string, unknown> = { limit: PAGE_SIZE, offset };
          if (normalized.scope) pageParams.scope = normalized.scope;
          if (normalized.category) pageParams.category = normalized.category;
          const pageResult = await api.callTool("memory_list", pageParams, effectiveCtx);
          const pageMems = (pageResult.details?.memories as Array<Record<string, unknown>>) || [];
          if (pageMems.length === 0) break;

          for (const mem of pageMems) {
            const text = (mem.text as string) || "";
            const TAG_RE = /【标签:([^】]+)】/;
            const m = text.match(TAG_RE);
            if (m) {
              const entryTokens = m[1].split(",").map((t: string) => t.trim());
              if (requestedTokens.every((rt) => entryTokens.includes(rt))) {
                matchedEntries.push({
                  id: (mem.id as string) || "",
                  text,
                  category: mem.rawCategory as string || mem.category as string,
                  scope: mem.scope as string,
                  importance: mem.importance as number,
                });
              }
            }
          }

          pagesScanned++;
          offset += PAGE_SIZE;
          if (pageMems.length < PAGE_SIZE) break; // last page
        }

        // Warn when scan hit the safety cap — more tagged entries may exist beyond.
        if (pagesScanned >= MAX_PAGES) {
          console.warn(
            `[mem:warn] listTagScan: scanned ${MAX_PAGES * PAGE_SIZE} entries (MAX_PAGES=${MAX_PAGES}), ` +
            `results may be incomplete. Consider increasing MAX_PAGES for larger databases.`
          );
        }

        // Keep tag prefixes in text — format as "【标签:X】 content" so that
        // the tag is visible in CLI output.  The downstream stripTags regex
        // (non-anchored /g) strips tags from normal memory_list/recall results,
        // but this path returns early before that postprocessing step.
        const TAG_RE = /【标签:([^】]+)】/;
        for (const e of matchedEntries) {
          const m = e.text.match(TAG_RE);
          if (m) {
            const content = e.text.replace(TAG_RE, "").trim();
            e.text = `【标签:${m[1]}】 ${content}`;
          }
        }
        const count = matchedEntries.length;
        const header = count === 1 ? "Found 1 memory:" : `Found ${count} memories:`;
        const entryLines = matchedEntries.map((e, i) => {
          return `${i + 1}. [${e.id}] [${e.category || "other"}${e.scope ? ":" + e.scope : ""}] ${e.text}`;
        });
        const resultText = [header, "", ...entryLines].join("\n").trim();

        return {
          content: [{ type: "text", text: resultText }],
          details: {
            count,
            memories: matchedEntries,
          },
        } as ToolResult;
      }

      const result = await api.callTool(effectiveName, normalized, effectiveCtx);

      // --- Tag postprocessing ---
      if (TAG_AWARE_TOOLS.has(name) && result.content) {
        // Hard-filter: if caller specified tags, only keep result lines whose raw text
        // contains the tag prefix (before stripping). This compensates for the
        // soft-filter nature of BM25 weighting which can return non-matching memories.
        //
        // The plugin returns a single content item with all results as a formatted
        // text block (e.g. "Found N memories:\n\n1. [id] [cat] 【标签:...】 text\n2. ...").
        // We split by lines, keep only entries matching the tag prefix, and adjust the
        // header count accordingly.
        const requestedTags = typeof params.tags === "string" ? normalizeTags(params.tags as string) : "";
        if (requestedTags && name !== "memory_store") {
          // Extract individual tag tokens from the requested tags string.
          // "scope测试,global" → ["scope测试", "global"]
          const requestedTokens = requestedTags.split(",").map((t) => t.trim()).filter(Boolean);
          // Match both memory_recall ("Found N memories:") and memory_list
          // ("Recent memories (showing N):") header formats.
          const HEADER_RE = /^\s*(?:Found\s+\d+\s+memories?:|Recent\s+memories\s*\(showing\s+\d+\)\s*:)/i;
          for (const item of result.content) {
            if (typeof item.text !== "string") continue;
            const lines = item.text.split("\n");
            const headerIdx = lines.findIndex((l) => HEADER_RE.test(l));
            const kept: string[] = [];
            let currentEntry: string[] = [];
            let inEntry = false;
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              // Detect numbered entry start: "1. [uuid] ..."
              if (/^\s*\d+\.\s+\[/.test(line)) {
                // Flush previous entry
                if (inEntry && entryMatchesTags(currentEntry, requestedTokens)) {
                  kept.push(...currentEntry);
                }
                currentEntry = [line];
                inEntry = true;
              } else if (inEntry) {
                currentEntry.push(line);
              } else {
                // Header or blank lines before entries — skip them all
                // (we will rebuild the header below).
                continue;
              }
            }
            // Flush last entry
            if (inEntry && entryMatchesTags(currentEntry, requestedTokens)) {
              kept.push(...currentEntry);
            }
            // Truncate to original limit (before tag-boost) when recall was boosted.
            if (tagRecallOrigLimit > 0) {
              const truncated: string[] = [];
              let entries = 0;
              for (const line of kept) {
                if (/^\s*\d+\.\s+\[/.test(line)) {
                  if (entries >= tagRecallOrigLimit) break;
                  entries++;
                }
                truncated.push(line);
              }
              kept.length = 0;
              kept.push(...truncated);
            }
            // Rebuild header
            const entryCount = kept.filter((l) => /^\s*\d+\.\s+\[/.test(l)).length;
            const prefix = entryCount === 1 ? "Found 1 memory:" : `Found ${entryCount} memories:`;
            item.text = [prefix, "", ...kept.filter((l) => !HEADER_RE.test(l))]
              .join("\n")
              .replace(/\n{3,}/g, "\n\n")
              .trim();
          }
        }

        // Strip tag prefixes from result text.
        // Use original `name` so that even rewritten memory_list calls have prefixes stripped.
        // No ^ anchor — the plugin formats entries as numbered lines like
        // "1. [uuid] [cat] 【标签:x】 text" where the tag is mid-line, not at position 0.
        // The tag prefix format is controlled by our storage code, so this is safe.
        const STRIP_TAGS_RE = /【标签:[^】]+】\s*/g;
        for (const item of result.content) {
          if (typeof item.text === "string") {
            item.text = item.text.replace(STRIP_TAGS_RE, "");
          }
        }
      }

      return result;
    },

    listTools(): ToolInfo[] {
      const defs = api.getAllToolDefinitions();
      const tools = defs.map((def) => {
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
      // Synthetic tool: list_scopes — enumerates all available memory scopes.
      tools.push({
        name: "list_scopes",
        description: "列出所有可用的 memory scope 及其记忆数量。每个 scope 对应一个独立的记忆空间。仅在 MCP 启动时未指定 --scope 参数（跨 scope 模式）下推荐使用：此时可通过其他工具的 scope 参数查询或操作不同 scope 的记忆。若启动时已指定 --scope，则所有调用都会被锁定在该 scope 内，scope 参数将受 ACL 限制。",
        inputSchema: {
          type: "object",
          properties: {},
        },
      });
      return tools;
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

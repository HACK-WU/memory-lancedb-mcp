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
}

// ============================================================================
// Plugin Loading
// ============================================================================

/**
 * Dynamically import the memory-lancedb-pro plugin.
 * Uses relative path to the parent project's dist/ output.
 * The plugin exports a default object with { id, register(api) }.
 */
async function loadPlugin(): Promise<{ register: (api: unknown) => void }> {
  try {
    // Relative from mcp-wrapper/dist/ → parent dist/index.js
    // @ts-ignore - dynamic import of parent project compiled output
    const mod = await import("../../dist/index.js");
    const plugin = mod.default || mod;
    if (typeof plugin.register !== "function") {
      throw new Error("Plugin does not export a register() function");
    }
    return plugin;
  } catch (err) {
    throw new Error(
      `Failed to load memory-lancedb-pro plugin.\n` +
      `Make sure the parent project is built (npm run build in project root).\n` +
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
 * 2. Creates a FakeOpenClawApi
 * 3. Calls plugin.register(fakeApi) — this initializes all core components
 * 4. Returns a runtime object with tool calling, event emission, etc.
 *
 * @example
 * ```typescript
 * const runtime = await createMemoryRuntime({ configPath: "./config.yaml" });
 * const result = await runtime.callTool("memory_store", { text: "hello", importance: 0.8 });
 * ```
 */
export async function createMemoryRuntime(options: RuntimeOptions = {}): Promise<MemoryRuntime> {
  // 1. Load configuration
  const config = options.config || loadConfig(options.configPath);

  // 2. Create FakeOpenClawApi
  const pluginConfig = toPluginConfig(config);
  const api = new FakeOpenClawApi({
    pluginConfig,
    quiet: options.quiet ?? false,
  });

  // 3. Load and register the plugin
  const plugin = await loadPlugin();
  plugin.register(api);

  // 4. Emit gateway_start to trigger auto-compaction etc.
  await api.emitEvent("gateway_start", {}, {});

  // 5. Build and return the runtime
  const runtime: MemoryRuntime = {
    api,
    config,

    async callTool(name: string, params: Record<string, unknown>, ctx?: ToolCallContext): Promise<ToolResult> {
      return api.callTool(name, params, ctx);
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

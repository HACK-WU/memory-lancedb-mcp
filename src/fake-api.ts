/**
 * FakeOpenClawApi — Adapter that simulates the OpenClaw Plugin SDK runtime.
 *
 * This class implements the minimal OpenClawPluginApi interface expected by
 * memory-lancedb-pro's plugin.register() function. It captures:
 *   - Tool factories (14 tools) registered via api.registerTool()
 *   - Event handlers registered via api.on() and api.registerHook()
 *   - CLI commander instance via api.registerCli()
 *
 * The captured tools/hooks are then exposed to the MCP Server layer.
 */

import { homedir } from "node:os";
import { resolve, join } from "node:path";

// ============================================================================
// Types
// ============================================================================

export interface ToolDefinition {
  name: string;
  label?: string;
  description: string;
  parameters: unknown; // TypeBox schema
  execute: (callId: string, params: unknown) => Promise<ToolResult>;
}

export interface ToolResult {
  content: Array<{ type: string; text: string }>;
  details?: Record<string, unknown>;
}

export interface ToolCallContext {
  agentId?: string;
  sessionKey?: string;
}

type ToolFactory = (ctx: ToolCallContext) => ToolDefinition;

interface EventHandler {
  handler: Function;
  opts?: Record<string, unknown>;
}

export interface FakeApiOptions {
  pluginConfig: Record<string, unknown>;
  /** Override home directory for path resolution (useful for testing) */
  homeDir?: string;
  /** Suppress debug logs */
  quiet?: boolean;
}

// ============================================================================
// FakeOpenClawApi Implementation
// ============================================================================

export class FakeOpenClawApi {
  // --- Configuration ---
  public pluginConfig: Record<string, unknown>;

  // --- Logger ---
  public logger: {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };

  // --- Internal state ---
  private _toolFactories = new Map<string, ToolFactory>();
  private _eventHandlers = new Map<string, EventHandler[]>();
  private _hookHandlers = new Map<string, EventHandler[]>();
  private _cliInstance: unknown = null;
  private _homeDir: string;

  // --- Allow arbitrary properties (OpenClaw uses [key: string]: any) ---
  [key: string]: unknown;

  constructor(options: FakeApiOptions) {
    this.pluginConfig = options.pluginConfig;
    this._homeDir = options.homeDir || homedir();

    const quiet = options.quiet ?? false;
    this.logger = {
      debug: quiet ? () => {} : (...args: unknown[]) => console.debug("[mem:debug]", ...args),
      info: (...args: unknown[]) => console.info("[mem:info]", ...args),
      warn: (...args: unknown[]) => console.warn("[mem:warn]", ...args),
      error: (...args: unknown[]) => console.error("[mem:error]", ...args),
    };
  }

  // ========================================================================
  // Path Resolution
  // ========================================================================

  resolvePath(p: string): string {
    if (!p || typeof p !== "string") return p;
    const trimmed = p.trim();
    if (trimmed.startsWith("~/") || trimmed === "~") {
      return resolve(this._homeDir, trimmed.slice(2) || ".");
    }
    if (trimmed.startsWith("/")) return trimmed;
    // Windows absolute path check
    if (/^[a-zA-Z]:[/\\]/.test(trimmed)) return trimmed;
    // Relative → resolve from home
    return resolve(this._homeDir, trimmed);
  }

  // ========================================================================
  // Tool Registration (Core — 14 tools)
  // ========================================================================

  registerTool(factory: Function): void {
    try {
      // Preview-call the factory to extract tool name
      const preview = factory({});
      const name = preview?.name;
      if (typeof name === "string" && name.length > 0) {
        this._toolFactories.set(name, factory as ToolFactory);
        this.logger.debug(`Registered tool: ${name}`);
      } else {
        this.logger.warn("registerTool: factory returned no name");
      }
    } catch (err) {
      this.logger.warn(`registerTool: factory preview failed: ${err}`);
    }
  }

  // ========================================================================
  // Event System (api.on)
  // ========================================================================

  on(event: string, handler: Function, opts?: Record<string, unknown>): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, []);
    }
    this._eventHandlers.get(event)!.push({ handler, opts });
    this.logger.debug(`Registered event handler: ${event}`);
  }

  // ========================================================================
  // Hook System (api.registerHook)
  // ========================================================================

  registerHook(name: string, handler: Function, opts?: Record<string, unknown>): void {
    if (!this._hookHandlers.has(name)) {
      this._hookHandlers.set(name, []);
    }
    this._hookHandlers.get(name)!.push({ handler, opts });
    this.logger.debug(`Registered hook: ${name}`);
  }

  // ========================================================================
  // CLI Registration
  // ========================================================================

  registerCli(cmd: unknown): void {
    this._cliInstance = cmd;
    this.logger.debug("CLI commander registered");
  }

  // ========================================================================
  // Optional stubs (called by plugin but not critical)
  // ========================================================================

  registerMemoryRuntime(_obj: unknown): void {
    // No-op: not needed outside OpenClaw
  }

  registerMemoryCapability(_obj: unknown): void {
    // No-op
  }

  registerService(_obj: unknown): void {
    // No-op
  }

  // ========================================================================
  // Runtime property (used by loadEmbeddedPiRunner — not needed)
  // ========================================================================

  get runtime() {
    return undefined;
  }

  // ========================================================================
  // Config property (used for api.config.agents.list)
  // ========================================================================

  get config() {
    return { agents: { list: [] } };
  }

  // ========================================================================
  // Public API — for MCP Server / CLI to use
  // ========================================================================

  /** Get all registered tool names */
  getToolNames(): string[] {
    return Array.from(this._toolFactories.keys());
  }

  /** Get a specific tool factory */
  getToolFactory(name: string): ToolFactory | undefined {
    return this._toolFactories.get(name);
  }

  /** Get all tool factories */
  getAllToolFactories(): Map<string, ToolFactory> {
    return this._toolFactories;
  }

  /**
   * Call a tool by name with params and optional runtime context.
   * This is the main bridge used by MCP tools/call.
   */
  async callTool(
    name: string,
    params: Record<string, unknown>,
    ctx: ToolCallContext = {},
  ): Promise<ToolResult> {
    const factory = this._toolFactories.get(name);
    if (!factory) {
      throw new Error(`Unknown tool: ${name}. Available: ${this.getToolNames().join(", ")}`);
    }

    const toolCtx: ToolCallContext = {
      agentId: ctx.agentId ?? "main",
      sessionKey: ctx.sessionKey ?? `session-${Date.now()}`,
    };

    const def = factory(toolCtx);
    const callId = crypto.randomUUID();
    return def.execute(callId, params);
  }

  /**
   * Get tool definition (schema) for MCP tools/list.
   * Calls factory with empty context to extract name/description/parameters.
   */
  getToolDefinition(name: string): ToolDefinition | undefined {
    const factory = this._toolFactories.get(name);
    if (!factory) return undefined;
    try {
      return factory({});
    } catch {
      return undefined;
    }
  }

  /** Get all tool definitions for MCP tools/list */
  getAllToolDefinitions(): ToolDefinition[] {
    const defs: ToolDefinition[] = [];
    for (const [_name, factory] of this._toolFactories) {
      try {
        const def = factory({});
        if (def?.name) defs.push(def);
      } catch {
        // Skip broken factories
      }
    }
    return defs;
  }

  /**
   * Emit an event (simulate OpenClaw firing an event).
   * Returns results from handlers that return values.
   */
  async emitEvent(event: string, payload: unknown, ctx: unknown = {}): Promise<unknown[]> {
    const handlers = this._eventHandlers.get(event) || [];
    const results: unknown[] = [];
    // Sort by priority (lower = first)
    const sorted = [...handlers].sort((a, b) => {
      const pa = (a.opts?.priority as number) ?? 10;
      const pb = (b.opts?.priority as number) ?? 10;
      return pa - pb;
    });
    for (const { handler } of sorted) {
      try {
        const result = await handler(payload, ctx);
        if (result !== undefined) results.push(result);
      } catch (err) {
        this.logger.warn(`Event "${event}" handler error: ${err}`);
      }
    }
    return results;
  }

  /**
   * Trigger a named hook (simulate OpenClaw firing a hook).
   */
  async triggerHook(name: string, payload: unknown): Promise<void> {
    const handlers = this._hookHandlers.get(name) || [];
    for (const { handler } of handlers) {
      try {
        await handler(payload);
      } catch (err) {
        this.logger.warn(`Hook "${name}" handler error: ${err}`);
      }
    }
  }

  /** Get the registered CLI commander instance (for CLI reuse) */
  getCliInstance(): unknown {
    return this._cliInstance;
  }

  /** Get all registered event names */
  getRegisteredEvents(): string[] {
    return Array.from(this._eventHandlers.keys());
  }

  /** Get all registered hook names */
  getRegisteredHooks(): string[] {
    return Array.from(this._hookHandlers.keys());
  }
}

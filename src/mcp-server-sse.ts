/**
 * MCP Server — SSE (Server-Sent Events) transport
 *
 * Enables the memory MCP server to run as an HTTP service,
 * suitable for remote access or multi-client scenarios.
 *
 * Note: SSE transport requires the @modelcontextprotocol/sdk SSE support.
 * As of SDK v1.x, SSE is available via StreamableHTTPServerTransport.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createMemoryRuntime, buildServerName, type MemoryRuntime, type RuntimeOptions } from "./index.js";
import {
  triggerAutoRecall,
  triggerAutoCapture,
  triggerMessageReceived,
  triggerSessionEnd,
  type Message,
} from "./lifecycle.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Buffer } from "node:buffer";
import {
  resolveAuthConfig,
  validateAuthPolicy,
  extractToken,
  timingSafeCompare,
  logAuthFailure,
} from "./sse-auth.js";

// ============================================================================
// Types
// ============================================================================

export interface SseServerOptions extends RuntimeOptions {
  /** HTTP port (default: 3100) */
  port?: number;
  /** Hostname to bind (default: 127.0.0.1) */
  host?: string;
  /** Server name */
  serverName?: string;
  /** Server version */
  serverVersion?: string;
  /** Bearer token for HTTP auth (CLI 优先，次为 MEM_MCP_AUTH_TOKEN 环境变量) */
  authToken?: string;
  /** 显式关闭鉴权（仅回环监听下允许） */
  noAuth?: boolean;
}

// ============================================================================
// Simple SSE Transport Implementation
// ============================================================================

/**
 * Start an MCP Server with a simple HTTP/SSE transport.
 *
 * The server exposes:
 *   GET  /sse       — SSE event stream (client connects here)
 *   POST /message   — Client sends JSON-RPC messages here
 *   GET  /health    — Health check endpoint
 *
 * This is a simplified implementation suitable for local/dev usage.
 * For production, consider using a reverse proxy with proper auth.
 */
export async function startSseServer(options: SseServerOptions = {}): Promise<void> {
  const port = options.port ?? 3100;
  const host = options.host ?? "127.0.0.1";
  const baseServerName = options.serverName ?? "memory-lancedb-mcp";
  const serverName = buildServerName(baseServerName, options.scope);
  const serverVersion = options.serverVersion ?? "0.1.0";

  // 0. 鉴权启动期策略校验（必须在 createMemoryRuntime 之前，避免差配置费资源）
  const authConfig = resolveAuthConfig({
    authToken: options.authToken,
    noAuth: options.noAuth,
  });
  const authPolicy = validateAuthPolicy({
    host,
    authConfig,
    noAuth: options.noAuth,
  });
  const authEnabled = authPolicy.enabled;
  const expectedToken = authPolicy.expectedToken;

  // 1. Initialize runtime
  const runtime = await createMemoryRuntime({
    ...options,
    quiet: options.quiet ?? false,
  });

  // 2. Build JSON-RPC handler map
  // When a server-level scope is active, agentId is set to the scope value so that
  // all tool calls are automatically isolated to that scope.
  // When no scope is set, agentId is set to "system" to enable cross-scope bypass
  // (the scope manager treats "system" agentId as full bypass).
  const defaultAgentId = options.scope ?? "system";
  const handlers = buildJsonRpcHandlers(runtime, serverName, serverVersion, defaultAgentId);

  // 3. Track SSE clients
  const clients = new Set<ServerResponse>();

  // 4. Create HTTP server
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS headers — 动态回显 Origin，避免与 Bearer 鉴权矛盾
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

    // Referrer-Policy — 阻止 Query token 通过 Referer 泄露到第三方
    res.setHeader("Referrer-Policy", "no-referrer");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${host}:${port}`);

    // 鉴权中间件：默认保护所有路径，仅豁免 /health GET 和 OPTIONS
    if (
      authEnabled &&
      expectedToken &&
      !(url.pathname === "/health" && req.method === "GET")
    ) {
      const provided = extractToken(req, url);
      if (!provided) {
        logAuthFailure(req, url.pathname, "missing_token");
        res.setHeader("WWW-Authenticate", 'Bearer realm="mcp"');
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      if (!timingSafeCompare(provided, expectedToken)) {
        logAuthFailure(req, url.pathname, "invalid_token");
        res.setHeader("WWW-Authenticate", 'Bearer realm="mcp"');
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      // 鉴权通过，继续走后续路由
    }

    // Health endpoint
    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        server: serverName,
        version: serverVersion,
        tools: runtime.listTools().length,
      }));
      return;
    }

    // SSE endpoint
    if (url.pathname === "/sse" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      });

      // MCP SSE spec: send event: endpoint with the message URL
      res.write("event: endpoint\ndata: /message\n\n");

      clients.add(res);
      req.on("close", () => {
        clients.delete(res);
      });
      res.on("error", () => {
        clients.delete(res);
      });
      return;
    }

    // Message endpoint (JSON-RPC)
    if (url.pathname === "/message" && req.method === "POST") {
      // Collect body as Buffer to avoid multi-byte UTF-8 split corruption
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      const body = Buffer.concat(chunks).toString("utf-8");

      try {
        const request = JSON.parse(body);
        const response = await handleJsonRpc(request, handlers);

        // MCP SSE spec: respond via SSE stream (202 Accepted), not HTTP body
        res.writeHead(202, { "Content-Type": "application/json" });
        res.end();

        // Send response only to the first connected SSE client
        // (In a single-client stdio-like session, there's typically one SSE client)
        if (response && clients.size > 0) {
          const sseData = `event: message\ndata: ${JSON.stringify(response)}\n\n`;
          for (const client of clients) {
            try {
              client.write(sseData);
            } catch {
              clients.delete(client);
            }
          }
        }
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error" },
          id: null,
        }));
      }
      return;
    }

    // 404 for unknown paths
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  httpServer.listen(port, host, () => {
    console.log(`[mem] MCP Server started (SSE mode)`);
    if (!options.scope) {
      console.warn(
        `[mem] WARNING: started without --scope; running in cross-scope mode ` +
        `(agentId="system"). All scopes — including other agents' private memories ` +
        `— are visible to any client that can reach this endpoint. ` +
        `Pass --scope <name> to restrict to a single project, and ensure the ` +
        `host (${host}) is not exposed to untrusted networks.`,
      );
    }
    console.log(`[mem] Listening: http://${host}:${port}`);
    console.log(`[mem] SSE endpoint: http://${host}:${port}/sse`);
    console.log(`[mem] Message endpoint: http://${host}:${port}/message`);
    console.log(`[mem] Health: http://${host}:${port}/health`);
    if (authEnabled) {
      console.log(`[mem] Auth: enabled (Bearer token, source=${authConfig.source})`);
      if (authPolicy.weakToken) {
        console.warn(
          `[mem] WARNING: auth token length < 16; 强度不足，建议使用 ≥16 位的随机字符串。`,
        );
      }
      console.warn(
        `[mem] WARNING: Query token (?token=xxx) 可通过浏览器历史、服务端日志泄露，` +
        `建议优先使用 Authorization 头传递 token。`,
      );
    } else {
      console.log(`[mem] Auth: disabled (loopback-only access)`);
    }
    console.log(`[mem] Tools: ${runtime.listTools().map(t => t.name).join(", ")}`);
  });

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[mem] Shutting down SSE server...");
    for (const client of clients) {
      client.end();
    }
    httpServer.close();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    for (const client of clients) {
      client.end();
    }
    httpServer.close();
    process.exit(0);
  });
}

// ============================================================================
// JSON-RPC Handler
// ============================================================================

interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

type HandlerFn = (params: Record<string, unknown>) => Promise<unknown>;

function buildJsonRpcHandlers(
  runtime: MemoryRuntime,
  serverName: string,
  serverVersion: string,
  defaultAgentId: string,
): Map<string, HandlerFn> {
  const handlers = new Map<string, HandlerFn>();

  // initialize
  handlers.set("initialize", async (_params) => ({
    protocolVersion: "2024-11-05",
    capabilities: { tools: {} },
    serverInfo: { name: serverName, version: serverVersion },
  }));

  // tools/list
  handlers.set("tools/list", async (_params) => {
    const tools = runtime.listTools();
    const lifecycleTools = getLifecycleToolDefs();
    return {
      tools: [
        ...tools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
        ...lifecycleTools,
      ],
    };
  });

  // tools/call
  handlers.set("tools/call", async (params) => {
    const name = params.name as string;
    const args = (params.arguments || {}) as Record<string, unknown>;

    // Handle lifecycle tools
    const lcResult = await handleLifecycleToolCall(name, args, runtime);
    if (lcResult !== null) return lcResult;

    // Regular tool call
    try {
      const result = await runtime.callTool(name, args, { agentId: defaultAgentId });
      if (result && Array.isArray(result.content)) {
        return {
          content: result.content.map(item => ({
            type: "text" as const,
            text: typeof item.text === "string" ? item.text : JSON.stringify(item.text),
          })),
        };
      }
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  });

  return handlers;
}

async function handleJsonRpc(
  request: JsonRpcRequest,
  handlers: Map<string, HandlerFn>,
): Promise<JsonRpcResponse> {
  const { id, method, params } = request;

  // Notifications (no id) — acknowledge silently
  if (id === undefined || id === null) {
    const handler = handlers.get(method);
    if (handler) {
      try { await handler(params || {}); } catch { /* ignore */ }
    }
    // JSON-RPC notifications don't get responses, but we return for SSE
    return { jsonrpc: "2.0", id: null, result: {} };
  }

  const handler = handlers.get(method);
  if (!handler) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    };
  }

  try {
    const result = await handler(params || {});
    return { jsonrpc: "2.0", id, result };
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

// ============================================================================
// Lifecycle Tool Definitions (shared with stdio mode)
// ============================================================================

function getLifecycleToolDefs() {
  return [
    {
      name: "_lifecycle_auto_recall",
      description: "Trigger automatic memory recall before processing a prompt.",
      inputSchema: {
        type: "object",
        required: ["prompt"],
        properties: {
          prompt: { type: "string", description: "User's prompt text" },
          agentId: { type: "string" },
          sessionKey: { type: "string" },
        },
      },
    },
    {
      name: "_lifecycle_auto_capture",
      description: "Trigger automatic memory extraction from conversation messages.",
      inputSchema: {
        type: "object",
        required: ["messages"],
        properties: {
          messages: { type: "array", items: { type: "object" } },
          agentId: { type: "string" },
          sessionKey: { type: "string" },
        },
      },
    },
    {
      name: "_lifecycle_session_end",
      description: "Signal session end for cleanup.",
      inputSchema: {
        type: "object",
        properties: {
          sessionKey: { type: "string" },
          agentId: { type: "string" },
        },
      },
    },
  ];
}

async function handleLifecycleToolCall(
  name: string,
  args: Record<string, unknown>,
  runtime: MemoryRuntime,
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean } | null> {
  switch (name) {
    case "_lifecycle_auto_recall": {
      const prompt = args.prompt as string;
      if (!prompt) return { content: [{ type: "text", text: "Error: prompt required" }], isError: true };
      await triggerMessageReceived(runtime.api, prompt, { agentId: args.agentId as string, sessionKey: args.sessionKey as string });
      const result = await triggerAutoRecall(runtime.api, prompt, { agentId: args.agentId as string, sessionKey: args.sessionKey as string });
      return { content: [{ type: "text", text: result.prependContext || "(no relevant memories)" }] };
    }
    case "_lifecycle_auto_capture": {
      const messages = args.messages as Message[];
      if (!messages || !Array.isArray(messages)) return { content: [{ type: "text", text: "Error: messages required" }], isError: true };
      await triggerAutoCapture(runtime.api, messages, { agentId: args.agentId as string, sessionKey: args.sessionKey as string });
      return { content: [{ type: "text", text: "Auto-capture triggered." }] };
    }
    case "_lifecycle_session_end": {
      await triggerSessionEnd(runtime.api, { agentId: args.agentId as string, sessionKey: args.sessionKey as string });
      return { content: [{ type: "text", text: "Session ended." }] };
    }
    default:
      return null;
  }
}

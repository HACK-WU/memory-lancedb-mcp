/**
 * MCP Server — stdio transport
 *
 * Bridges the memory-lancedb-pro tools to the Model Context Protocol.
 * Supports stdio transport (default) for use with Claude Desktop, Cursor, etc.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createMemoryRuntime, type MemoryRuntime, type RuntimeOptions } from "./index.js";
import { extractInputSchema } from "./schema.js";
import {
  triggerAutoRecall,
  triggerAutoCapture,
  triggerMessageReceived,
  triggerSessionEnd,
  type Message,
} from "./lifecycle.js";

// ============================================================================
// MCP Server
// ============================================================================

export interface McpServerOptions extends RuntimeOptions {
  /** Server name shown to clients */
  serverName?: string;
  /** Server version */
  serverVersion?: string;
}

/**
 * Create and start a MCP Server with stdio transport.
 *
 * This function:
 * 1. Initializes the MemoryRuntime (loads plugin, registers tools)
 * 2. Creates an MCP Server with all tools exposed
 * 3. Connects via stdio and starts listening
 */
export async function startMcpServer(options: McpServerOptions = {}): Promise<void> {
  const serverName = options.serverName ?? "memory-lancedb-mcp";
  const serverVersion = options.serverVersion ?? "0.1.0";

  // 1. Initialize runtime
  const runtime = await createMemoryRuntime({
    ...options,
    quiet: options.quiet ?? true, // Suppress debug to not pollute stdio
  });

  // 2. Create MCP Server
  const server = new Server(
    { name: serverName, version: serverVersion },
    { capabilities: { tools: {} } },
  );

  // 3. Handle tools/list
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = runtime.listTools();

    // Add lifecycle tools
    const lifecycleTools = getLifecycleToolDefinitions();

    return {
      tools: [
        ...tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema as Record<string, unknown>,
        })),
        ...lifecycleTools,
      ],
    };
  });

  // 4. Handle tools/call
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Handle lifecycle tools
    const lifecycleResult = await handleLifecycleTool(name, args || {}, runtime);
    if (lifecycleResult !== null) {
      return lifecycleResult;
    }

    try {
      const result = await runtime.callTool(
        name,
        (args || {}) as Record<string, unknown>,
        { agentId: "main" },
      );

      // Map to MCP response format
      // Tool results from memory-lancedb-pro already have { content: [{ type, text }] }
      if (result && Array.isArray(result.content)) {
        return {
          content: result.content.map((item) => ({
            type: (item.type === "text" ? "text" : (item.type as string) || "text") as "text" | "image" | "resource",
            text: typeof item.text === "string" ? item.text : JSON.stringify(item.text),
          })),
        };
      }

      // Fallback: serialize entire result as text
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  // 5. Connect transport and start
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (not stdout — that's for MCP protocol)
  console.error(`[mem] MCP Server started (stdio mode)`);
  console.error(`[mem] Tools available: ${runtime.listTools().map(t => t.name).join(", ")}`);
}

/**
 * Get the MemoryRuntime without starting the server.
 * Useful for CLI commands that need the runtime but not the MCP protocol.
 */
export async function createRuntimeOnly(options: RuntimeOptions = {}): Promise<MemoryRuntime> {
  return createMemoryRuntime(options);
}

// ============================================================================
// Lifecycle Tool Definitions
// ============================================================================

function getLifecycleToolDefinitions() {
  return [
    {
      name: "_lifecycle_auto_recall",
      description:
        "Trigger automatic memory recall before processing a prompt. " +
        "Returns relevant context from long-term memory to prepend to the conversation. " +
        "Call this before sending a user message to get contextual memories.",
      inputSchema: {
        type: "object",
        required: ["prompt"],
        properties: {
          prompt: {
            type: "string",
            description: "The user's prompt text to find relevant memories for",
          },
          agentId: {
            type: "string",
            description: "Agent identifier (default: 'main')",
          },
          sessionKey: {
            type: "string",
            description: "Session key for context tracking",
          },
        },
      },
    },
    {
      name: "_lifecycle_auto_capture",
      description:
        "Trigger automatic memory extraction from a conversation. " +
        "Analyzes the messages and stores important information as memories. " +
        "Call this after a conversation turn or session ends.",
      inputSchema: {
        type: "object",
        required: ["messages"],
        properties: {
          messages: {
            type: "array",
            description: "Array of conversation messages [{role, content}]",
            items: {
              type: "object",
              properties: {
                role: { type: "string", enum: ["user", "assistant", "system"] },
                content: { type: "string" },
              },
              required: ["role", "content"],
            },
          },
          agentId: {
            type: "string",
            description: "Agent identifier (default: 'main')",
          },
          sessionKey: {
            type: "string",
            description: "Session key for context tracking",
          },
        },
      },
    },
    {
      name: "_lifecycle_session_end",
      description:
        "Signal that a session has ended. Flushes pending state and triggers cleanup.",
      inputSchema: {
        type: "object",
        properties: {
          sessionKey: {
            type: "string",
            description: "Session key to end",
          },
          agentId: {
            type: "string",
            description: "Agent identifier (default: 'main')",
          },
        },
      },
    },
  ];
}

async function handleLifecycleTool(
  name: string,
  args: Record<string, unknown>,
  runtime: MemoryRuntime,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean } | null> {
  switch (name) {
    case "_lifecycle_auto_recall": {
      const prompt = args.prompt as string;
      if (!prompt) {
        return {
          content: [{ type: "text", text: "Error: 'prompt' parameter is required" }],
          isError: true,
        };
      }

      // First trigger message_received to cache the raw message
      await triggerMessageReceived(runtime.api, prompt, {
        agentId: args.agentId as string,
        sessionKey: args.sessionKey as string,
      });

      // Then trigger before_prompt_build
      const result = await triggerAutoRecall(runtime.api, prompt, {
        agentId: args.agentId as string,
        sessionKey: args.sessionKey as string,
      });

      if (result.prependContext) {
        return {
          content: [{ type: "text", text: result.prependContext }],
        };
      }
      return {
        content: [{ type: "text", text: "(no relevant memories found)" }],
      };
    }

    case "_lifecycle_auto_capture": {
      const messages = args.messages as Message[];
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return {
          content: [{ type: "text", text: "Error: 'messages' array is required and must be non-empty" }],
          isError: true,
        };
      }

      await triggerAutoCapture(runtime.api, messages, {
        agentId: args.agentId as string,
        sessionKey: args.sessionKey as string,
      });

      return {
        content: [{ type: "text", text: "Auto-capture triggered. Memories will be extracted in the background." }],
      };
    }

    case "_lifecycle_session_end": {
      await triggerSessionEnd(runtime.api, {
        agentId: args.agentId as string,
        sessionKey: args.sessionKey as string,
      });

      return {
        content: [{ type: "text", text: "Session ended. Pending state flushed." }],
      };
    }

    default:
      return null; // Not a lifecycle tool
  }
}

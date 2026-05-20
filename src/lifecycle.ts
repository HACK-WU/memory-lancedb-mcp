/**
 * Lifecycle Bridge — MCP-friendly wrappers for OpenClaw lifecycle events.
 *
 * In OpenClaw, events like `before_prompt_build` and `agent_end` are fired
 * automatically by the platform. In MCP mode, we expose these as callable
 * operations so clients can opt-in to auto-recall and auto-capture.
 *
 * Usage patterns:
 *   1. Before sending a prompt → triggerAutoRecall(prompt) → get context to prepend
 *   2. After agent finishes    → triggerAutoCapture(messages) → extract memories
 */

import type { FakeOpenClawApi } from "./fake-api.js";

// ============================================================================
// Types
// ============================================================================

export interface RecallResult {
  /** Context text to prepend before the prompt */
  prependContext: string | null;
  /** Whether the context is ephemeral (should not persist) */
  ephemeral?: boolean;
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: string; text: string }>;
}

export interface LifecycleContext {
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  channelId?: string;
}

// ============================================================================
// Auto-Recall (before_prompt_build)
// ============================================================================

/**
 * Trigger the before_prompt_build lifecycle event.
 * This performs auto-recall: searching memories relevant to the prompt
 * and returning context to prepend.
 *
 * @param api - The FakeOpenClawApi instance
 * @param prompt - The user's prompt text
 * @param ctx - Optional context (agentId, sessionKey)
 * @returns Object with prependContext (or null if no relevant memories)
 */
export async function triggerAutoRecall(
  api: FakeOpenClawApi,
  prompt: string,
  ctx: LifecycleContext = {},
): Promise<RecallResult> {
  const event = {
    prompt,
    content: prompt,
    sessionKey: ctx.sessionKey || `session-${Date.now()}`,
  };

  const eventCtx = {
    agentId: ctx.agentId || "main",
    sessionKey: ctx.sessionKey || event.sessionKey,
    sessionId: ctx.sessionId || "default",
    channelId: ctx.channelId,
  };

  const results = await api.emitEvent("before_prompt_build", event, eventCtx);

  // Collect all prependContext from handlers
  const contexts: string[] = [];
  for (const result of results) {
    if (result && typeof result === "object" && "prependContext" in (result as Record<string, unknown>)) {
      const ctx = (result as Record<string, unknown>).prependContext;
      if (typeof ctx === "string" && ctx.length > 0) {
        contexts.push(ctx);
      }
    }
  }

  if (contexts.length === 0) {
    return { prependContext: null };
  }

  return {
    prependContext: contexts.join("\n\n"),
    ephemeral: true,
  };
}

// ============================================================================
// Auto-Capture (agent_end)
// ============================================================================

/**
 * Trigger the agent_end lifecycle event.
 * This performs auto-capture: extracting memories from the conversation messages.
 *
 * Note: Auto-capture runs in the background (fire-and-forget pattern).
 * This function returns immediately after triggering the event.
 *
 * @param api - The FakeOpenClawApi instance
 * @param messages - The conversation messages array
 * @param ctx - Optional context (agentId, sessionKey)
 * @param success - Whether the agent execution was successful (default: true)
 */
export async function triggerAutoCapture(
  api: FakeOpenClawApi,
  messages: Message[],
  ctx: LifecycleContext = {},
  success = true,
): Promise<void> {
  const event = {
    success,
    messages,
    sessionKey: ctx.sessionKey || `session-${Date.now()}`,
  };

  const eventCtx = {
    agentId: ctx.agentId || "main",
    sessionKey: ctx.sessionKey || event.sessionKey,
    sessionId: ctx.sessionId || "default",
  };

  await api.emitEvent("agent_end", event, eventCtx);
}

// ============================================================================
// Session Events
// ============================================================================

/**
 * Trigger session_end event for cleanup.
 * Some handlers use this to flush pending state.
 */
export async function triggerSessionEnd(
  api: FakeOpenClawApi,
  ctx: LifecycleContext = {},
): Promise<void> {
  const event = {
    sessionKey: ctx.sessionKey,
  };

  const eventCtx = {
    agentId: ctx.agentId || "main",
    sessionKey: ctx.sessionKey || `session-${Date.now()}`,
    sessionId: ctx.sessionId || "default",
  };

  await api.emitEvent("session_end", event, eventCtx);
}

/**
 * Trigger message_received event.
 * Caches the raw user message for auto-recall's gating logic.
 */
export async function triggerMessageReceived(
  api: FakeOpenClawApi,
  content: string,
  ctx: LifecycleContext = {},
): Promise<void> {
  const event = {
    content,
    role: "user",
  };

  const eventCtx = {
    agentId: ctx.agentId || "main",
    sessionKey: ctx.sessionKey || `session-${Date.now()}`,
    sessionId: ctx.sessionId || "default",
    channelId: ctx.channelId,
  };

  await api.emitEvent("message_received", event, eventCtx);
}

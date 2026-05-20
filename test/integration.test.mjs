/**
 * Integration test — Verify the wrapper can load the plugin and expose tools.
 * Runs without a real embedding API key (tests registration, not actual embedding).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("memory-lancedb-mcp integration", async () => {
  let mod;

  it("should load the index module", async () => {
    mod = await import("../dist/index.js");
    assert.ok(mod.createMemoryRuntime, "createMemoryRuntime exported");
    assert.ok(mod.FakeOpenClawApi, "FakeOpenClawApi exported");
    assert.ok(mod.loadConfig, "loadConfig exported");
    assert.ok(mod.typeboxToJsonSchema, "typeboxToJsonSchema exported");
    assert.ok(mod.triggerAutoRecall, "triggerAutoRecall exported");
    assert.ok(mod.triggerAutoCapture, "triggerAutoCapture exported");
  });

  it("should create runtime with valid config", async () => {
    const runtime = await mod.createMemoryRuntime({
      config: {
        embedding: {
          apiKey: "test-api-key-for-testing",
          model: "text-embedding-3-small",
          dimensions: 1536,
        },
        enableManagementTools: true,
        autoCapture: true,
        autoRecall: true,
        sessionStrategy: "none",
      },
      quiet: true,
    });

    assert.ok(runtime, "runtime created");
    assert.ok(runtime.api, "api available");
    assert.ok(runtime.config, "config available");
  });

  it("should register 14 tools", async () => {
    const runtime = await mod.createMemoryRuntime({
      config: {
        embedding: {
          apiKey: "test-key",
          model: "text-embedding-3-small",
          dimensions: 1536,
        },
        enableManagementTools: true,
      },
      quiet: true,
    });

    const tools = runtime.listTools();
    assert.ok(tools.length >= 14, `Expected >= 14 tools, got ${tools.length}`);

    const names = tools.map((t) => t.name);
    assert.ok(names.includes("memory_recall"), "has memory_recall");
    assert.ok(names.includes("memory_store"), "has memory_store");
    assert.ok(names.includes("memory_forget"), "has memory_forget");
    assert.ok(names.includes("memory_update"), "has memory_update");
    assert.ok(names.includes("memory_stats"), "has memory_stats");
    assert.ok(names.includes("memory_list"), "has memory_list");
    assert.ok(names.includes("self_improvement_log"), "has self_improvement_log");
  });

  it("should produce valid JSON Schema for tools", async () => {
    const runtime = await mod.createMemoryRuntime({
      config: {
        embedding: {
          apiKey: "test-key",
          model: "text-embedding-3-small",
          dimensions: 1536,
        },
        enableManagementTools: true,
      },
      quiet: true,
    });

    const tools = runtime.listTools();
    for (const tool of tools) {
      assert.ok(tool.name, "tool has name");
      assert.ok(tool.description, `tool ${tool.name} has description`);
      assert.ok(tool.inputSchema, `tool ${tool.name} has inputSchema`);
      assert.equal(tool.inputSchema.type, "object", `tool ${tool.name} inputSchema is object type`);
    }

    // Check memory_recall has required "query" param
    const recall = tools.find((t) => t.name === "memory_recall");
    assert.ok(recall.inputSchema.properties.query, "memory_recall has query property");
    assert.ok(recall.inputSchema.required.includes("query"), "memory_recall requires query");
  });

  it("should register lifecycle events", async () => {
    const runtime = await mod.createMemoryRuntime({
      config: {
        embedding: {
          apiKey: "test-key",
          model: "text-embedding-3-small",
          dimensions: 1536,
        },
        autoRecall: true,
        autoCapture: true,
      },
      quiet: true,
    });

    const events = runtime.api.getRegisteredEvents();
    assert.ok(events.includes("before_prompt_build"), "has before_prompt_build");
    assert.ok(events.includes("agent_end"), "has agent_end");
    assert.ok(events.includes("message_received"), "has message_received");

    const hooks = runtime.api.getRegisteredHooks();
    assert.ok(hooks.includes("agent:bootstrap"), "has agent:bootstrap hook");
  });

  it("should handle FakeOpenClawApi path resolution", () => {
    const api = new mod.FakeOpenClawApi({
      pluginConfig: {},
      homeDir: "/home/testuser",
      quiet: true,
    });

    assert.equal(api.resolvePath("~/data"), "/home/testuser/data");
    assert.equal(api.resolvePath("/absolute/path"), "/absolute/path");
    assert.equal(api.resolvePath("relative"), "/home/testuser/relative");
  });
});

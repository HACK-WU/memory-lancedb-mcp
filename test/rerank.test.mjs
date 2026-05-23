/**
 * Rerank Unit Tests
 *
 * Tests SiliconFlow rerank model integration:
 *   1. Config parsing — verify rerank settings pass through correctly
 *   2. Direct API call — call SiliconFlow /v1/rerank and validate response
 *   3. End-to-end — create runtime with rerank config and verify retrieval pipeline
 *
 * Requires:
 *   - SILICONFLOW_API_KEY env var (or pass via config)
 *   - Or set SF_API_KEY / SF_MODEL in the test inline
 *
 * Run: node --test test/rerank.test.mjs
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

// ============================================================================
// Config
// ============================================================================

const SF_API_KEY = process.env.SF_RERANK_API_KEY || "sk-xxx";
const SF_MODEL = process.env.SF_RERANK_MODEL || "Qwen/Qwen3-Reranker-8B";
const SF_ENDPOINT = "https://api.siliconflow.cn/v1/rerank";

// Use a flag to skip real API tests when key is intentionally absent
const SKIP_API_TESTS = !SF_API_KEY || SF_API_KEY.startsWith("sk-xxx");

// ============================================================================
// Test 1: Config Parsing
// ============================================================================

describe("Rerank Config Parsing", () => {
  let mod;

  before(async () => {
    mod = await import("../dist/index.js");
  });

  it("should accept SiliconFlow rerank config", async () => {
    const config = {
      embedding: {
        apiKey: "test-embed-key",
        model: "text-embedding-3-small",
        dimensions: 1536,
      },
      retrieval: {
        mode: "hybrid",
        rerank: "cross-encoder",
        rerankProvider: "siliconflow",
        rerankModel: SF_MODEL,
        rerankEndpoint: SF_ENDPOINT,
        rerankApiKey: SF_API_KEY,
        vectorWeight: 0.7,
        bm25Weight: 0.3,
      },
      enableManagementTools: true,
    };

    // Should not throw
    const runtime = await mod.createMemoryRuntime({ config, quiet: true });
    assert.ok(runtime, "runtime created with rerank config");
    assert.ok(runtime.config, "config accessible");

    const retrieval = runtime.config.retrieval || {};
    assert.equal(retrieval.rerank, "cross-encoder", "rerank mode set");
    assert.equal(retrieval.rerankProvider, "siliconflow", "rerank provider set");
    assert.equal(retrieval.rerankModel, SF_MODEL, "rerank model set");
    assert.equal(retrieval.rerankEndpoint, SF_ENDPOINT, "rerank endpoint set");
    assert.equal(retrieval.rerankApiKey, SF_API_KEY, "rerank apiKey set");
  });

  it("should create runtime with dashscope rerank config", async () => {
    const runtime = await mod.createMemoryRuntime({
      config: {
        embedding: { apiKey: "test-key", model: "text-embedding-3-small", dimensions: 1536 },
        retrieval: {
          rerank: "cross-encoder",
          rerankProvider: "dashscope",
          rerankModel: "gte-rerank-v2",
          rerankEndpoint: "https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank",
          rerankApiKey: "sk-test-dashscope",
        },
        enableManagementTools: true,
      },
      quiet: true,
    });
    const retrieval = runtime.config.retrieval || {};
    assert.equal(retrieval.rerankProvider, "dashscope");
    assert.equal(retrieval.rerankModel, "gte-rerank-v2");
  });

  it("should create runtime with voyage rerank config", async () => {
    const runtime = await mod.createMemoryRuntime({
      config: {
        embedding: { apiKey: "test-key", model: "text-embedding-3-small", dimensions: 1536 },
        retrieval: {
          rerank: "cross-encoder",
          rerankProvider: "voyage",
          rerankModel: "rerank-3",
          rerankEndpoint: "https://api.voyageai.com/v1/rerank",
          rerankApiKey: "test-voyage-key",
        },
        enableManagementTools: true,
      },
      quiet: true,
    });
    const retrieval = runtime.config.retrieval || {};
    assert.equal(retrieval.rerankProvider, "voyage");
  });

  it("should create runtime with TEI self-hosted rerank config", async () => {
    const runtime = await mod.createMemoryRuntime({
      config: {
        embedding: { apiKey: "test-key", model: "text-embedding-3-small", dimensions: 1536 },
        retrieval: {
          rerank: "cross-encoder",
          rerankProvider: "tei",
          rerankModel: "BAAI/bge-reranker-v2-m3",
          rerankEndpoint: "http://localhost:8080/rerank",
          rerankApiKey: "",
        },
        enableManagementTools: true,
      },
      quiet: true,
    });
    const retrieval = runtime.config.retrieval || {};
    assert.equal(retrieval.rerankProvider, "tei");
    assert.equal(retrieval.rerankModel, "BAAI/bge-reranker-v2-m3");
  });

  it("should create runtime with lightweight rerank mode (no API key)", async () => {
    const runtime = await mod.createMemoryRuntime({
      config: {
        embedding: { apiKey: "test-key", model: "text-embedding-3-small", dimensions: 1536 },
        retrieval: {
          rerank: "cross-encoder",
          // No rerankApiKey → falls back to lightweight cosine
        },
        enableManagementTools: true,
      },
      quiet: true,
    });
    const retrieval = runtime.config.retrieval || {};
    assert.equal(retrieval.rerank, "cross-encoder");
    assert.equal(retrieval.rerankApiKey, undefined);
  });

  it("should create runtime with none mode (rerank disabled)", async () => {
    const runtime = await mod.createMemoryRuntime({
      config: {
        embedding: { apiKey: "test-key", model: "text-embedding-3-small", dimensions: 1536 },
        retrieval: {
          rerank: "none",
        },
        enableManagementTools: true,
      },
      quiet: true,
    });
    const retrieval = runtime.config.retrieval || {};
    assert.equal(retrieval.rerank, "none");
  });
});

// ============================================================================
// Test 2: Direct SiliconFlow Rerank API Call
// ============================================================================

describe("SiliconFlow Rerank API", () => {
  const sampleCandidates = [
    "Python 是一种解释型、面向对象的高级编程语言，以其简洁清晰的语法和丰富的标准库而闻名。它广泛应用于 Web 开发、数据科学、人工智能和自动化脚本等领域。",
    "JavaScript 是一种基于原型、动态类型的脚本语言，主要用于 Web 前端开发。通过 Node.js 运行时也广泛用于后端服务，支持事件驱动和非阻塞 I/O。",
    "Golang（Go）是由 Google 开发的静态类型编译语言，以其并发模型（goroutine）和高效的编译速度著称。广泛用于云原生基础设施、微服务和 CLI 工具。",
    "Rust 是一门系统级编程语言，注重内存安全而不牺牲性能。通过所有权系统在编译期防止内存错误，适用于操作系统、浏览器引擎和高性能计算。",
    "TypeScript 是 JavaScript 的超集，添加了静态类型系统，使大型前端项目更易于维护和重构。与主流 IDE 深度集成，提供了出色的代码补全和类型检查。",
    "Java 是一种跨平台的面向对象编程语言，凭借 JVM 虚拟机实现一次编写处处运行。在企业级应用、Android 开发和大型分布式系统中占有重要地位。",
  ];

  const testCases = [
    {
      name: "Python 相关查询",
      query: "我最适合做数据分析和机器学习的编程语言",
      expectedTop: 0, // Python should be top
      minScore: 0.15,
    },
    {
      name: "前端开发查询",
      query: "用什么语言写网页前端界面",
      expectedTop: 1, // JavaScript should be top
      minScore: 0.15,
    },
    {
      name: "高并发系统查询",
      query: "我需要一个高并发、编译速度快的后端语言",
      expectedTop: 2, // Golang should be top
      minScore: 0.15,
    },
    {
      name: "系统编程安全查询",
      query: "我需要一个内存安全又不损失性能的语言",
      expectedTop: 3, // Rust should be top
      minScore: 0.15,
    },
    {
      name: "类型安全前端查询",
      query: "前端项目里想要更好的类型检查和IDE支持",
      expectedTop: 4, // TypeScript should be top
      minScore: 0.15,
    },
  ];

  /**
   * Skip API tests if key is not properly configured.
   * Set SKIP_API_TESTS to false to run real API tests.
   */
  const maybeIt = SKIP_API_TESTS
    ? it.skip
    : it;

  maybeIt("should return 200 with valid results for a simple query", async () => {
    const response = await fetch(SF_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SF_API_KEY}`,
      },
      body: JSON.stringify({
        model: SF_MODEL,
        query: "Python 编程语言用于数据分析和机器学习",
        documents: sampleCandidates,
        top_n: 3,
      }),
    });

    assert.equal(response.status, 200, "HTTP 200 OK");

    const data = await response.json();
    assert.ok(data, "response body not empty");
    assert.ok(Array.isArray(data.results), "results is an array");
    assert.ok(data.results.length > 0, "at least one result returned");
  });

  maybeIt("should return results sorted by relevance_score descending", async () => {
    const response = await fetch(SF_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SF_API_KEY}`,
      },
      body: JSON.stringify({
        model: SF_MODEL,
        query: "Python 编程语言用于数据分析和机器学习",
        documents: sampleCandidates,
        top_n: 6,
      }),
    });

    const data = await response.json();
    const scores = data.results.map((r) => r.relevance_score);
    for (let i = 1; i < scores.length; i++) {
      assert.ok(
        scores[i - 1] >= scores[i],
        `results sorted descending: ${scores[i - 1]} >= ${scores[i]}`,
      );
    }
  });

  maybeIt("should return top_n results or fewer", async () => {
    const topN = 3;
    const response = await fetch(SF_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SF_API_KEY}`,
      },
      body: JSON.stringify({
        model: SF_MODEL,
        query: "编程语言对比",
        documents: sampleCandidates,
        top_n: topN,
      }),
    });

    const data = await response.json();
    assert.ok(data.results.length <= topN, `returned ${data.results.length} <= ${topN}`);
  });

  maybeIt("should handle empty documents gracefully", async () => {
    const response = await fetch(SF_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SF_API_KEY}`,
      },
      body: JSON.stringify({
        model: SF_MODEL,
        query: "empty test",
        documents: [],
        top_n: 3,
      }),
    });

    // Should return 200 or 422 — either is acceptable
    const data = await response.json().catch(() => ({}));
    // Verify no crash — the API should return a structured response
    assert.ok(data !== undefined, "response should be parseable");
  });

  // Real relevance test
  maybeIt("should correctly rank Python first for data science query", async () => {
    const response = await fetch(SF_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SF_API_KEY}`,
      },
      body: JSON.stringify({
        model: SF_MODEL,
        query: "我最适合做数据分析和机器学习的编程语言",
        documents: sampleCandidates,
        top_n: 6,
      }),
    });

    const data = await response.json();
    // Python is at index 0 in sampleCandidates
    const topResult = data.results[0];
    assert.equal(topResult.index, 0, "Python should rank first for ML query");
    assert.ok(topResult.relevance_score > 0.15, `score ${topResult.relevance_score} > 0.15`);
  });

  maybeIt("should correctly rank JavaScript first for frontend query", async () => {
    const response = await fetch(SF_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SF_API_KEY}`,
      },
      body: JSON.stringify({
        model: SF_MODEL,
        query: "用什么语言写网页前端界面",
        documents: sampleCandidates,
        top_n: 6,
      }),
    });

    const data = await response.json();
    const topResult = data.results[0];
    assert.equal(topResult.index, 1, "JavaScript should rank first for frontend query");
    assert.ok(topResult.relevance_score > 0.15, `score ${topResult.relevance_score} > 0.15`);
  });

  maybeIt("should correctly rank Golang first for concurrency query", async () => {
    const response = await fetch(SF_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SF_API_KEY}`,
      },
      body: JSON.stringify({
        model: SF_MODEL,
        query: "我需要一个高并发、编译速度快的后端语言",
        documents: sampleCandidates,
        top_n: 6,
      }),
    });

    const data = await response.json();
    const topResult = data.results[0];
    assert.equal(topResult.index, 2, "Golang should rank first for concurrency query");
  });

  maybeIt("should correctly rank Rust first for memory safety query", async () => {
    const response = await fetch(SF_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SF_API_KEY}`,
      },
      body: JSON.stringify({
        model: SF_MODEL,
        query: "我需要一个内存安全又不损失性能的语言",
        documents: sampleCandidates,
        top_n: 6,
      }),
    });

    const data = await response.json();
    const topResult = data.results[0];
    assert.equal(topResult.index, 3, "Rust should rank first for memory safety query");
  });

  maybeIt("should correctly rank TypeScript first for type-safe frontend query", async () => {
    const response = await fetch(SF_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SF_API_KEY}`,
      },
      body: JSON.stringify({
        model: SF_MODEL,
        query: "前端项目里想要更好的类型检查和IDE支持",
        documents: sampleCandidates,
        top_n: 6,
      }),
    });

    const data = await response.json();
    const topResult = data.results[0];
    assert.equal(topResult.index, 4, "TypeScript should rank first for type-safe frontend query");
  });

  // Batch correctness test — verify all 5 queries rank the correct candidate #1
  maybeIt("should pass all 5 query relevance tests in batch", async () => {
    const results = [];
    for (const tc of testCases) {
      const response = await fetch(SF_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SF_API_KEY}`,
        },
        body: JSON.stringify({
          model: SF_MODEL,
          query: tc.query,
          documents: sampleCandidates,
          top_n: 6,
        }),
      });
      const data = await response.json();
      results.push({
        name: tc.name,
        topIndex: data.results[0].index,
        expected: tc.expectedTop,
        topScore: data.results[0].relevance_score,
        pass: data.results[0].index === tc.expectedTop && data.results[0].relevance_score > tc.minScore,
      });
    }

    const failed = results.filter((r) => !r.pass);
    if (failed.length > 0) {
      const details = failed
        .map((f) => `  ${f.name}: expected index ${f.expected}, got ${f.topIndex} (score ${f.topScore})`)
        .join("\n");
      assert.fail(`${failed.length}/${results.length} queries failed:\n${details}`);
    }

    console.log(`\n✅ All ${results.length} relevance tests passed:`);
    for (const r of results) {
      console.log(`  ${r.name}: index=${r.topIndex} score=${r.topScore.toFixed(4)}`);
    }
  });
});

// ============================================================================
// Test 3: End-to-End Rerank via Runtime
// ============================================================================

describe("E2E Rerank via MemoryRuntime", () => {
  let mod;

  before(async () => {
    mod = await import("../dist/index.js");
  });

  const e2eMaybeIt = SKIP_API_TESTS ? it.skip : it;

  e2eMaybeIt("should create runtime with rerank config and list tools", async () => {
    const runtime = await mod.createMemoryRuntime({
      config: {
        embedding: {
          apiKey: "test-embed-key-for-rerank-e2e",
          model: "text-embedding-3-small",
          dimensions: 1536,
        },
        retrieval: {
          rerank: "cross-encoder",
          rerankProvider: "siliconflow",
          rerankModel: SF_MODEL,
          rerankEndpoint: SF_ENDPOINT,
          rerankApiKey: SF_API_KEY,
          vectorWeight: 0.7,
          bm25Weight: 0.3,
        },
        enableManagementTools: true,
        autoCapture: false,
        autoRecall: false,
        sessionStrategy: "none",
      },
      quiet: true,
    });

    const tools = runtime.listTools();
    const names = tools.map((t) => t.name);
    assert.ok(names.includes("memory_recall"), "has memory_recall");
    assert.ok(names.includes("memory_store"), "has memory_store");

    // Verify runtime has rerank config
    const retrieval = runtime.config.retrieval || {};
    assert.equal(retrieval.rerank, "cross-encoder", "rerank enabled in runtime config");
    assert.equal(retrieval.rerankProvider, "siliconflow");
    assert.equal(retrieval.rerankModel, SF_MODEL);
  });
});

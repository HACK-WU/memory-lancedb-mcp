/**
 * SSE Auth Middleware Integration Tests
 *
 * 使用 node:http 创建真实 HTTP server，注入与 mcp-server-sse.ts 相同的中间件逻辑，
 * 验证鉴权、CORS、Referrer-Policy 等端到端行为。
 * 不依赖 LanceDB runtime。
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import {
  extractToken,
  timingSafeCompare,
  logAuthFailure,
} from "../dist/sse-auth.js";

// ============================================================================
// Helpers
// ============================================================================

const VALID_TOKEN = "test-token-12345678"; // >= 16 chars

/** 构建与 mcp-server-sse.ts 一致的中间件逻辑 */
function buildHandler(authEnabled, expectedToken) {
  return async (req, res) => {
    // CORS — 动态回显
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Referrer-Policy", "no-referrer");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost:3100"}`);

    // 鉴权：默认保护所有路径，仅豁免 /health GET
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
    }

    // Route handling
    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (url.pathname === "/sse" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end("event: endpoint\ndata: /message\n\n");
      return;
    }

    if (url.pathname === "/message" && req.method === "POST") {
      res.writeHead(202, { "Content-Type": "application/json" });
      res.end();
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  };
}

/** 发起 HTTP 请求并返回响应 */
function fetchUrl(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: opts.method || "GET",
        headers: opts.headers || {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf-8"),
          });
        });
      },
    );
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// ============================================================================
// Tests
// ============================================================================

describe("SSE Auth Middleware 集成测试", () => {
  let server;
  let port;

  before(async () => {
    server = createServer(buildHandler(true, VALID_TOKEN));
    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (addr && typeof addr === "object") port = addr.port;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(() => resolve()));
  });

  const base = () => `http://127.0.0.1:${port}`;

  it("无 token → 401 + WWW-Authenticate", async () => {
    const res = await fetchUrl(`${base()}/sse`);
    assert.equal(res.status, 401);
    assert.equal(res.headers["www-authenticate"], 'Bearer realm="mcp"');
  });

  it("有效 Bearer token → 200", async () => {
    const res = await fetchUrl(`${base()}/sse`, {
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    });
    assert.equal(res.status, 200);
  });

  it("无效 token → 401", async () => {
    const res = await fetchUrl(`${base()}/sse`, {
      headers: { Authorization: "Bearer wrong-token" },
    });
    assert.equal(res.status, 401);
  });

  it("OPTIONS 豁免 → 204", async () => {
    const res = await fetchUrl(`${base()}/sse`, { method: "OPTIONS" });
    assert.equal(res.status, 204);
  });

  it("/health GET 豁免 → 200", async () => {
    const res = await fetchUrl(`${base()}/health`);
    assert.equal(res.status, 200);
  });

  it("CORS 有 Origin → 动态回显 + Vary", async () => {
    const res = await fetchUrl(`${base()}/health`, {
      headers: { Origin: "http://app.test" },
    });
    assert.equal(res.headers["access-control-allow-origin"], "http://app.test");
    assert.equal(res.headers["vary"], "Origin");
  });

  it("CORS 无 Origin → 无 Allow-Origin 头", async () => {
    const res = await fetchUrl(`${base()}/health`);
    assert.equal(res.headers["access-control-allow-origin"], undefined);
  });

  it("Referrer-Policy: no-referrer", async () => {
    const res = await fetchUrl(`${base()}/health`);
    assert.equal(res.headers["referrer-policy"], "no-referrer");
  });

  it("未知路径 + 鉴权启用 → 401（默认保护）", async () => {
    const res = await fetchUrl(`${base()}/unknown`);
    assert.equal(res.status, 401);
  });

  it("Query token → 正常通过", async () => {
    const res = await fetchUrl(`${base()}/sse?token=${VALID_TOKEN}`);
    assert.equal(res.status, 200);
  });
});

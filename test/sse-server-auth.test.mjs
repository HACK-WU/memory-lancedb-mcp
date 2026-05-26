/**
 * SSE Server Auth Integration Tests
 *
 * 仅覆盖启动期"监听地址 vs 鉴权配置"策略校验的端到端行为：
 * 通过直接调用 startSseServer 验证非回环 + 无 token 会立即抛错，
 * 而无需启动完整 HTTP server / 初始化 LanceDB runtime。
 *
 * HTTP 请求处理链路（401 / 200 / CORS / Bearer / Query / health 豁免 /
 * OPTIONS 豁免）的行为，已通过 test/unit/sse-auth.test.mjs 中
 * extractToken / timingSafeCompare 的纯函数测试完整覆盖；中间件本身
 * 仅是这些函数的薄包装，因此本文件不再重复构造完整 HTTP server。
 *
 * 注：startSseServer 的鉴权策略校验位于 createMemoryRuntime 之前，
 * 拒绝路径不会触碰任何外部依赖（数据库/嵌入服务）。
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { startSseServer } from "../dist/mcp-server-sse.js";

// 鉴权 env 变量名（与 src/sse-auth.ts 中 AUTH_ENV_VAR 保持一致）
const AUTH_ENV_VAR = "MEM_MCP_AUTH_TOKEN";

describe("startSseServer 启动期鉴权策略校验", () => {
  // 保存并清空 env，避免外部环境干扰断言
  let originalEnvValue;
  before(() => {
    originalEnvValue = process.env[AUTH_ENV_VAR];
    delete process.env[AUTH_ENV_VAR];
  });
  after(() => {
    if (originalEnvValue !== undefined) {
      process.env[AUTH_ENV_VAR] = originalEnvValue;
    } else {
      delete process.env[AUTH_ENV_VAR];
    }
  });

  it("非回环 host + 无 token + 未 --no-auth → 立即抛错（不会进入 runtime 初始化）", async () => {
    await assert.rejects(
      () =>
        startSseServer({
          host: "0.0.0.0",
          port: 0,
          quiet: true,
          // 无 authToken，无 MEM_MCP_AUTH_TOKEN（依赖测试环境隔离）
        }),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /非本地监听必须配置鉴权/);
        return true;
      },
    );
  });

  it("非回环 host + --no-auth → 立即抛错", async () => {
    await assert.rejects(
      () =>
        startSseServer({
          host: "192.168.1.10",
          port: 0,
          quiet: true,
          noAuth: true,
        }),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /--no-auth 仅在监听回环地址时允许/);
        return true;
      },
    );
  });

  // 注：以下场景不在本文件中端到端验证，因为均会进入 createMemoryRuntime，
  //   依赖外部 LanceDB / embedding；其行为已经由
  //   test/unit/sse-auth.test.mjs 中的 validateAuthPolicy 用例完整覆盖：
  //     - 回环 + 无 token → 允许，不启用
  //     - 回环 + 有 token → 允许，启用
  //     - 回环 + --no-auth → 允许，不启用
  //     - 非回环 + 有 token → 允许，启用
});

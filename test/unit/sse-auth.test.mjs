/**
 * SSE Auth Helper Unit Tests
 *
 * 覆盖 src/sse-auth.ts 中以下纯函数的边界场景：
 *   - isLoopbackHost
 *   - extractToken
 *   - timingSafeCompare
 *   - resolveAuthConfig
 *   - validateAuthPolicy
 *
 * 与项目其他 unit 测试一致：从编译产物 dist/sse-auth.js 导入。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isLoopbackHost,
  extractToken,
  timingSafeCompare,
  resolveAuthConfig,
  validateAuthPolicy,
  AUTH_ENV_VAR,
  MAX_TOKEN_LENGTH,
} from "../../dist/sse-auth.js";

// ============================================================================
// isLoopbackHost
// ============================================================================

describe("isLoopbackHost", () => {
  it("识别 127.0.0.1 为回环", () => {
    assert.equal(isLoopbackHost("127.0.0.1"), true);
  });

  it("识别 127.x.x.x 整段为回环", () => {
    assert.equal(isLoopbackHost("127.0.0.2"), true);
    assert.equal(isLoopbackHost("127.255.255.254"), true);
  });

  it("识别 ::1 为回环（含中括号包裹）", () => {
    assert.equal(isLoopbackHost("::1"), true);
    assert.equal(isLoopbackHost("[::1]"), true);
  });

  it("识别 localhost 为回环（大小写不敏感）", () => {
    assert.equal(isLoopbackHost("localhost"), true);
    assert.equal(isLoopbackHost("LocalHost"), true);
  });

  it("0.0.0.0 不算回环", () => {
    assert.equal(isLoopbackHost("0.0.0.0"), false);
  });

  it("内网 IP 不算回环", () => {
    assert.equal(isLoopbackHost("192.168.1.10"), false);
    assert.equal(isLoopbackHost("10.0.0.1"), false);
    assert.equal(isLoopbackHost("172.16.0.1"), false);
  });

  it("空值返回 false", () => {
    assert.equal(isLoopbackHost(""), false);
    assert.equal(isLoopbackHost(null), false);
    assert.equal(isLoopbackHost(undefined), false);
  });
});

// ============================================================================
// extractToken
// ============================================================================

describe("extractToken", () => {
  function makeReq(headers) {
    return { headers };
  }
  function makeUrl(query = "") {
    return new URL(`http://example.com/sse${query}`);
  }

  it("从 Authorization: Bearer 头提取", () => {
    const tok = extractToken(
      makeReq({ authorization: "Bearer abc123" }),
      makeUrl(),
    );
    assert.equal(tok, "abc123");
  });

  it("Bearer 大小写不敏感", () => {
    assert.equal(
      extractToken(makeReq({ authorization: "bearer xyz" }), makeUrl()),
      "xyz",
    );
    assert.equal(
      extractToken(makeReq({ authorization: "BEARER abc" }), makeUrl()),
      "abc",
    );
  });

  it("没有 Header 时回退到 query", () => {
    const tok = extractToken(makeReq({}), makeUrl("?token=fromQuery"));
    assert.equal(tok, "fromQuery");
  });

  it("Header 优先于 query", () => {
    const tok = extractToken(
      makeReq({ authorization: "Bearer headerTok" }),
      makeUrl("?token=queryTok"),
    );
    assert.equal(tok, "headerTok");
  });

  it("非 Bearer 方案视为未携带，回退 query", () => {
    const tok = extractToken(
      makeReq({ authorization: "Basic dXNlcjpwYXNz" }),
      makeUrl("?token=fallback"),
    );
    assert.equal(tok, "fallback");
  });

  it("Header 与 query 都没有返回 null", () => {
    assert.equal(extractToken(makeReq({}), makeUrl()), null);
  });

  it("空 query token 视为不存在", () => {
    assert.equal(extractToken(makeReq({}), makeUrl("?token=")), null);
  });

  it("authorization 为 string[] 时取第一个元素", () => {
    const tok = extractToken(
      makeReq({ authorization: ["Bearer arrTok1", "Bearer arrTok2"] }),
      makeUrl(),
    );
    assert.equal(tok, "arrTok1");
  });

  it("authorization 为空数组 [] 时回退 query", () => {
    const tok = extractToken(
      makeReq({ authorization: [] }),
      makeUrl("?token=fallback"),
    );
    assert.equal(tok, "fallback");
  });
});

// ============================================================================
// timingSafeCompare
// ============================================================================

describe("timingSafeCompare", () => {
  it("相同字符串返回 true", () => {
    assert.equal(timingSafeCompare("abc123", "abc123"), true);
  });

  it("长度不同返回 false", () => {
    assert.equal(timingSafeCompare("abc", "abcd"), false);
    assert.equal(timingSafeCompare("abcd", "abc"), false);
  });

  it("等长但内容不同返回 false", () => {
    assert.equal(timingSafeCompare("abcd", "abce"), false);
  });

  it("空字符串视为不相等（拒绝空 token 通过）", () => {
    assert.equal(timingSafeCompare("", ""), false);
    assert.equal(timingSafeCompare("", "abc"), false);
    assert.equal(timingSafeCompare("abc", ""), false);
  });

  it("UTF-8 多字节字符正确处理", () => {
    assert.equal(timingSafeCompare("你好", "你好"), true);
    assert.equal(timingSafeCompare("你好", "你他"), false);
  });

  it("超长输入（>MAX_TOKEN_LENGTH）直接返回 false", () => {
    const longA = "a".repeat(MAX_TOKEN_LENGTH + 1);
    const longB = "b".repeat(MAX_TOKEN_LENGTH + 1);
    assert.equal(timingSafeCompare(longA, longB), false);
    // 正常长度仍然正常比较
    assert.equal(timingSafeCompare("abc", "abc"), true);
  });

  it("MAX_TOKEN_LENGTH 导出值为 1024", () => {
    assert.equal(MAX_TOKEN_LENGTH, 1024);
  });
});

// ============================================================================
// resolveAuthConfig
// ============================================================================

describe("resolveAuthConfig", () => {
  it("--no-auth 显式关闭，忽略 token 与 env", () => {
    const r = resolveAuthConfig({
      noAuth: true,
      authToken: "ignored",
      env: { [AUTH_ENV_VAR]: "alsoIgnored" },
    });
    assert.equal(r.enabled, false);
    assert.equal(r.token, undefined);
    assert.equal(r.source, "disabled");
  });

  it("CLI --auth-token 优先于环境变量", () => {
    const r = resolveAuthConfig({
      authToken: "cliTok",
      env: { [AUTH_ENV_VAR]: "envTok" },
    });
    assert.equal(r.enabled, true);
    assert.equal(r.token, "cliTok");
    assert.equal(r.source, "cli");
  });

  it("仅环境变量时启用，source=env", () => {
    const r = resolveAuthConfig({
      env: { [AUTH_ENV_VAR]: "envTok" },
    });
    assert.equal(r.enabled, true);
    assert.equal(r.token, "envTok");
    assert.equal(r.source, "env");
  });

  it("两者都没有时不启用，source=none", () => {
    const r = resolveAuthConfig({ env: {} });
    assert.equal(r.enabled, false);
    assert.equal(r.token, undefined);
    assert.equal(r.source, "none");
  });

  it("CLI token 仅含空白时视为未提供，回退 env", () => {
    const r = resolveAuthConfig({
      authToken: "   ",
      env: { [AUTH_ENV_VAR]: "envTok" },
    });
    assert.equal(r.enabled, true);
    assert.equal(r.token, "envTok");
    assert.equal(r.source, "env");
  });
});

// ============================================================================
// validateAuthPolicy
// ============================================================================

describe("validateAuthPolicy", () => {
  it("规则1：回环+无 token+未 --no-auth → 允许，不启用", () => {
    const r = validateAuthPolicy({
      host: "127.0.0.1",
      authConfig: { enabled: false, source: "none" },
    });
    assert.equal(r.enabled, false);
    assert.equal(r.expectedToken, undefined);
    assert.equal(r.loopback, true);
  });

  it("规则2：回环+有 token → 允许，启用", () => {
    const r = validateAuthPolicy({
      host: "127.0.0.1",
      authConfig: { enabled: true, token: "longEnoughToken_1234", source: "cli" },
    });
    assert.equal(r.enabled, true);
    assert.equal(r.expectedToken, "longEnoughToken_1234");
    assert.equal(r.weakToken, false);
    assert.equal(r.loopback, true);
  });

  it("规则3：回环+--no-auth → 允许，不启用", () => {
    const r = validateAuthPolicy({
      host: "localhost",
      authConfig: { enabled: false, source: "disabled" },
      noAuth: true,
    });
    assert.equal(r.enabled, false);
    assert.equal(r.loopback, true);
  });

  it("规则4：非回环+有 token → 允许，启用", () => {
    const r = validateAuthPolicy({
      host: "0.0.0.0",
      authConfig: { enabled: true, token: "longEnoughToken_1234", source: "env" },
    });
    assert.equal(r.enabled, true);
    assert.equal(r.expectedToken, "longEnoughToken_1234");
    assert.equal(r.loopback, false);
  });

  it("规则5：非回环+无 token+未 --no-auth → 抛错", () => {
    assert.throws(
      () =>
        validateAuthPolicy({
          host: "0.0.0.0",
          authConfig: { enabled: false, source: "none" },
        }),
      /非本地监听必须配置鉴权/,
    );
  });

  it("规则6：非回环+--no-auth → 抛错", () => {
    assert.throws(
      () =>
        validateAuthPolicy({
          host: "192.168.1.5",
          authConfig: { enabled: false, source: "disabled" },
          noAuth: true,
        }),
      /--no-auth 仅在监听回环地址时允许/,
    );
  });

  it("token 长度 < 16 时 weakToken=true", () => {
    const r = validateAuthPolicy({
      host: "127.0.0.1",
      authConfig: { enabled: true, token: "short", source: "cli" },
    });
    assert.equal(r.enabled, true);
    assert.equal(r.weakToken, true);
  });

  it("token 长度 >= 16 时 weakToken=false", () => {
    const r = validateAuthPolicy({
      host: "127.0.0.1",
      authConfig: { enabled: true, token: "1234567890abcdef", source: "cli" },
    });
    assert.equal(r.weakToken, false);
  });
});

/**
 * SSE Auth Helper
 *
 * 提供 mcp-wrapper SSE 模式下 Bearer Token 鉴权所需的纯函数：
 *
 *   - isLoopbackHost      判断 host 是否为回环地址
 *   - extractToken        从请求中按优先级提取 token（Header > Query）
 *   - timingSafeCompare   常量时间字符串比较（防时序攻击）
 *   - resolveAuthConfig   按优先级解析 token 来源（CLI > 环境变量）
 *   - validateAuthPolicy  启动期"监听地址 vs 鉴权配置"策略校验
 *   - logAuthFailure      鉴权失败的脱敏日志
 *
 * 本模块不依赖 HTTP 框架/全局状态，便于单元测试。
 */

import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import type { IncomingMessage } from "node:http";

// ============================================================================
// Types
// ============================================================================

export interface ResolveAuthConfigInput {
  /** CLI --auth-token 显式值 */
  authToken?: string;
  /** CLI --no-auth 标志 */
  noAuth?: boolean;
  /** 环境变量快照（注入便于测试），默认从 process.env 读取 */
  env?: NodeJS.ProcessEnv;
}

export interface ResolveAuthConfigResult {
  /** 是否启用鉴权 */
  enabled: boolean;
  /** 期望 token；当 enabled=false 时为 undefined */
  token?: string;
  /** token 来源（用于日志，不含明文） */
  source: "cli" | "env" | "none" | "disabled";
}

export interface ValidateAuthPolicyInput {
  /** 监听 host */
  host: string;
  /** 已解析得到的鉴权配置 */
  authConfig: ResolveAuthConfigResult;
  /** CLI --no-auth 标志（resolveAuthConfig 内会用，但 validate 还需独立判断非回环+--no-auth 拒绝场景） */
  noAuth?: boolean;
}

export interface ValidateAuthPolicyResult {
  /** 最终是否启用鉴权 */
  enabled: boolean;
  /** 期望 token（仅 enabled=true 时存在） */
  expectedToken?: string;
  /** token 长度 < 16 时为 true，调用方据此打印 WARN */
  weakToken: boolean;
  /** 监听是否为回环地址 */
  loopback: boolean;
}

export type AuthFailureReason = "missing_token" | "invalid_token";

// ============================================================================
// Loopback host 判定
// ============================================================================

const LOOPBACK_HOSTS = new Set<string>([
  "127.0.0.1",
  "::1",
  "localhost",
]);

/**
 * 判断 host 是否为回环地址。
 * 仅识别精确字符串匹配，不解析 DNS。`0.0.0.0` 不算回环。
 */
export function isLoopbackHost(host: string | undefined | null): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase();
  // 处理 IPv6 中括号包裹形式
  const stripped = h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
  if (LOOPBACK_HOSTS.has(stripped)) return true;
  // 127.0.0.0/8 整段视为回环
  if (/^127\./.test(stripped)) return true;
  return false;
}

// ============================================================================
// Token 提取
// ============================================================================

/**
 * 按优先级从请求中提取 token：
 *   1. HTTP Header `Authorization: Bearer <token>`
 *   2. URL Query 参数 `?token=<token>`
 * 命中任一返回 token 字符串；都不命中返回 null。
 *
 * 仅识别 "Bearer" 方案（大小写不敏感），其他方案视为未携带。
 */
export function extractToken(
  req: Pick<IncomingMessage, "headers">,
  url: URL,
): string | null {
  // 1. Authorization: Bearer ...
  // Node http.IncomingHttpHeaders 声明 authorization 为 string | undefined，
  // 但部分反向代理（AWS ALB 等）实际可能传入 string[]，故做防御性处理。
  const rawAuth = req.headers?.authorization as unknown as string | string[] | undefined;
  let authStr: string | undefined;
  if (typeof rawAuth === "string") {
    authStr = rawAuth;
  } else if (Array.isArray(rawAuth) && rawAuth.length > 0) {
    authStr = rawAuth[0];
  }
  if (authStr) {
    const trimmed = authStr.trim();
    // 形如 "Bearer xxx"，大小写不敏感
    const match = /^Bearer\s+(\S+)\s*$/i.exec(trimmed);
    if (match) {
      return match[1];
    }
  }

  // 2. ?token=xxx
  const queryToken = url.searchParams.get("token");
  if (queryToken && queryToken.length > 0) {
    return queryToken;
  }

  return null;
}

// ============================================================================
// 常量时间字符串比较
// ============================================================================

/** 固定长度零值 Buffer，用于长度不一致时的等时耗哑比较 */
const DUMMY_BUF = Buffer.alloc(32);

/** 输入 token 最大长度，超过直接返回 false，防御超长输入 DoS */
export const MAX_TOKEN_LENGTH = 1024;

/**
 * 使用 `crypto.timingSafeEqual` 进行常量时间比较，防御时序攻击。
 *
 * 长度不一致时使用 DUMMY_BUF 执行等时耗哑比较，消除 token 长度旁路。
 * 输入超过 MAX_TOKEN_LENGTH 直接返回 false，防御超长输入 DoS。
 */
export function timingSafeCompare(a: string, b: string): boolean {
  // 任一为空字符串视为不相等（不允许空 token 通过）
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length === 0 || b.length === 0) return false;

  // 防御超长输入 DoS
  if (a.length > MAX_TOKEN_LENGTH || b.length > MAX_TOKEN_LENGTH) return false;

  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");

  // 长度不一致：用 DUMMY_BUF 哑比较保证时间恒定，消除长度旁路
  if (bufA.length !== bufB.length) {
    try {
      timingSafeEqual(DUMMY_BUF, DUMMY_BUF);
    } catch {
      /* ignore */
    }
    return false;
  }

  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// ============================================================================
// 配置解析（CLI > 环境变量）
// ============================================================================

const ENV_VAR_NAME = "MEM_MCP_AUTH_TOKEN";

/**
 * 按优先级解析鉴权配置：
 *   --no-auth          → 显式关闭
 *   --auth-token <x>   → 优先采用
 *   MEM_MCP_AUTH_TOKEN → 环境变量兜底
 *   都没有             → 不启用（由后续策略校验决定是否允许）
 */
export function resolveAuthConfig(
  input: ResolveAuthConfigInput = {},
): ResolveAuthConfigResult {
  const env = input.env ?? process.env;

  if (input.noAuth) {
    return { enabled: false, source: "disabled" };
  }

  const cliToken = input.authToken?.trim();
  if (cliToken) {
    return { enabled: true, token: cliToken, source: "cli" };
  }

  const envToken = env[ENV_VAR_NAME]?.trim();
  if (envToken) {
    return { enabled: true, token: envToken, source: "env" };
  }

  return { enabled: false, source: "none" };
}

// ============================================================================
// 启动期策略校验
// ============================================================================

/**
 * 校验"监听地址 vs 鉴权配置"组合是否安全。
 *
 * 规则：
 *   1. 回环 + 无 token + 未 --no-auth → 允许，不启用鉴权（保留开发体验）
 *   2. 回环 + 有 token                → 允许，启用鉴权
 *   3. 回环 + --no-auth               → 允许，不启用鉴权
 *   4. 非回环 + 有 token              → 允许，启用鉴权
 *   5. 非回环 + 无 token + 未 --no-auth → 抛错（必须配置 token）
 *   6. 非回环 + --no-auth             → 抛错（--no-auth 仅限回环）
 */
export function validateAuthPolicy(
  input: ValidateAuthPolicyInput,
): ValidateAuthPolicyResult {
  const { host, authConfig, noAuth } = input;
  const loopback = isLoopbackHost(host);

  // 非回环场景的硬性约束
  if (!loopback) {
    if (noAuth) {
      throw new Error(
        `[mem][auth] --no-auth 仅在监听回环地址时允许（当前 host=${host}）。` +
          `如确需远程免鉴权访问，请改为绑定 127.0.0.1 并通过反向代理处理鉴权。`,
      );
    }
    if (!authConfig.enabled || !authConfig.token) {
      throw new Error(
        `[mem][auth] 非本地监听必须配置鉴权 token（当前 host=${host}）。` +
          `请通过 --auth-token <token> 或环境变量 ${ENV_VAR_NAME} 设置；` +
          `若仅本地访问，请将 --host 设为 127.0.0.1。`,
      );
    }
  }

  // 通过：根据 authConfig 决定是否启用
  const enabled = authConfig.enabled && !!authConfig.token;
  const expectedToken = enabled ? authConfig.token : undefined;
  const weakToken = enabled && expectedToken !== undefined && expectedToken.length < 16;

  return {
    enabled,
    expectedToken,
    weakToken,
    loopback,
  };
}

// ============================================================================
// 鉴权失败日志（脱敏）
// ============================================================================

/**
 * 在 stderr 打印一行鉴权失败日志，**绝不**包含 token 明文与 Authorization 原始头。
 *
 *   [mem][auth] 2026-01-01T00:00:00.000Z ip=1.2.3.4 path=/sse reason=missing_token
 */
export function logAuthFailure(
  req: Pick<IncomingMessage, "socket" | "url">,
  pathname: string,
  reason: AuthFailureReason,
): void {
  const ts = new Date().toISOString();
  const ip = req.socket?.remoteAddress ?? "unknown";
  // path 仅取 pathname，避免把 ?token=xxx 写入日志
  // eslint-disable-next-line no-console
  console.error(`[mem][auth] ${ts} ip=${ip} path=${pathname} reason=${reason}`);
}

// ============================================================================
// 常量导出（便于测试与文档引用）
// ============================================================================

export const AUTH_ENV_VAR = ENV_VAR_NAME;

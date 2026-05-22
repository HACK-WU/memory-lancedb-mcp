
当前 `src/` 目录下没有未提交的代码变更，CodeReview 代理只检测到了 `docs/knowledge-index-skill_DESIGN.md` 的文档更新。

让我查看一下最近的 git 提交记录，找到可以 review 的提交：


以下是最近的提交记录：

| 提交 | 描述 |
|------|------|
| `18b224f` | docs: add knowledge-index-skill design document |
| `c93fbd1` | feat: hard-filter recall results by tags instead of soft BM25 weighting |
| `cb32168` | docs: update scope parameter usage |
| `6b8bb84` | fix: scope isolation |
| `6ca576e` | feat: 跨 scope 模式支持 + list_scopes |
| `4f1561c` | docs: add comprehensive MCP/CLI usage guide |
| `03d50ba` | fix(tags): memory_list tags filtering |
| `7a7dbc4` | feat: add tags support |


好的，我来对 `src/` 目录进行全量代码审查。先读取所有源文件：


好的，我已经完整阅读了 `src/` 目录下所有 8 个文件。以下是全量代码审查结果：

---

## 代码审查报告：`src/` 目录全量审查

### 严重度说明
- **P0 (严重)**: 逻辑错误 / 安全漏洞，可能导致数据丢失或运行时崩溃
- **P1 (重要)**: 潜在的 Bug 或设计缺陷
- **P2 (建议)**: 代码质量、可维护性改进

---

### P0 — 严重问题

#### 1. SSE 服务器 CORS 配置过于宽松
**文件**: [mcp-server-sse.ts](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/mcp-server-sse.ts#L84-L86)

```typescript
res.setHeader("Access-Control-Allow-Origin", "*");
```
结合无认证的 `/message` 端点，任何网页都可以跨域向该 MCP 服务器发送请求，读写用户的所有记忆数据。在跨 scope 模式（`agentId="system"`）下尤其危险——攻击者可获取**所有 scope 的记忆**，包括其他 agent 的私有数据。

**建议**: 至少限制为 `localhost` 来源，或通过 `--cors-origin` 参数控制。

#### 2. SSE 服务器无任何认证机制
**文件**: [mcp-server-sse.ts](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/mcp-server-sse.ts#L57-L209)

HTTP 端点完全开放。如果用户绑定到 `0.0.0.0`（通过 `--host`），同一网络内的任何设备都能读写记忆。虽然有 stderr 警告，但缺乏技术层面的防护。

**建议**: 添加 token-based 认证，至少添加一个 `--auth-token` 选项。

---

### P1 — 重要问题

#### 3. `callTool` 中 scope 注入逻辑有冗余分支
**文件**: [index.ts](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/index.ts#L371-L385)

```typescript
const isWriteOp = name === "memory_store" || name === "memory_update" || name === "memory_forget";
if (isWriteOp && name === "memory_store") {
```
`isWriteOp` 计算了但实际只用到了 `name === "memory_store"` 这个条件。`memory_update` 和 `memory_forget` 的分支逻辑被计算了但没被使用，`else` 分支和当前 `if` 分支的 `effectiveCtx` 赋值完全相同（都是 `baseCtx`），说明这段条件判断没有实际效果。

**建议**: 简化逻辑，要么移除 `isWriteOp`，要么明确 `memory_update`/`memory_forget` 需要的差异化行为。

#### 4. Lifecycle 工具定义重复
**文件**: [mcp-server.ts](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/mcp-server.ts#L154-L233) 和 [mcp-server-sse.ts](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/mcp-server-sse.ts#L336-L376)

`getLifecycleToolDefinitions()` (stdio) 和 `getLifecycleToolDefs()` (SSE) 是几乎完全相同的代码，只是描述文本略有差异。同样，[handleLifecycleTool](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/mcp-server.ts#L235) 和 [handleLifecycleToolCall](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/mcp-server-sse.ts#L378) 也是重复实现。

**建议**: 抽取到共享模块，避免两处维护不一致。

#### 5. `memory_list` + tags 重写为 `memory_recall` 时丢失了 `limit` 参数
**文件**: [index.ts](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/index.ts#L326-L333)

```typescript
effectiveName = "memory_recall";
normalized.query = prefix;
delete normalized.offset;
```
重写后 `normalized.limit` 虽然保留了，但 `memory_recall` 和 `memory_list` 对 `limit` 的语义可能不同。CLI 层的 [list 命令](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/cli.ts#L200-L213) 在 tags 模式下手动传了 `limit`，但这个 limit 是否被 recall 正确解释取决于插件实现。

#### 6. `entryMatchesTags` 只检查第一个匹配的 tag 行
**文件**: [index.ts](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/index.ts#L72-L82)

循环中一旦遇到 `TAG_RE` 匹配就立即 `return`，不继续检查后续行。如果一条记忆有多个 tag prefix 行（虽然理论上不应该），只会匹配第一个。逻辑上没有 bug，但代码意图不够清晰。

#### 7. `expandEnvVars` 中未设置的环境变量被静默替换为空字符串
**文件**: [config.ts](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/config.ts#L137-L144)

虽然有 `console.warn`，但在 MCP stdio 模式下 stderr 日志可能被忽略。如果 `OPENAI_API_KEY` 未设置，`embedding.apiKey` 变成空字符串，后续加载插件时才会报错，错误信息不够明确。

**建议**: 考虑在 `loadConfig` 阶段做更严格的校验，或在空替换时抛出错误。

#### 8. `scope delete` 命令中 `vectorDim` 硬编码 fallback 为 1536
**文件**: [cli.ts](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/cli.ts#L536)

```typescript
const vectorDim = config.embedding?.dimensions || 1536;
```
如果用户使用了非 1536 维度的 embedding 模型且未配置 `dimensions`，这里会传错维度给 `MemoryStore`，可能导致 `stats()` 或 `bulkDelete()` 操作失败。同样的问题出现在 [cli.ts L580](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/cli.ts#L580)。

#### 9. `loadPlugin` 的 fallback 路径 `../../dist/index.js` 脆弱
**文件**: [index.ts](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/index.ts#L170)

使用相对路径 `../../dist/index.js` 依赖于项目构建后的目录结构。如果包被安装到 `node_modules` 深处，这个路径就不对了。同样的问题在 [cli.ts L53](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/cli.ts#L53) 中的 `../../dist/src/store.js`。

---

### P2 — 改进建议

#### 10. `FakeOpenClawApi` 使用 `Function` 类型
**文件**: [fake-api.ts](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/fake-api.ts#L41-L43)

```typescript
interface EventHandler { handler: Function; ... }
```
`Function` 类型在 TypeScript 中过于宽泛，绕过了类型检查。建议使用更具体的函数签名。

#### 11. `maskSecrets` 对短密钥（<=8 字符）显示 `****`，可能泄露信息
**文件**: [cli.ts](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/cli.ts#L82-L86)

如果 API key 恰好是 8 字符，显示 `****` 等于告诉攻击者 key 长度。虽然不太常见（API key 通常较长），但建议统一处理。

#### 12. `config.yaml` 文件权限设置正确（0o600），值得肯定
**文件**: [config.ts](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/config.ts#L309)

`initConfig` 正确设置了 `mode: 0o600`，防止其他用户读取包含 API key 的配置文件。

#### 13. 缺少 graceful shutdown 处理（stdio 模式）
**文件**: [mcp-server.ts](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/mcp-server.ts)

SSE 模式有 `SIGINT`/`SIGTERM` 处理，但 stdio 模式没有。虽然 stdio 模式在父进程退出时自然会终止，但缺少清理逻辑（如 flush 未持久化的记忆）。

#### 14. `tagPrefix` 和 `assembleTags` 功能重复
**文件**: [cli.ts L58-62](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/cli.ts#L58-L62) vs [index.ts L55-59](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/index.ts#L55-L59)

`tagPrefix()` 和 `assembleTags()` 做了相同的事情，但输出格式略有不同（`tagPrefix` 没有尾部空格，`assembleTags` 有）。应统一为一个函数。

#### 15. `sessionKey` 使用 `Date.now()` 生成，并发时可能冲突
**文件**: [lifecycle.ts](file:///Users/wuyongping/PycharmProjects/memory-lancedb-mcp/src/lifecycle.ts#L60)

多处使用 `` `session-${Date.now()}` `` 作为默认 sessionKey。如果同一毫秒触发多次，会产生相同的 key。

**建议**: 使用 `crypto.randomUUID()` 替代。

---

### 总结

| 等级 | 数量 | 主要问题 |
|------|------|----------|
| P0 | 2 | SSE 无认证 + CORS 全开放 |
| P1 | 7 | 冗余逻辑、重复代码、环境校验不足 |
| P2 | 6 | 类型安全、代码复用、session 唯一性 |

**整体评价**: 架构设计清晰，`FakeOpenClawApi` 适配器模式很巧妙，tag 前缀注入/过滤的 pipeline 实现也很完整。主要风险集中在 SSE 模式的安全性——如果仅在本地使用（`127.0.0.1`）可以接受，但暴露到网络前需要添加认证。代码层面最大的改进空间是消除 stdio/SSE 两套 lifecycle 工具定义的重复。
## 异常处理与恢复

本文档汇总 `knowledge-index` 当前实现中的**常见报错、警告与恢复方式**。

整体原则是：

- **输入非法时快速失败**
- **可恢复场景尽量给出 hint / next_step**
- **能够兜底时优先退化，而不是直接崩溃**

## 输出风格

大多数脚本在失败时会输出：

```json
{
  "ok": false,
  "error": "..."
}
```

部分脚本，尤其是 `scan-kb.ts`，还会额外返回：

- `hint`
- `next_step`
- `possible_causes`
- `example`

这类增强输出主要用于告诉调用方：**为什么失败、下一步该做什么、期望输入长什么样**。

## 一类：参数校验错误

### 非法 `scope`

典型现象：

- `--scope ../etc`
- `--scope bad/scope`

结果：

- 会被直接拒绝
- 防止路径遍历或跨 scope 污染

恢复方式：

- 只使用字母、数字、连字符、下划线
- 不要包含 `/`、`..` 等路径成分

### `manage-index.ts` 参数缺失

常见错误：

- `create-root` 缺少 `--root-name`
- `create` 缺少 `--parent` 或 `--name`
- `delete` 缺少 `--parent` 或 `--name`

恢复方式：

- 先确认当前 action
- 再补齐对应参数

### `sync-relation.ts` 单条模式参数不完整

单条模式要求同时提供：

- `--group`
- `--relation`
- `--module-info`
- `--keywords`

如果缺少其中任一项，会直接失败。

## 二类：数据文件缺失或损坏

### `relations-cache.json` 不存在

影响脚本：

- `sync-relation.ts`
- `get-module-info.ts`

典型原因：

- scope 尚未初始化
- 运行时数据被误删
- 数据文件损坏导致读取失败

恢复方式：

- 先执行任一会触发 `ensureScopeDir` 的命令初始化 scope
- 或检查 `knowledge-index/kb/{scope}/relations-cache.json` 是否被误删

### `group-index.json` 损坏

影响脚本：

- `query-group.ts`
- `manage-index.ts`

典型现象：

- JSON 解析失败
- 查询或写入时返回 `ok: false`

恢复方式：

- 检查对应 scope 下的 `group-index.json`
- 必要时从 `backup/` 或模板恢复

### 本地 KB 文件不存在

影响脚本：

- `get-module-info.ts`

典型现象：

- `本地 KB 文件不存在`
- `本地 KB 中未找到 ... 的内容`

恢复方式：

- 使用 `sync-relation.ts` 重新写入 `module-info`
- 或检查该 Group 下的 `index.json` 是否被误删

## 三类：`scan-kb.ts` 相关错误

`scan-kb.ts` 是当前错误提示最完整的脚本之一。

### `source 目录不存在或不是目录`

触发场景：

- `--source` 路径写错
- 传入的是文件，不是目录
- 把 `knowledge-index/kb/{scope}` 误当成外部知识库目录

恢复方式：

1. 检查路径是否真实存在
2. 确认它是外部 Markdown 知识库根目录
3. 确认目录下确实包含 `.md` 文件

### `scan-pending.json 不存在`

触发场景：

- 直接执行了 `scan --results`
- 但此前没有先执行第一步 `scan`

恢复方式：

1. 先执行不带 `--results` 的 `scan`
2. 生成 `scan-pending.json`
3. 再执行 `scan --results`

### `results 文件不存在`

触发场景：

- `--results` 路径写错
- AI 结果文件尚未生成

恢复方式：

- 先确认 AI 结果文件已经写出
- 再检查 JSON 格式至少包含 `entries`

### `scan-index.json 不存在`

触发场景：

- 只执行了 `scan`
- 还没有执行 `scan --results`
- 或使用了自定义输出路径，但 `vectorize` 没带 `--scan-index`

恢复方式：

1. 先执行 `scan`
2. 再执行 `scan --results`
3. 最后再执行 `vectorize`

### `complete 文件不存在`

触发场景：

- `vectorize --complete` 指向了不存在的结果文件

恢复方式：

- 先完成摘要向量化
- 生成包含 `path` 与 `memoryId` 的 JSON 文件
- 再执行 `vectorize --complete`

## 四类：关键词相关问题

### 关键词没有被接受

影响脚本：

- `sync-relation.ts`

关键词校验规则：

- 必须是自然语言词汇
- 不能像路径、文件名、代码表达式那样带明显代码特征
- **必须真实出现在 `module-info` 原文中**

例如：

- 原文只有“登录流程”
- 你传了 `登录,认证,token`

如果原文里没有“认证”或“token”，那么它们会进入：

- `invalid_keywords`

而不是 `keywords`

### 为什么有些关键词会被判无效

常见原因：

- 没出现在原文里
- 更像代码符号、路径或文件扩展名
- 只是调用方主观补充的标签，而不是原文里的自然语言表达

恢复方式：

- 先把关键词写进 `module-info`
- 再执行 `sync-relation.ts`

## 五类：展示参数问题

影响脚本：

- `query-group.ts`

### `--partition` 无效

有效值只有：

- `hot`
- `warm`
- `cold`
- `emerging`
- `all`

### `--mode` 无效

有效值只有：

- `full`
- `hot`
- `compact`
- `help`

### `--depth` / `--hot-count` 越界

这类场景一般不会直接失败，而是：

- 回退为默认值
- 或限制到最大值
- 同时输出警告

## 六类：警告而非错误的场景

这些情况通常不会终止执行，但会提示调用方注意：

### `scan-kb.ts`

- 无法获取 Git 信息，退化为全量扫描
- `lastScannedCommit` 不存在，退化为全量扫描
- 增量扫描失败，退化为全量扫描

### `import-kb.ts`

- 未提供 `--scan-index`，导入关键词为空
- 遇到空文件，跳过导入
- 遇到超大文件，跳过导入
- 根节点已存在，执行覆盖更新
- `mapping.path` 首段与根名重复，自动去重

### `sync-relation.ts`

- 批量模式下某条 `module_info` 为空，被跳过
- 某条 Relation 的关键词全部无效或为空

## 推荐排障顺序

当你看到 `ok: false` 时，建议按这个顺序排查：

1. **先看命令参数是否完整**
2. **再看 `--scope` 是否正确**
3. **再看输入路径是否真的存在**
4. **再看运行时数据文件是否缺失或损坏**
5. **最后再检查工作流顺序是否跳步了**

尤其是外部导入链路里，最常见的并不是代码错误，而是：

- 没先执行 `scan`
- 没执行 `scan --results`
- 直接执行了 `vectorize`
- `--source` 指错目录

## 最常见的恢复口诀

```text
参数先补齐
路径先确认
索引先生成
再做下一步
```

## 相关文档

- `scan-kb` 详细流程：[`scan-kb.md`](./scan-kb.md)
- 外部导入说明：[`import-kb.md`](./import-kb.md)
- 典型工作流：[`workflows.md`](./workflows.md)

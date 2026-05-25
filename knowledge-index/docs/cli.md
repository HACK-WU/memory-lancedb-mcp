## CLI 参考

所有脚本都位于 `knowledge-index/scripts/`，通过 `npx jiti` 执行。

## `manage-index.ts`

管理 Group 树索引节点的创建与删除。

```bash
npx jiti knowledge-index/scripts/manage-index.ts \
  --scope <scope> --action create-root --root-name <name>

npx jiti knowledge-index/scripts/manage-index.ts \
  --scope <scope> --action create --parent <path> --name <name>

npx jiti knowledge-index/scripts/manage-index.ts \
  --scope <scope> --action delete --parent <path> --name <name> [--force]
```

## `query-group.ts`

查询 Group 树、热门 Relation 和关键词词云。

```bash
npx jiti knowledge-index/scripts/query-group.ts --scope <scope>
npx jiti knowledge-index/scripts/query-group.ts --scope <scope> --groups "项目/API"
npx jiti knowledge-index/scripts/query-group.ts --scope <scope> --mode hot
npx jiti knowledge-index/scripts/query-group.ts --scope <scope> --partition warm
```

## `get-module-info.ts`

按 Group + Relation 读取本地 KB 中的 Markdown 原文。

```bash
npx jiti knowledge-index/scripts/get-module-info.ts \
  --scope <scope> --group <group> --relation <relation>
```

## `sync-relation.ts`

把 Relation 和模块说明写入本地索引。

```bash
npx jiti knowledge-index/scripts/sync-relation.ts \
  --scope <scope> --group <group> \
  --relation <text> --module-info <markdown> --keywords <k1,k2>

npx jiti knowledge-index/scripts/sync-relation.ts \
  --scope <scope> --input <jsonFile>
```

### 关键词约束

- 关键词必须是自然语言词汇
- 关键词必须真实出现在 `module-info` 原文中
- 未出现在原文中的关键词会被判为无效

## `import-kb.ts`

把外部 Markdown 知识库导入 `knowledge-index`。

```bash
npx jiti knowledge-index/scripts/import-kb.ts \
  --scope <scope> --source <dir> --root-name <name>

npx jiti knowledge-index/scripts/import-kb.ts \
  --scope <scope> --source <dir> \
  --mapping <jsonFile> --root-name <name>
```

更完整的 `mapping` 示例与字段说明见：[`docs/import-kb.md`](./import-kb.md)

## `scan-kb.ts`

预扫描外部知识库，并管理摘要向量化状态。

```bash
npx jiti knowledge-index/scripts/scan-kb.ts scan \
  --scope <scope> --source <dir> --root-name <name>

npx jiti knowledge-index/scripts/scan-kb.ts scan \
  --scope <scope> --source <dir> --root-name <name> \
  --results <ai-results.json>

npx jiti knowledge-index/scripts/scan-kb.ts vectorize --scope <scope>

npx jiti knowledge-index/scripts/scan-kb.ts vectorize \
  --scope <scope> --complete <vectorize-results.json>
```

## 常用工作流

### 本地知识沉淀

1. `manage-index.ts` 创建 Group
2. `sync-relation.ts` 写入模块说明
3. `query-group.ts` 检查导航与热点
4. `get-module-info.ts` 验证原文可读性

### 外部知识库导入

1. `scan-kb.ts scan`
2. AI 生成摘要和关键词
3. `scan-kb.ts scan --results`
4. `scan-kb.ts vectorize`
5. AI 调用 `memory_store`
6. `scan-kb.ts vectorize --complete`
7. `import-kb.ts`

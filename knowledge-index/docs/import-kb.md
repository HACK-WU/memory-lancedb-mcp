## `import-kb` 使用说明

`import-kb.ts` 用来把外部 Markdown 知识库导入到 `knowledge-index` 的三层结构中。

支持两种模式：

- **约定模式**：目录 → Group，文件名 → Relation
- **配置模式**：通过 `--mapping` 显式指定 Group、Relation 和代码定位

## 命令格式

```bash
# 约定模式：按目录结构自动导入
npx jiti knowledge-index/scripts/import-kb.ts \
  --scope <scope> --source <dir> --root-name <name>

# 配置模式：按 mapping 文件显式控制
npx jiti knowledge-index/scripts/import-kb.ts \
  --scope <scope> --source <dir> \
  --mapping <jsonFile> --root-name <name>

# 配合预扫描关键词复用
npx jiti knowledge-index/scripts/import-kb.ts \
  --scope <scope> --source <dir> \
  --root-name <name> --scan-index <scan-index.json>
```

## 参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| `--scope` | 是 | 项目隔离标识 |
| `--source` | 是 | 外部知识库根目录路径 |
| `--root-name` | 是 | 导入根节点名称 |
| `--mapping` | 否 | JSON 映射配置文件，提供后进入配置模式 |
| `--scan-index` | 否 | `scan-index.json` 路径，用于复用预扫描阶段产出的关键词 |

## 约定模式如何工作

如果**不传** `--mapping`，脚本会按目录结构自动推导：

- 目录路径 → Group
- 文件名（去掉 `.md`）→ Relation
- 文件内容 → `module-info`

例如目录：

```text
external-kb/
├── API/
│   └── 登录.md
└── 运维/
    └── 发布流程.md
```

执行：

```bash
npx jiti knowledge-index/scripts/import-kb.ts \
  --scope mcp-test \
  --source ./external-kb \
  --root-name wiki
```

会得到大致映射：

- `wiki/API` → `登录`
- `wiki/运维` → `发布流程`

### 导入后 `index.json` 的 key 是文件名，不是语义描述

约定模式下，`import-kb.ts` 将文件名去 `.md` 后同时写入两个位置：

1. `relations-cache.json` 的 `Relation.text`（如 `"登录"`）
2. `kb/{scope}/{group}/index.json` 的 key（如 `"登录"`）

也就是说，**导入场景下 `index.json` 的 key 是文件名风格**，而非语义描述（如 `"用户登录接口"`）。这与 `sync-relation.ts` 的行为不同——后者使用 `--relation` 参数原文作为 key，通常是语义描述。

> 如果你在 `get-module-info.ts` 中用 `--relation` 查询导入的知识，传入的值应与 `Relation.text` 一致（即文件名），而非摘要内容。

## 配置模式如何工作

如果传入 `--mapping`，脚本会按照 JSON 文件里的显式定义导入。

### 完整示例

下面是一个更完整、可直接照着写的 `mapping.json` 示例：

```json
{
  "root_name": "项目知识库",
  "groups": [
    {
      "path": "API/认证",
      "sources": [
        {
          "file": "docs/api/login.md",
          "relation": "用户登录接口",
          "code_refs": [
            "src/api/auth.ts",
            "src/services/login-service.ts"
          ]
        },
        {
          "file": "docs/api/refresh-token.md",
          "relation": "刷新 token 接口",
          "code_refs": [
            "src/api/token.ts"
          ]
        }
      ]
    },
    {
      "path": "前端/登录页",
      "sources": [
        {
          "file": "docs/frontend/login-page.md",
          "relation": "登录页交互说明",
          "code_refs": [
            "src/pages/login/index.tsx",
            "src/store/modules/user.ts"
          ]
        }
      ]
    }
  ]
}
```

对应命令：

```bash
npx jiti knowledge-index/scripts/import-kb.ts \
  --scope mcp-test \
  --source ./external-kb \
  --mapping ./mapping.json \
  --root-name wiki
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `root_name` | string | 可选。若提供，会**覆盖**命令行里的 `--root-name` |
| `groups` | array | Group 定义列表 |
| `groups[].path` | string | 相对根节点的 Group 路径，不需要包含根名 |
| `groups[].sources` | array | 当前 Group 下要导入的来源文件列表 |
| `groups[].sources[].file` | string | 相对于 `--source` 的文件路径 |
| `groups[].sources[].relation` | string | 导入后的 Relation 名称 |
| `groups[].sources[].code_refs` | string[] | 可选。会以“代码定位”小节追加到 `module-info` 末尾 |

## 重要说明

### 1. `groups[].path` 不要重复写根名

推荐这样写：

```json
{ "path": "API/认证" }
```

而不是：

```json
{ "path": "项目知识库/API/认证" }
```

当前实现会在 `path` 首段与根名重复时自动去重，但更推荐你直接写**相对根节点**的路径。

### 2. `root_name` 会覆盖 `--root-name`

如果 `mapping.json` 同时写了：

```json
{ "root_name": "项目知识库" }
```

那么最终导入根节点会使用 `项目知识库`，而不是命令行里传入的 `--root-name`。

### 3. `code_refs` 会追加到原文末尾

例如原始 Markdown 是：

```md
## 登录流程
用户输入账号密码后进入认证流程。
```

如果配置了：

```json
"code_refs": ["src/api/auth.ts", "src/services/login-service.ts"]
```

导入后的 `module-info` 末尾会自动追加：

```md
## 代码定位
- src/api/auth.ts
- src/services/login-service.ts
```

### 4. 关键词来自 `scan-index.json`

`import-kb.ts` 自己**不会生成关键词**。

如果你希望导入后的 Relation 带上关键词，应先执行：

1. `scan-kb.ts scan`
2. AI 生成摘要与关键词
3. `scan-kb.ts scan --results`
4. 再执行 `import-kb.ts --scan-index <scan-index.json>`

## 推荐工作流

### 只想快速导入

适合目录结构本身就很清晰的情况：

1. 直接使用约定模式导入
2. 再用 `query-group.ts` 验证 Group 树和 Relation 是否符合预期

### 想精确控制 Group 和 Relation

适合已有文档目录比较杂、文件名不适合作为最终 Relation 名称的情况：

1. 编写 `mapping.json`
2. 使用配置模式导入
3. 如有需要，再配合 `--scan-index` 复用关键词

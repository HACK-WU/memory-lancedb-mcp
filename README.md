# memory-lancedb-mcp

MCP Server wrapper for [memory-lancedb-pro](https://github.com/CortexReach/memory-lancedb-pro) — zero-modification adapter that replaces the OpenClaw runtime with the Model Context Protocol.

## Features

- **14 memory tools** exposed via MCP (recall, store, forget, update, stats, list, debug, promote, archive, compact, explain_rank, self-improvement)
- **Lifecycle bridge** — auto-recall and auto-capture via `_lifecycle_*` tools
- **Dual transport** — stdio (default) and SSE (HTTP)
- **Zero modification** to the original project — wrapper only
- **YAML config** with `${ENV_VAR}` expansion
- **CLI** — `mem` command for management

## Quick Start

### 1. Clone and build

```bash
git clone https://github.com/CortexReach/memory-lancedb-pro.git
cd memory-lancedb-pro

# Build parent project
npm install --ignore-scripts
# (parent dist/ should already exist, otherwise run tsc)

# Build wrapper
cd mcp-wrapper
npm install --ignore-scripts
npx tsc
```

### 2. Initialize config

```bash
./bin/mem.mjs config init
# Creates ~/.config/memory-mcp/config.yaml
```

Edit the config to add your embedding API key:
```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"
  model: "text-embedding-3-small"
  baseURL: "https://api.openai.com/v1"
```

### 3. Start MCP Server

**stdio mode** (for Claude Desktop, Cursor, etc.):
```bash
./bin/mem.mjs serve
```

**SSE mode** (HTTP server):
```bash
./bin/mem.mjs serve --sse --port 3100
```

### 4. Verify

```bash
./bin/mem.mjs serve --dry-run
./bin/mem.mjs doctor
```

## MCP Client Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/path/to/memory-lancedb-pro/mcp-wrapper/bin/mem.mjs", "serve"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/path/to/memory-lancedb-pro/mcp-wrapper/bin/mem.mjs", "serve"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Windsurf / Continue / Other MCP clients

```json
{
  "command": "node",
  "args": ["/path/to/memory-lancedb-pro/mcp-wrapper/bin/mem.mjs", "serve"],
  "env": { "OPENAI_API_KEY": "sk-..." }
}
```

### SSE mode (remote/multi-client)

Start the server:
```bash
mem serve --sse --port 3100 --host 0.0.0.0
```

Then configure client to connect via SSE:
```json
{
  "mcpServers": {
    "memory": {
      "url": "http://localhost:3100/sse"
    }
  }
}
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `mem serve` | Start MCP Server (stdio) |
| `mem serve --sse` | Start MCP Server (SSE/HTTP) |
| `mem serve --dry-run` | Validate config + list tools |
| `mem list` | List recent memories |
| `mem search <query>` | Search memories |
| `mem store <text>` | Store a memory |
| `mem stats` | Show statistics |
| `mem delete <id>` | Delete a memory |
| `mem config init` | Create default config |
| `mem config show` | Show current config |
| `mem config validate` | Validate config |
| `mem doctor` | Health check |

## Architecture

```
┌─────────────────────────────────────────────┐
│           MCP Client (Claude, Cursor)        │
└────────────────────┬────────────────────────┘
                     │ MCP Protocol (stdio/SSE)
┌────────────────────▼────────────────────────┐
│           mcp-wrapper (this module)          │
│  ┌──────────┐ ┌───────────┐ ┌───────────┐  │
│  │MCP Server│ │  CLI      │ │ Lifecycle │  │
│  └────┬─────┘ └─────┬─────┘ └─────┬─────┘  │
│       └──────────────┼─────────────┘        │
│              ┌───────▼────────┐             │
│              │ FakeOpenClawApi│             │
│              └───────┬────────┘             │
└──────────────────────┼──────────────────────┘
                       │ import("../../dist/index.js")
┌──────────────────────▼──────────────────────┐
│        memory-lancedb-pro (unmodified)       │
│  14 tools · hybrid retrieval · LanceDB      │
└─────────────────────────────────────────────┘
```

## Available Tools

| Tool | Description |
|------|-------------|
| `memory_recall` | Hybrid search (vector + BM25) |
| `memory_store` | Store new memory |
| `memory_forget` | Delete memory |
| `memory_update` | Update existing memory |
| `memory_stats` | Usage statistics |
| `memory_debug` | Retrieval pipeline trace |
| `memory_list` | List with filtering |
| `memory_promote` | Promote to governance |
| `memory_archive` | Archive (keep but exclude) |
| `memory_compact` | Deduplicate & compress |
| `memory_explain_rank` | Ranking explanation |
| `self_improvement_log` | Learning log |
| `self_improvement_extract_skill` | Skill extraction |
| `self_improvement_review` | Review backlog |
| `_lifecycle_auto_recall` | Auto-recall (before prompt) |
| `_lifecycle_auto_capture` | Auto-capture (after agent) |
| `_lifecycle_session_end` | Session cleanup |

## Configuration

Default path: `~/.config/memory-mcp/config.yaml`

Override with `MEM_CONFIG_PATH` env var.

See `mem config init` for a full template with comments.

## License

MIT

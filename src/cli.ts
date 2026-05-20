/**
 * CLI Entry Point — 'mem' command
 *
 * Commands:
 *   mem serve          Start MCP Server (stdio mode)
 *   mem list           List memories
 *   mem search <q>     Search memories
 *   mem stats          Show statistics
 *   mem config init    Create default config
 *   mem config show    Show current config
 *   mem config path    Show config file path
 *   mem doctor         Health check
 */

import { Command } from "commander";
import { startMcpServer } from "./mcp-server.js";
import { startSseServer } from "./mcp-server-sse.js";
import { createMemoryRuntime } from "./index.js";
import { initConfig, getConfigPath, loadConfig, getDefaultConfigDir } from "./config.js";
import YAML from "yaml";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";

const program = new Command();

// ============================================================================
// Secret Masking Utility
// ============================================================================

function maskSecrets(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj;
  if (Array.isArray(obj)) return obj.map(maskSecrets);
  if (typeof obj !== "object") return obj;

  const record = obj as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (/apiKey$/i.test(key) || /secret$/i.test(key) || /password$/i.test(key)) {
      if (typeof value === "string") {
        // Preserve env var references like ${OPENAI_API_KEY}
        if (value.startsWith("${")) {
          result[key] = value;
        } else if (value.length > 8) {
          result[key] = `${value.slice(0, 4)}...${value.slice(-4)}`;
        } else {
          result[key] = "****";
        }
      } else if (Array.isArray(value)) {
        result[key] = value.map((v: unknown) => {
          if (typeof v === "string") {
            if (v.startsWith("${")) return v;
            return v.length > 8 ? `${v.slice(0, 4)}...${v.slice(-4)}` : "****";
          }
          return "****";
        });
      } else {
        result[key] = "****";
      }
    } else {
      result[key] = maskSecrets(value);
    }
  }
  return result;
}

program
  .name("mem")
  .description("MCP Server wrapper for memory-lancedb-pro")
  .version("0.1.0");

// ============================================================================
// mem serve — Start MCP Server
// ============================================================================

program
  .command("serve")
  .description("Start MCP Server (stdio mode by default). Use --scope for per-project memory isolation.")
  .option("-c, --config <path>", "Config file path")
  .option("-s, --scope <scope>", "Default scope for all operations (e.g. project:myapp, agent:bot1). Isolates memories per project.")
  .option("--dry-run", "Validate config and list tools without starting server")
  .option("--sse", "Use SSE (HTTP) transport instead of stdio")
  .option("-p, --port <n>", "SSE server port (default: 3100)", "3100")
  .option("--host <host>", "SSE server host (default: 127.0.0.1)", "127.0.0.1")
  .option("-q, --quiet", "Suppress debug logs")
  .action(async (opts) => {
    try {
      if (opts.dryRun) {
        // Validate config and show tools
        const runtime = await createMemoryRuntime({
          configPath: opts.config,
          scope: opts.scope,
          quiet: true,
        });
        const tools = runtime.listTools();
        console.log("✅ Config valid. Tools registered:");
        if (opts.scope) console.log(`   Scope: ${opts.scope}`);
        for (const tool of tools) {
          console.log(`  - ${tool.name}: ${tool.description.slice(0, 60)}...`);
        }
        console.log(`\nTotal: ${tools.length} tools`);
        console.log(`Events: ${runtime.api.getRegisteredEvents().join(", ")}`);
        console.log(`Hooks: ${runtime.api.getRegisteredHooks().join(", ")}`);
        return;
      }

      if (opts.sse) {
        const port = parseInt(opts.port, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          console.error("❌ Invalid port number. Must be 1-65535.");
          process.exit(1);
        }
        await startSseServer({
          configPath: opts.config,
          scope: opts.scope,
          quiet: opts.quiet ?? false,
          port,
          host: opts.host,
        });
      } else {
        await startMcpServer({
          configPath: opts.config,
          scope: opts.scope,
          quiet: opts.quiet ?? true,
        });
      }
    } catch (err) {
      console.error(`❌ Failed to start MCP server: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// ============================================================================
// mem list — List memories
// ============================================================================

program
  .command("list")
  .description("List recent memories")
  .option("-s, --scope <scope>", "Filter by scope")
  .option("-c, --category <cat>", "Filter by category")
  .option("-l, --limit <n>", "Max results", "10")
  .option("--offset <n>", "Pagination offset", "0")
  .option("--json", "JSON output")
  .option("--config <path>", "Config file path")
  .action(async (opts) => {
    try {
      const runtime = await createMemoryRuntime({ configPath: opts.config, quiet: true });
      const limit = parseInt(opts.limit, 10);
      const offset = parseInt(opts.offset, 10);
      if (isNaN(limit) || limit < 0) {
        console.error("❌ Invalid limit value.");
        process.exit(1);
      }
      if (isNaN(offset) || offset < 0) {
        console.error("❌ Invalid offset value.");
        process.exit(1);
      }
      const params: Record<string, unknown> = { limit, offset };
      if (opts.scope) params.scope = opts.scope;
      if (opts.category) params.category = opts.category;

      const result = await runtime.callTool("memory_list", params);
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        for (const item of result.content) {
          console.log(item.text);
        }
      }
    } catch (err) {
      console.error(`❌ ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// ============================================================================
// mem search — Search memories
// ============================================================================

program
  .command("search <query>")
  .description("Search memories using hybrid retrieval")
  .option("-s, --scope <scope>", "Filter by scope")
  .option("-l, --limit <n>", "Max results", "5")
  .option("--json", "JSON output")
  .option("--config <path>", "Config file path")
  .action(async (query, opts) => {
    try {
      const runtime = await createMemoryRuntime({ configPath: opts.config, quiet: true });
      const searchLimit = parseInt(opts.limit, 10);
      if (isNaN(searchLimit) || searchLimit < 1) {
        console.error("❌ Invalid limit value.");
        process.exit(1);
      }
      const params: Record<string, unknown> = {
        query,
        limit: searchLimit,
      };
      if (opts.scope) params.scope = opts.scope;

      const result = await runtime.callTool("memory_recall", params);
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        for (const item of result.content) {
          console.log(item.text);
        }
      }
    } catch (err) {
      console.error(`❌ ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// ============================================================================
// mem stats — Show statistics
// ============================================================================

program
  .command("stats")
  .description("Show memory statistics")
  .option("-s, --scope <scope>", "Filter by scope")
  .option("--json", "JSON output")
  .option("--config <path>", "Config file path")
  .action(async (opts) => {
    try {
      const runtime = await createMemoryRuntime({ configPath: opts.config, quiet: true });
      const params: Record<string, unknown> = {};
      if (opts.scope) params.scope = opts.scope;

      const result = await runtime.callTool("memory_stats", params);
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        for (const item of result.content) {
          console.log(item.text);
        }
      }
    } catch (err) {
      console.error(`❌ ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// ============================================================================
// mem store — Store a memory
// ============================================================================

program
  .command("store <text>")
  .description("Store a memory")
  .option("-i, --importance <n>", "Importance 0-1", "0.7")
  .option("-c, --category <cat>", "Category (preference|fact|decision|entity|other)")
  .option("-s, --scope <scope>", "Target scope")
  .option("--config <path>", "Config file path")
  .action(async (text, opts) => {
    try {
      const runtime = await createMemoryRuntime({ configPath: opts.config, quiet: true });
      const importance = parseFloat(opts.importance);
      if (isNaN(importance) || importance < 0 || importance > 1) {
        console.error("❌ Invalid importance value. Must be 0-1.");
        process.exit(1);
      }
      const params: Record<string, unknown> = {
        text,
        importance,
      };
      if (opts.category) params.category = opts.category;
      if (opts.scope) params.scope = opts.scope;

      const result = await runtime.callTool("memory_store", params);
      for (const item of result.content) {
        console.log(item.text);
      }
    } catch (err) {
      console.error(`❌ ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// ============================================================================
// mem delete — Delete a memory
// ============================================================================

program
  .command("delete <id>")
  .description("Delete a memory by ID")
  .option("--config <path>", "Config file path")
  .action(async (id, opts) => {
    try {
      const runtime = await createMemoryRuntime({ configPath: opts.config, quiet: true });
      const result = await runtime.callTool("memory_forget", { memoryId: id });
      for (const item of result.content) {
        console.log(item.text);
      }
    } catch (err) {
      console.error(`❌ ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// ============================================================================
// mem config — Configuration management
// ============================================================================

const configCmd = program
  .command("config")
  .description("Configuration management");

configCmd
  .command("init")
  .description("Create default config file")
  .option("-f, --force", "Overwrite existing config")
  .action((opts) => {
    try {
      const path = initConfig(opts.force);
      if (existsSync(path) && !opts.force) {
        console.log(`Config already exists: ${path}`);
        console.log("Use --force to overwrite.");
      } else {
        console.log(`✅ Config created: ${path}`);
        console.log("Edit it to add your API key and configure embedding/LLM settings.");
      }
    } catch (err) {
      console.error(`❌ ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

configCmd
  .command("show")
  .description("Show current configuration (with secrets masked)")
  .action(async () => {
    try {
      const path = getConfigPath();
      if (!existsSync(path)) {
        console.error(`No config found. Run 'mem config init' first.`);
        process.exit(1);
      }

      // Parse YAML, mask secrets in structure, re-serialize
      const raw = readFileSync(path, "utf-8");
      const parsed = YAML.parse(raw);
      const masked = maskSecrets(parsed);
      console.log(`# Config: ${path}\n`);
      console.log(YAML.stringify(masked));
    } catch (err) {
      console.error(`❌ ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

configCmd
  .command("path")
  .description("Show config file path")
  .action(() => {
    const path = getConfigPath();
    console.log(path);
    console.log(existsSync(path) ? "(exists)" : "(not found)");
  });

configCmd
  .command("validate")
  .description("Validate config file")
  .action(() => {
    try {
      const path = getConfigPath();
      const config = loadConfig(path);
      console.log(`✅ Config valid: ${path}`);
      console.log(`  Embedding model: ${config.embedding.model || "(default)"}`);
      console.log(`  DB path: ${config.dbPath || "(default)"}`);
      console.log(`  Smart extraction: ${config.smartExtraction !== false}`);
      console.log(`  Auto-capture: ${config.autoCapture !== false}`);
      console.log(`  Auto-recall: ${config.autoRecall === true}`);
    } catch (err) {
      console.error(`❌ Config invalid: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// ============================================================================
// mem doctor — Health check
// ============================================================================

program
  .command("doctor")
  .description("Run health checks")
  .option("--config <path>", "Config file path")
  .option("--mcp", "Test MCP protocol handshake")
  .action(async (opts) => {
    console.log("🔍 Running health checks...\n");
    let passed = 0;
    let failed = 0;

    // Check 1: Config file
    const configPath = opts.config || getConfigPath();
    if (existsSync(configPath)) {
      console.log(`✅ Config file: ${configPath}`);
      passed++;
    } else {
      console.log(`❌ Config file not found: ${configPath}`);
      console.log(`   Run 'mem config init' to create one.`);
      failed++;
    }

    // Check 2: Config parsing
    try {
      const config = loadConfig(opts.config);
      console.log(`✅ Config parses OK`);
      passed++;

      // Check 3: API key present
      const apiKey = config.embedding.apiKey;
      if (apiKey && String(apiKey).length > 0 && !String(apiKey).includes("${")) {
        console.log(`✅ Embedding API key present`);
        passed++;
      } else if (String(apiKey).includes("${")) {
        const varName = String(apiKey).match(/\$\{([^}]+)\}/)?.[1] || "UNKNOWN";
        if (process.env[varName]) {
          console.log(`✅ Embedding API key via env: ${varName}`);
          passed++;
        } else {
          console.log(`❌ Env var ${varName} not set`);
          failed++;
        }
      } else {
        console.log(`❌ Embedding API key missing`);
        failed++;
      }

      // Check 4: Plugin loads
      try {
        const runtime = await createMemoryRuntime({ config, quiet: true });
        const tools = runtime.listTools();
        console.log(`✅ Plugin loaded: ${tools.length} tools registered`);
        passed++;

        // Check 5: Tools list
        console.log(`✅ Tools: ${tools.map(t => t.name).join(", ")}`);
        passed++;
      } catch (err) {
        console.log(`❌ Plugin load failed: ${err instanceof Error ? err.message : err}`);
        failed++;
      }
    } catch (err) {
      console.log(`❌ Config error: ${err instanceof Error ? err.message : err}`);
      failed++;
    }

    console.log(`\n${"─".repeat(40)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  });

// ============================================================================
// Parse and run
// ============================================================================

program.parse(process.argv);

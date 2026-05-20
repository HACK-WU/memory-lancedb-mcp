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
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";

const program = new Command();

program
  .name("mem")
  .description("MCP Server wrapper for memory-lancedb-pro")
  .version("0.1.0");

// ============================================================================
// mem serve — Start MCP Server
// ============================================================================

program
  .command("serve")
  .description("Start MCP Server (stdio mode by default)")
  .option("-c, --config <path>", "Config file path")
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
          quiet: true,
        });
        const tools = runtime.listTools();
        console.log("✅ Config valid. Tools registered:");
        for (const tool of tools) {
          console.log(`  - ${tool.name}: ${tool.description.slice(0, 60)}...`);
        }
        console.log(`\nTotal: ${tools.length} tools`);
        console.log(`Events: ${runtime.api.getRegisteredEvents().join(", ")}`);
        console.log(`Hooks: ${runtime.api.getRegisteredHooks().join(", ")}`);
        return;
      }

      if (opts.sse) {
        await startSseServer({
          configPath: opts.config,
          quiet: opts.quiet ?? false,
          port: parseInt(opts.port, 10),
          host: opts.host,
        });
      } else {
        await startMcpServer({
          configPath: opts.config,
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
      const params: Record<string, unknown> = {
        limit: parseInt(opts.limit, 10),
        offset: parseInt(opts.offset, 10),
      };
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
      const params: Record<string, unknown> = {
        query,
        limit: parseInt(opts.limit, 10),
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
      const params: Record<string, unknown> = {
        text,
        importance: parseFloat(opts.importance),
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
  .action(() => {
    try {
      const path = getConfigPath();
      if (!existsSync(path)) {
        console.error(`No config found. Run 'mem config init' first.`);
        process.exit(1);
      }
      const raw = readFileSync(path, "utf-8");
      // Mask API keys
      const masked = raw.replace(
        /(apiKey:\s*["']?)([^"'\n]+)/g,
        (_match: string, prefix: string, value: string) => {
          if (value.startsWith("${")) return `${prefix}${value}`;
          if (value.length > 8) return `${prefix}${value.slice(0, 4)}...${value.slice(-4)}`;
          return `${prefix}****`;
        }
      );
      console.log(`# Config: ${path}\n`);
      console.log(masked);
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

/**
 * CLI Entry Point — 'mem' command
 *
 * Commands:
 *   mem serve          Start MCP Server (stdio mode)
 *   mem list           List memories
 *   mem search <q>     Search memories
 *   mem stats          Show statistics
 *   mem scope list     List all scopes and counts
 *   mem scope delete   Delete all memories in a scope (or --all to clear all)
 *   mem config init    Create default config
 *   mem config show    Show current config
 *   mem config path    Show config file path
 *   mem doctor         Health check
 */

import { Command } from "commander";
import { startMcpServer } from "./mcp-server.js";
import { startSseServer } from "./mcp-server-sse.js";
import { createMemoryRuntime, normalizeTags, type MemoryRuntime } from "./index.js";
import { initConfig, getConfigPath, loadConfig, getDefaultConfigDir } from "./config.js";
import YAML from "yaml";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const program = new Command();

// ============================================================================
// Helpers
// ============================================================================

/** Read version from package.json (works both in dev and after npm install) */
function getPackageVersion(): string {
  try {
    // __dirname equivalent for ESM
    const thisDir = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(thisDir, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Resolve dbPath like ~/path → /home/user/path */
function resolveDbPath(dbPath: string | undefined): string {
  const raw = (dbPath || "~/.local/share/memory-mcp/lancedb").trim();
  if (raw.startsWith("~/")) return join(homedir(), raw.slice(2));
  if (raw === "~") return join(homedir());
  return resolve(raw);
}

type MemoryStoreType = new (opts: { dbPath: string; vectorDim: number }) => {
  stats: () => Promise<{ scopeCounts: Record<string, number>; totalCount: number }>;
  bulkDelete: (scope: string[], ts?: number) => Promise<number>;
  store: (entry: Record<string, unknown>) => Promise<{ id: string }>;
  getById: (id: string, scopeFilter?: string[]) => Promise<{ id: string } | null>;
  delete: (id: string, scopeFilter?: string[]) => Promise<boolean>;
};

/** Dynamically load MemoryStore from npm package (with local dist fallback) */
async function loadMemoryStore(): Promise<MemoryStoreType> {
  const jiti = createJiti(import.meta.url);
  try {
    return jiti("memory-lancedb-pro/src/store").MemoryStore as MemoryStoreType;
  } catch {
    // @ts-ignore - fallback to local dist for development
    return (await import("../../dist/src/store.js")).MemoryStore as MemoryStoreType;
  }
}

/** Build tag prefix string (delegates normalization+validation to wrapper). */
function tagPrefix(tags: string | undefined): string {
  const normalized = normalizeTags(tags);
  if (!normalized) return "";
  return `【标签:${normalized}】`;
}

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
  .version(getPackageVersion());

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
  .option("--auth-token <token>", "SSE Bearer token for HTTP auth (overrides MEM_MCP_AUTH_TOKEN env var)")
  .option("--no-auth", "Disable SSE auth explicitly (only allowed when binding loopback host)")
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
        process.exit(0);
      }

      if (opts.sse) {
        const port = parseInt(opts.port, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          console.error("❌ Invalid port number. Must be 1-65535.");
          process.exit(1);
        }
        // commander 对 --no-auth 会设置 opts.auth = false；未传时 opts.auth 为 undefined。
        // 我们根据 opts.auth === false 识别是否显式传了 --no-auth。
        const noAuth = opts.auth === false;
        await startSseServer({
          configPath: opts.config,
          scope: opts.scope,
          quiet: opts.quiet ?? false,
          port,
          host: opts.host,
          authToken: opts.authToken,
          noAuth,
        });
      } else {
        // stdio 模式：鉴权选项无意义，仅提示
        if (opts.authToken || opts.auth === false) {
          console.error("ℹ️  --auth-token / --no-auth 仅在 SSE 模式（--sse）下生效，已忽略。");
        }
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
  .option("-t, --tags <tags>", "Filter by tags (comma-separated)")
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

      // If --tags is set, use recall with tag prefix for filtering
      if (opts.tags) {
        const prefix = tagPrefix(opts.tags);
        const params: Record<string, unknown> = { query: prefix, limit, tags: opts.tags };
        if (opts.scope) params.scope = opts.scope;
        if (opts.category) params.category = opts.category;
        const result = await runtime.callTool("memory_recall", params, { agentId: "system" });
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          for (const item of result.content) {
            console.log(item.text);
          }
        }
        process.exit(0);
      }

      const params: Record<string, unknown> = { limit, offset };
      if (opts.scope) params.scope = opts.scope;
      if (opts.category) params.category = opts.category;

      const result = await runtime.callTool("memory_list", params, { agentId: "system" });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        for (const item of result.content) {
          console.log(item.text);
        }
      }
      process.exit(0);
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
  .option("-t, --tags <tags>", "Filter by tags (comma-separated)")
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
      if (opts.tags) params.tags = opts.tags;

      const result = await runtime.callTool("memory_recall", params, { agentId: "system" });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        for (const item of result.content) {
          console.log(item.text);
        }
      }
      process.exit(0);
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

      const result = await runtime.callTool("memory_stats", params, { agentId: "system" });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        for (const item of result.content) {
          console.log(item.text);
        }
      }
      process.exit(0);
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
  .option("-t, --tags <tags>", "Comma-separated tags (e.g. profile,project,tech)")
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
      if (opts.tags) params.tags = opts.tags;
      if (opts.scope) params.scope = opts.scope;

      // CLI runs in cross-scope mode: pass agentId="system" so the plugin's
      // scope manager bypasses ACL checks, matching the MCP server behavior.
      const result = await runtime.callTool("memory_store", params, { agentId: "system" });
      for (const item of result.content) {
        console.log(item.text);
      }
      // Expose memory id on stdout for programmatic callers (e.g. scan-kb batchVectorize).
      // Human-readable text above is preserved; this single line is regex-friendly.
      const storedId = (result as { details?: { id?: string } }).details?.id;
      if (storedId) {
        console.log(`Memory ID: ${storedId}`);
      }
      // Force exit: createMemoryRuntime() initializes LanceDB connections and
      // may trigger background tasks (e.g. auto-compaction via gateway_start)
      // that keep the Node.js event loop alive. Without an explicit exit, the
      // process hangs after completing the CLI operation.
      process.exit(0);
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
      const result = await runtime.callTool("memory_forget", { memoryId: id }, { agentId: "system" });
      for (const item of result.content) {
        console.log(item.text);
      }
      process.exit(0);
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
      // Rerank info (note: loadConfig has already expanded env vars)
      const retCfg = config.retrieval || {};
      const rMode = (retCfg as Record<string, unknown>).rerank as string | undefined;
      const rKey = (retCfg as Record<string, unknown>).rerankApiKey as string | undefined;
      const rProvider = (retCfg as Record<string, unknown>).rerankProvider as string | undefined;
      if (rMode === "none") {
        console.log(`  Rerank: disabled (none)`);
      } else {
        const hasKey = rKey && String(rKey).length > 0;
        const keyStatus = hasKey ? "present" : "not set (lightweight fallback)";
        console.log(`  Rerank: ${rMode || "cross-encoder"} (provider=${rProvider || "jina"}, apiKey=${keyStatus})`);
      }
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
  .action(async (opts) => {
    console.log("🔍 Running health checks...\n");
    let passed = 0;
    let failed = 0;
    let warned = 0;

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

      // Check 4: Rerank configuration
      // Note: loadConfig() already expanded env vars, so raw ${...} references
      // are resolved to their actual values (or empty string if env var is unset).
      // We read the raw YAML separately to detect "configured but env var not set".
      const retrieval = config.retrieval || {};
      const rerankMode = (retrieval as Record<string, unknown>).rerank as string | undefined;
      const rerankApiKey = (retrieval as Record<string, unknown>).rerankApiKey as string | undefined;
      if (rerankMode === "none") {
        console.log(`ℹ️  Rerank: disabled (mode=none)`);
      } else if (rerankApiKey && String(rerankApiKey).length > 0) {
        const provider = (retrieval as Record<string, unknown>).rerankProvider as string || "jina";
        const model = (retrieval as Record<string, unknown>).rerankModel as string || "(default)";
        console.log(`✅ Rerank: ${rerankMode || "cross-encoder"} (provider=${provider}, model=${model})`);
        passed++;
      } else {
        const provider = (retrieval as Record<string, unknown>).rerankProvider as string || "jina";
        // Check the raw YAML to distinguish "never configured" vs "env var not set"
        let configSource = "no API key configured";
        try {
          const rawYaml = readFileSync(configPath, "utf-8");
          const match = rawYaml.match(/^[ \t]*rerankApiKey:[ \t]*"\$\{([^}]+)\}"$/m);
          if (match) {
            configSource = `env var ${match[1]} not set`;
          }
        } catch { /* ignore read errors, fall back to generic message */ }
        console.log(`ℹ️  Rerank: ${rerankMode || "cross-encoder"} (provider=${provider}) — ${configSource}, using lightweight cosine reranking`);
        passed++; // not a failure, lightweight reranking is valid
      }

      // Check 5: Plugin loads
      let runtime: MemoryRuntime | null = null;
      try {
        runtime = await createMemoryRuntime({ config, quiet: true });
        const tools = runtime.listTools();
        console.log(`✅ Plugin loaded: ${tools.length} tools registered`);
        passed++;

        // Check 6: Tools list
        console.log(`✅ Tools: ${tools.map(t => t.name).join(", ")}`);
        passed++;
      } catch (err) {
        console.log(`❌ Plugin load failed: ${err instanceof Error ? err.message : err}`);
        failed++;
      }

      // ====================================================================
      // Connectivity Tests (Checks 7-10)
      // Verify that configured external services are actually reachable.
      // Uses jiti to dynamically import plugin internals for standalone tests.
      // ====================================================================

      // Check 7: Embedding API — call the embedding service directly
      try {
        const embedJiti = createJiti(import.meta.url);
        const { createEmbedder } = embedJiti("memory-lancedb-pro/src/embedder") as {
          createEmbedder: (cfg: Record<string, unknown>) => { test(): Promise<{ success: boolean; error?: string; dimensions?: number }> };
        };
        const embedConfig: Record<string, unknown> = {
          provider: (config.embedding.provider as string) || "openai-compatible",
          apiKey: config.embedding.apiKey,
          model: (config.embedding.model as string) || "text-embedding-3-small",
          chunking: false, // disable chunking for a single-word test
        };
        if (config.embedding.baseURL) embedConfig.baseURL = config.embedding.baseURL;
        // Explicit dimensions are required for models not in the built-in EMBEDDING_DIMENSIONS table
        if (config.embedding.dimensions !== undefined) embedConfig.dimensions = config.embedding.dimensions;
        const embModel = embedConfig.model;

        const embedder = createEmbedder(embedConfig);
        const embStart = Date.now();
        const embResult = await embedder.test();
        const embMs = Date.now() - embStart;
        if (embResult.success) {
          console.log(`✅ Embedding API (${embModel}): OK (${embResult.dimensions}-dim vector, ${embMs}ms)`);
          passed++;
        } else {
          console.log(`❌ Embedding API (${embModel}): ${embResult.error}`);
          failed++;
        }
      } catch (err) {
        console.log(`❌ Embedding API: ${err instanceof Error ? err.message : err}`);
        failed++;
      }

      // Check 8: LanceDB read/write — store, read-back, delete a test entry
      try {
        const dbPath = resolveDbPath(config.dbPath);
        const vectorDim = config.embedding?.dimensions || 1536;
        const MemoryStore = await loadMemoryStore();
        const store = new MemoryStore({ dbPath, vectorDim });
        const zeroVector = new Array(vectorDim).fill(0);

        const dbStart = Date.now();
        const entry = await store.store({
          text: "_doctor_connectivity_test_",
          vector: zeroVector,
          category: "other",
          scope: "_doctor_test_",
          importance: 0,
        });
        let dbOk = false;
        try {
          const readBack = await store.getById(entry.id, ["_doctor_test_"]);
          dbOk = !!(readBack && readBack.id === entry.id);
          if (!dbOk) {
            console.log(`❌ LanceDB: write succeeded but read-back verification failed`);
            failed++;
          }
        } finally {
          // Always clean up test data, even if read-back threw an error
          await store.delete(entry.id, ["_doctor_test_"]).catch(() => {});
        }
        const dbMs = Date.now() - dbStart;

        if (dbOk) {
          console.log(`✅ LanceDB read/write: OK (${dbMs}ms) [test data cleaned up]`);
          passed++;
        }
      } catch (err) {
        console.log(`❌ LanceDB: ${err instanceof Error ? err.message : err}`);
        failed++;
      }

      // Check 9: LLM connectivity — only if smartExtraction is enabled AND llm model explicitly configured
      if (config.smartExtraction === false) {
        console.log(`⏭️  LLM: smartExtraction disabled, skipping`);
      } else if (!config.llm?.model) {
        console.log(`⏭️  LLM: no explicit llm.model configured, skipping (plugin auto-detects model at runtime)`);
      } else {
        try {
          const llmJiti = createJiti(import.meta.url);
          const { createLlmClient } = llmJiti("memory-lancedb-pro/src/llm-client") as {
            createLlmClient: (cfg: Record<string, unknown>) => {
              completeJson<T>(prompt: string, label?: string): Promise<T | null>;
              getLastError(): string | null;
            };
          };
          const llmModel = config.llm.model as string;
          // LLM apiKey fallback chain: llm.apiKey → embedding.apiKey (first element if array)
          const llmApiKey = typeof config.embedding.apiKey === "string"
            ? config.embedding.apiKey
            : (Array.isArray(config.embedding.apiKey) ? config.embedding.apiKey[0] : undefined);
          const llmConfig: Record<string, unknown> = {
            apiKey: (config.llm?.apiKey as string) || llmApiKey,
            model: llmModel,
            timeoutMs: 15000,
          };
          if (config.llm?.baseURL || config.embedding.baseURL) {
            llmConfig.baseURL = (config.llm?.baseURL as string) || (config.embedding.baseURL as string);
          }

          const llmClient = createLlmClient(llmConfig);
          const llmStart = Date.now();
          const llmResult = await llmClient.completeJson<{ status: string }>(
            'Reply with EXACTLY the JSON: {"status":"ok"}',
            "doctor-llm-test",
          );
          const llmMs = Date.now() - llmStart;
          if (llmResult && llmResult.status === "ok") {
            console.log(`✅ LLM (${llmModel}): OK (${llmMs}ms)`);
            passed++;
          } else if (llmResult) {
            console.log(`⚠️  LLM (${llmModel}): responded but unexpected output (${llmMs}ms)`);
            passed++;
          } else {
            const lastErr = llmClient.getLastError();
            console.log(`❌ LLM (${llmModel}): ${lastErr || "no response"} (${llmMs}ms)`);
            failed++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("timeout") || msg.includes("ETIMEDOUT") || msg.includes("AbortError")) {
            console.log(`⚠️  LLM: timed out (>15s), service may be slow but config is likely correct`);
            warned++;
          } else {
            console.log(`❌ LLM: ${msg}`);
            failed++;
          }
        }
      }

      // Check 10: Rerank API — test via memory_recall if rerank is configured
      try {
        const rerankMode = (config.retrieval as Record<string, unknown> | undefined)?.rerank as string | undefined;
        if (!rerankMode || rerankMode === "none") {
          console.log(`⏭️  Rerank: disabled (mode=none or unset), skipping`);
        } else {
          const rerankApiKey = (config.retrieval as Record<string, unknown> | undefined)?.rerankApiKey as string | undefined;
          if (!rerankApiKey || String(rerankApiKey).length === 0) {
            console.log(`ℹ️  Rerank: using lightweight cosine fallback (no API key configured)`);
          } else if (!runtime) {
            console.log(`⏭️  Rerank: skipped (plugin not loaded, cannot run recall)`);
          } else {
            const rerankStart = Date.now();
            const recallResult = await runtime.callTool("memory_recall", {
              query: "doctor connectivity test rerank",
              limit: 3,
            }, { agentId: "system" });
            const rerankMs = Date.now() - rerankStart;
            const hasError = recallResult.content.some(
              (c: { type: string; text: string }) =>
                typeof c.text === "string" && /Error/i.test(c.text),
            );
            const provider = (config.retrieval as Record<string, unknown> | undefined)?.rerankProvider as string || "jina";
            if (!hasError) {
              console.log(`✅ Rerank API (${provider}): OK (${rerankMs}ms)`);
              passed++;
            } else {
              console.log(`❌ Rerank API (${provider}): recall returned error (${rerankMs}ms)`);
              failed++;
            }
          }
        }
      } catch (err) {
        console.log(`❌ Rerank API: ${err instanceof Error ? err.message : err}`);
        failed++;
      }

    } catch (err) {
      console.log(`❌ Config error: ${err instanceof Error ? err.message : err}`);
      failed++;
    }

    console.log(`\n${"─".repeat(40)}`);
    console.log(`Results: ${passed} passed, ${failed} failed${warned > 0 ? `, ${warned} warning(s)` : ""}`);
    if (failed > 0) process.exit(1);
    process.exit(0);
  });

// ============================================================================
// mem scope — Scope management
// ============================================================================

const scopeCmd = program
  .command("scope")
  .description("Manage memory scopes (project isolation)");

scopeCmd
  .command("list")
  .description("List all memory scopes and their counts")
  .option("--config <path>", "Config file path")
  .action(async (opts) => {
    try {
      const configPath = opts.config || getConfigPath();
      const config = loadConfig(configPath);
      const dbPath = resolveDbPath(config.dbPath);
      const vectorDim = config.embedding?.dimensions || 1536;

      const MemoryStore = await loadMemoryStore();
      const store = new MemoryStore({ dbPath, vectorDim });

      const stats = await store.stats();

      console.log("Memory Scopes:");
      console.log("");
      console.log("  Scope                  Memories");
      console.log("  ─────────────────────  ────────");

      const entries = Object.entries(stats.scopeCounts).sort(
        ([, a], [, b]) => (b as number) - (a as number),
      );
      for (const [scope, count] of entries) {
        const padded = scope.padEnd(23);
        console.log(`  ${padded} ${count}`);
      }

      console.log("");
      console.log(`Total: ${stats.totalCount} memories across ${entries.length} scope(s)`);
      process.exit(0);
    } catch (err) {
      console.error(`❌ ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

scopeCmd
  .command("delete [scope]")
  .description("Delete all memories in a scope, or use --all to clear all scopes (requires confirmation)")
  .option("--all", "Delete all scopes (except global)")
  .option("--yes", "Skip confirmation prompt")
  .option("--dry-run", "Show what would be deleted without actually deleting")
  .option("--config <path>", "Config file path")
  .action(async (scope, opts) => {
    try {
      if (!scope && !opts.all) {
        console.error("❌ Must specify a scope name or use --all.");
        console.error("   Usage: mem scope delete <scope>");
        console.error("          mem scope delete --all");
        process.exit(1);
      }

      const configPath = opts.config || getConfigPath();
      const config = loadConfig(configPath);
      const dbPath = resolveDbPath(config.dbPath);
      const vectorDim = config.embedding?.dimensions || 1536;

      const MemoryStore = await loadMemoryStore();
      const store = new MemoryStore({ dbPath, vectorDim });

      const stats = await store.stats();

      // Determine which scopes to delete
      let scopesToDelete: string[];
      if (opts.all) {
        scopesToDelete = Object.keys(stats.scopeCounts).filter((s) => s !== "global");
        if (scopesToDelete.length === 0) {
          console.log("No scopes to delete (all memories are in global).");
          process.exit(0);
        }
      } else {
        if (scope === "global") {
          console.error("❌ Cannot delete the 'global' scope. It is system-reserved.");
          console.error("   Use --all to delete every scope except global.");
          process.exit(1);
        }
        scopesToDelete = [scope];
      }

      // Check if any scope has memories
      if (scopesToDelete.every((s) => (stats.scopeCounts[s] || 0) === 0)) {
        console.log("All target scopes have no memories. Nothing to delete.");
        process.exit(0);
      }

      // Calculate totals for display
      const totalCount = scopesToDelete.reduce((sum, s) => sum + (stats.scopeCounts[s] || 0), 0);

      if (opts.dryRun) {
        if (opts.all) {
          console.log(`DRY RUN: Would delete ${totalCount} memories across ${scopesToDelete.length} scope(s):`);
          for (const s of scopesToDelete) {
            console.log(`  - ${s}: ${stats.scopeCounts[s] || 0} memories`);
          }
        } else {
          console.log(`DRY RUN: Would delete ${totalCount} memories from scope "${scopesToDelete[0]}".`);
        }
        process.exit(0);
      }

      if (!opts.yes) {
        if (opts.all) {
          console.log(`⚠  This will permanently delete ${totalCount} memories across ${scopesToDelete.length} scope(s):`);
          for (const s of scopesToDelete) {
            console.log(`   - ${s}: ${stats.scopeCounts[s] || 0} memories`);
          }
          console.log("");
          console.log("   Run with --yes to confirm, or --dry-run to preview.");
        } else {
          console.log(`⚠  This will permanently delete ${totalCount} memories from scope "${scopesToDelete[0]}".`);
          console.log("   Run with --yes to confirm, or --dry-run to preview.");
        }
        process.exit(0);
      }

      const deleted = await store.bulkDelete(scopesToDelete);
      if (opts.all) {
        console.log(`✅ Deleted ${deleted} memories across ${scopesToDelete.length} scope(s).`);
      } else {
        console.log(`✅ Deleted ${deleted} memories from scope "${scopesToDelete[0]}".`);
      }
      process.exit(0);
    } catch (err) {
      console.error(`❌ ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// ============================================================================
// Parse and run
// ============================================================================

program.parse(process.argv);

/**
 * Configuration System
 *
 * Loads config from YAML file and maps it to the pluginConfig format
 * expected by memory-lancedb-pro's parsePluginConfig().
 *
 * Config resolution order:
 *   1. MEM_CONFIG_PATH env var
 *   2. ~/.config/memory-mcp/config.yaml
 *   3. ./config.yaml (current directory)
 *   4. Default minimal config
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import YAML from "yaml";

// ============================================================================
// Types
// ============================================================================

export interface MemConfig {
  dbPath?: string;
  embedding: {
    provider?: string;
    apiKey: string | string[];
    model?: string;
    baseURL?: string;
    dimensions?: number;
    requestDimensions?: number;
    omitDimensions?: boolean;
    taskQuery?: string;
    taskPassage?: string;
    normalized?: boolean;
    chunking?: boolean;
  };
  llm?: {
    auth?: string;
    apiKey?: string;
    model?: string;
    baseURL?: string;
    timeoutMs?: number;
  };
  autoCapture?: boolean;
  autoRecall?: boolean;
  autoRecallMinLength?: number;
  autoRecallMaxItems?: number;
  autoRecallMaxChars?: number;
  autoRecallTimeoutMs?: number;
  captureAssistant?: boolean;
  smartExtraction?: boolean;
  extractMinMessages?: number;
  extractMaxChars?: number;
  enableManagementTools?: boolean;
  sessionStrategy?: string;
  retrieval?: {
    mode?: string;
    vectorWeight?: number;
    bm25Weight?: number;
    minScore?: number;
    hardMinScore?: number;
    /** Rerank mode: "cross-encoder" (API-based, recommended), "lightweight" (local cosine), "none" (disabled) */
    rerank?: string;
    /** Rerank API provider: "jina", "siliconflow", "voyage", "pinecone", "dashscope", "tei" */
    rerankProvider?: string;
    /** Rerank model name (provider-specific, e.g. "jina-reranker-v3", "BAAI/bge-reranker-v2-m3") */
    rerankModel?: string;
    /** Rerank API endpoint URL */
    rerankEndpoint?: string;
    /** Rerank API key (supports ${ENV_VAR} syntax) */
    rerankApiKey?: string;
    /** Rerank API request timeout in milliseconds (default: 5000) */
    rerankTimeoutMs?: number;
    candidatePoolSize?: number;
    recencyHalfLifeDays?: number;
    recencyWeight?: number;
    filterNoise?: boolean;
    lengthNormAnchor?: number;
    timeDecayHalfLifeDays?: number;
    reinforcementFactor?: number;
    maxHalfLifeMultiplier?: number;
  };
  decay?: Record<string, unknown>;
  tier?: Record<string, unknown>;
  scopes?: {
    default?: string;
    definitions?: Record<string, { description: string }>;
    agentAccess?: Record<string, string[]>;
  };
  selfImprovement?: {
    enabled?: boolean;
    beforeResetNote?: boolean;
    skipSubagentBootstrap?: boolean;
    ensureLearningFiles?: boolean;
  };
  memoryReflection?: Record<string, unknown>;
  mdMirror?: { enabled?: boolean; dir?: string };
  admissionControl?: Record<string, unknown>;
  memoryCompaction?: Record<string, unknown>;
  sessionCompression?: Record<string, unknown>;
  extractionThrottle?: Record<string, unknown>;
  workspaceBoundary?: Record<string, unknown>;
}

// ============================================================================
// Config Path Resolution
// ============================================================================

const DEFAULT_CONFIG_DIR = join(homedir(), ".config", "memory-mcp");
const DEFAULT_CONFIG_PATH = join(DEFAULT_CONFIG_DIR, "config.yaml");

export function getConfigPath(): string {
  // 1. Environment variable override
  const envPath = process.env.MEM_CONFIG_PATH?.trim();
  if (envPath && envPath.length > 0) return envPath;

  // 2. Default location
  if (existsSync(DEFAULT_CONFIG_PATH)) return DEFAULT_CONFIG_PATH;

  // 3. Current directory fallback
  const cwdConfig = join(process.cwd(), "config.yaml");
  if (existsSync(cwdConfig)) return cwdConfig;

  // 4. Return default (may not exist yet)
  return DEFAULT_CONFIG_PATH;
}

export function getDefaultConfigDir(): string {
  return DEFAULT_CONFIG_DIR;
}

// ============================================================================
// Environment Variable Expansion
// ============================================================================

/**
 * Expand ${VAR_NAME} references in string values.
 * Supports nested objects recursively.
 */
function expandEnvVars(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
      const envVal = process.env[varName.trim()];
      if (envVal === undefined) {
        console.warn(`[mem:config] Warning: env var ${varName} is not set`);
        return "";
      }
      return envVal;
    });
  }
  if (Array.isArray(value)) {
    return value.map(expandEnvVars);
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = expandEnvVars(v);
    }
    return result;
  }
  return value;
}

// ============================================================================
// Config Loading
// ============================================================================

/**
 * Load and parse configuration from YAML file.
 * Returns the config object with env vars expanded.
 */
export function loadConfig(configPath?: string): MemConfig {
  const path = configPath || getConfigPath();

  if (!existsSync(path)) {
    throw new Error(
      `Configuration file not found: ${path}\n` +
      `Run 'mem config init' to create a default config, or set MEM_CONFIG_PATH env var.`
    );
  }

  const raw = readFileSync(path, "utf-8");
  let parsed: Record<string, unknown>;
  try {
    parsed = YAML.parse(raw) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`Failed to parse config YAML at ${path}: ${err}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Config file is empty or not an object: ${path}`);
  }

  // Expand env vars
  const expanded = expandEnvVars(parsed) as Record<string, unknown>;

  // Validate required fields
  if (!expanded.embedding || typeof expanded.embedding !== "object") {
    throw new Error(
      `Config missing required 'embedding' section.\n` +
      `At minimum, embedding.apiKey is required.`
    );
  }

  const embedding = expanded.embedding as Record<string, unknown>;
  if (!embedding.apiKey) {
    throw new Error(
      `Config missing required 'embedding.apiKey'.\n` +
      `Set it in config.yaml or use \${OPENAI_API_KEY} with the env var.`
    );
  }

  // Apply env var overrides
  if (process.env.MEM_DB_PATH) {
    expanded.dbPath = process.env.MEM_DB_PATH;
  }

  return expanded as unknown as MemConfig;
}

/**
 * Convert MemConfig to the pluginConfig format expected by memory-lancedb-pro.
 * The mapping is mostly 1:1 since our YAML schema mirrors the plugin schema.
 */
export function toPluginConfig(config: MemConfig): Record<string, unknown> {
  // Direct passthrough — the YAML schema intentionally mirrors pluginConfig
  return config as unknown as Record<string, unknown>;
}

// ============================================================================
// Config Initialization
// ============================================================================

const DEFAULT_CONFIG_TEMPLATE = `# memory-lancedb-mcp configuration
# Documentation: https://github.com/CortexReach/memory-lancedb-mcp

# Database storage path
dbPath: "~/.local/share/memory-mcp/lancedb"

# Embedding configuration (required)
embedding:
  # provider: "openai-compatible"
  apiKey: "\${OPENAI_API_KEY}"
  model: "text-embedding-3-small"
  baseURL: "https://api.openai.com/v1"
  # dimensions: 1536  # auto-detected from model

# LLM for Smart Extraction (optional, falls back to embedding config)
# llm:
#   apiKey: "\${OPENAI_API_KEY}"
#   model: "gpt-4o-mini"
#   baseURL: "https://api.openai.com/v1"

# Auto-capture: extract memories from conversations
autoCapture: true

# Auto-recall: inject memories before agent processing
# In MCP mode, recommend letting Agent call memory_recall explicitly
autoRecall: false

# Smart extraction: LLM-powered 6-category classification
smartExtraction: true
extractMinMessages: 2
extractMaxChars: 8000

# Management tools (memory_stats, memory_list, etc.)
enableManagementTools: true

# Session strategy (none recommended for MCP mode)
sessionStrategy: "none"

# Retrieval settings
retrieval:
  mode: "hybrid"
  vectorWeight: 0.7
  bm25Weight: 0.3
  filterNoise: true
  minScore: 0.3
  hardMinScore: 0.35
  # Rerank improves retrieval precision by re-scoring candidates with a cross-encoder model.
  # When rerankApiKey is not set, falls back to lightweight cosine similarity reranking.
  # Set rerank: "none" to disable reranking entirely.
  rerank: "cross-encoder"

  # --- Jina Reranker (recommended, high quality) ---
  # rerankProvider: "jina"
  # rerankModel: "jina-reranker-v3"
  # rerankEndpoint: "https://api.jina.ai/v1/rerank"
  # rerankApiKey: "\${JINA_API_KEY}"

  # --- SiliconFlow Reranker (Jina-compatible API) ---
  # rerankProvider: "siliconflow"
  # rerankModel: "BAAI/bge-reranker-v2-m3"
  # rerankEndpoint: "https://api.siliconflow.cn/v1/rerank"
  # rerankApiKey: "\${SILICONFLOW_API_KEY}"

  # --- DashScope Reranker (Alibaba Cloud, good for CJK) ---
  # rerankProvider: "dashscope"
  # rerankModel: "gte-rerank-v2"
  # rerankEndpoint: "https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank"
  # rerankApiKey: "\${DASHSCOPE_API_KEY}"

  # --- Voyage Reranker ---
  # rerankProvider: "voyage"
  # rerankModel: "rerank-3"
  # rerankEndpoint: "https://api.voyageai.com/v1/rerank"
  # rerankApiKey: "\${VOYAGE_API_KEY}"

  # --- Pinecone Reranker ---
  # rerankProvider: "pinecone"
  # rerankModel: "pinecone-rerank-v0"
  # rerankEndpoint: "https://api.pinecone.io/rerank"
  # rerankApiKey: "\${PINECONE_API_KEY}"

  # --- HuggingFace TEI (self-hosted) ---
  # rerankProvider: "tei"
  # rerankModel: "BAAI/bge-reranker-v2-m3"
  # rerankEndpoint: "http://localhost:8080/rerank"
  # rerankApiKey: ""

  # Rerank API timeout in ms (default: 5000)
  # rerankTimeoutMs: 5000

# Scope isolation
scopes:
  default: "global"

# Self-improvement governance
selfImprovement:
  enabled: true
  beforeResetNote: true
  ensureLearningFiles: true
`;

/**
 * Create default config file if it doesn't exist.
 * Returns the path where config was created.
 */
export function initConfig(force = false): string {
  const configPath = DEFAULT_CONFIG_PATH;

  if (existsSync(configPath) && !force) {
    return configPath; // Already exists
  }

  // Ensure directory
  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(configPath, DEFAULT_CONFIG_TEMPLATE, { encoding: "utf-8", mode: 0o600 });
  return configPath;
}

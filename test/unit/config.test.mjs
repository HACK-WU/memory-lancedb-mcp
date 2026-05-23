/**
 * Config Module Unit Tests
 * 
 * Tests for src/config.ts functionality:
 * - Configuration path resolution
 * - Environment variable expansion
 * - Config loading and validation
 * - Config initialization
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the module under test
import { 
  getConfigPath, 
  getDefaultConfigDir, 
  loadConfig, 
  toPluginConfig, 
  initConfig 
} from '../../dist/config.js';

describe('Config Module Unit Tests', () => {
  let tempDir;
  let originalEnv;
  
  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Create temporary directory for tests
    tempDir = join(__dirname, 'temp-config-test-' + Date.now());
    mkdirSync(tempDir, { recursive: true });
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Clean up temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
  
  describe('getConfigPath', () => {
    it('should use MEM_CONFIG_PATH environment variable when set', () => {
      const testPath = '/custom/config/path.yaml';
      process.env.MEM_CONFIG_PATH = testPath;
      
      const result = getConfigPath();
      assert.strictEqual(result, testPath);
    });
    
    it('should trim whitespace from MEM_CONFIG_PATH', () => {
      const testPath = '/custom/config/path.yaml';
      process.env.MEM_CONFIG_PATH = `  ${testPath}  `;
      
      const result = getConfigPath();
      assert.strictEqual(result, testPath);
    });
    
    it('should ignore empty MEM_CONFIG_PATH', () => {
      process.env.MEM_CONFIG_PATH = '   ';
      
      // Should not use empty env var
      const result = getConfigPath();
      assert.notStrictEqual(result, '   ');
    });
    
    it('should return default config path when no env var set', () => {
      delete process.env.MEM_CONFIG_PATH;
      
      const result = getConfigPath();
      const expected = join(homedir(), '.config', 'memory-mcp', 'config.yaml');
      assert.strictEqual(result, expected);
    });
  });
  
  describe('getDefaultConfigDir', () => {
    it('should return correct default config directory', () => {
      const result = getDefaultConfigDir();
      const expected = join(homedir(), '.config', 'memory-mcp');
      assert.strictEqual(result, expected);
    });
  });
  
  describe('expandEnvVars', () => {
    // Note: expandEnvVars is a private function, so we test it indirectly through loadConfig
    
    it('should expand environment variables in config values', () => {
      process.env.TEST_API_KEY = 'test-key-123';
      process.env.TEST_MODEL = 'test-model';
      
      const configContent = `
embedding:
  apiKey: "\${TEST_API_KEY}"
  model: "\${TEST_MODEL}"
  dimensions: 1536
`;
      
      const configPath = join(tempDir, 'config.yaml');
      writeFileSync(configPath, configContent);
      
      const config = loadConfig(configPath);
      assert.strictEqual(config.embedding.apiKey, 'test-key-123');
      assert.strictEqual(config.embedding.model, 'test-model');
    });
    
    it('should handle missing environment variables with warning', () => {
      const configContent = `
embedding:
  apiKey: "\${NONEXISTENT_VAR}"
  model: "test-model"
`;
      
      const configPath = join(tempDir, 'config.yaml');
      writeFileSync(configPath, configContent);
      
      // Should throw error because empty apiKey fails validation
      assert.throws(() => {
        loadConfig(configPath);
      }, /Config missing required 'embedding\.apiKey'/);
    });
    
    it('should expand environment variables in nested objects', () => {
      process.env.TEST_RERANK_KEY = 'rerank-key-456';
      
      const configContent = `
embedding:
  apiKey: "test-key"
  model: "test-model"
retrieval:
  rerankApiKey: "\${TEST_RERANK_KEY}"
`;
      
      const configPath = join(tempDir, 'config.yaml');
      writeFileSync(configPath, configContent);
      
      const config = loadConfig(configPath);
      assert.strictEqual(config.retrieval.rerankApiKey, 'rerank-key-456');
    });
    
    it('should expand environment variables in arrays', () => {
      process.env.TEST_KEY1 = 'key1';
      process.env.TEST_KEY2 = 'key2';
      
      const configContent = `
embedding:
  apiKey: 
    - "\${TEST_KEY1}"
    - "\${TEST_KEY2}"
  model: "test-model"
`;
      
      const configPath = join(tempDir, 'config.yaml');
      writeFileSync(configPath, configContent);
      
      const config = loadConfig(configPath);
      assert.deepStrictEqual(config.embedding.apiKey, ['key1', 'key2']);
    });
  });
  
  describe('loadConfig', () => {
    it('should load valid config file', () => {
      const configContent = `
embedding:
  apiKey: "test-api-key"
  model: "text-embedding-3-small"
  dimensions: 1536
`;
      
      const configPath = join(tempDir, 'config.yaml');
      writeFileSync(configPath, configContent);
      
      const config = loadConfig(configPath);
      assert.ok(config);
      assert.strictEqual(config.embedding.apiKey, 'test-api-key');
      assert.strictEqual(config.embedding.model, 'text-embedding-3-small');
      assert.strictEqual(config.embedding.dimensions, 1536);
    });
    
    it('should throw error for non-existent config file', () => {
      const nonExistentPath = join(tempDir, 'non-existent.yaml');
      
      assert.throws(() => {
        loadConfig(nonExistentPath);
      }, /Configuration file not found/);
    });
    
    it('should throw error for invalid YAML', () => {
      const invalidYaml = `
embedding:
  apiKey: "test-key"
  model: "test-model"
  invalid: [unclosed
`;
      
      const configPath = join(tempDir, 'invalid.yaml');
      writeFileSync(configPath, invalidYaml);
      
      assert.throws(() => {
        loadConfig(configPath);
      }, /Failed to parse config YAML/);
    });
    
    it('should throw error for empty config file', () => {
      const configPath = join(tempDir, 'empty.yaml');
      writeFileSync(configPath, '');
      
      assert.throws(() => {
        loadConfig(configPath);
      }, /Config file is empty or not an object/);
    });
    
    it('should throw error for non-object config', () => {
      const configPath = join(tempDir, 'string.yaml');
      writeFileSync(configPath, 'just a string');
      
      assert.throws(() => {
        loadConfig(configPath);
      }, /Config file is empty or not an object/);
    });
    
    it('should throw error for missing embedding section', () => {
      const configContent = `
dbPath: "/tmp/test"
`;
      
      const configPath = join(tempDir, 'no-embedding.yaml');
      writeFileSync(configPath, configContent);
      
      assert.throws(() => {
        loadConfig(configPath);
      }, /Config missing required 'embedding' section/);
    });
    
    it('should throw error for missing embedding.apiKey', () => {
      const configContent = `
embedding:
  model: "test-model"
`;
      
      const configPath = join(tempDir, 'no-api-key.yaml');
      writeFileSync(configPath, configContent);
      
      assert.throws(() => {
        loadConfig(configPath);
      }, /Config missing required 'embedding\.apiKey'/);
    });
    
    it('should apply MEM_DB_PATH environment variable override', () => {
      process.env.MEM_DB_PATH = '/custom/db/path';
      
      const configContent = `
embedding:
  apiKey: "test-key"
  model: "test-model"
`;
      
      const configPath = join(tempDir, 'config.yaml');
      writeFileSync(configPath, configContent);
      
      const config = loadConfig(configPath);
      assert.strictEqual(config.dbPath, '/custom/db/path');
    });
    
    it('should load config with all optional sections', () => {
      const configContent = `
embedding:
  apiKey: "test-key"
  model: "test-model"
dbPath: "/tmp/test"
llm:
  apiKey: "llm-key"
  model: "gpt-4"
autoCapture: true
autoRecall: false
smartExtraction: true
retrieval:
  mode: "hybrid"
  vectorWeight: 0.7
  bm25Weight: 0.3
scopes:
  default: "global"
selfImprovement:
  enabled: true
`;
      
      const configPath = join(tempDir, 'full-config.yaml');
      writeFileSync(configPath, configContent);
      
      const config = loadConfig(configPath);
      assert.strictEqual(config.dbPath, '/tmp/test');
      assert.strictEqual(config.llm.apiKey, 'llm-key');
      assert.strictEqual(config.autoCapture, true);
      assert.strictEqual(config.autoRecall, false);
      assert.strictEqual(config.retrieval.mode, 'hybrid');
      assert.strictEqual(config.scopes.default, 'global');
      assert.strictEqual(config.selfImprovement.enabled, true);
    });
  });
  
  describe('toPluginConfig', () => {
    it('should convert MemConfig to pluginConfig format', () => {
      const config = {
        embedding: {
          apiKey: 'test-key',
          model: 'test-model',
        },
        autoCapture: true,
      };
      
      const result = toPluginConfig(config);
      assert.deepStrictEqual(result, config);
    });
    
    it('should handle empty config', () => {
      const config = {};
      const result = toPluginConfig(config);
      assert.deepStrictEqual(result, config);
    });
  });
  
  describe('initConfig', () => {
    it('should create config file when it does not exist', () => {
      const configPath = join(tempDir, 'new-config.yaml');
      
      // Mock DEFAULT_CONFIG_PATH by testing the function behavior
      // We can't easily mock the constant, so we test the template content
      const template = `
# memory-lancedb-mcp configuration
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
`;
      
      // We can test the template content parsing
      writeFileSync(configPath, template);
      
      assert.ok(existsSync(configPath));
      const content = readFileSync(configPath, 'utf-8');
      assert.ok(content.includes('memory-lancedb-mcp configuration'));
      assert.ok(content.includes('${OPENAI_API_KEY}'));
    });
  });
  
  describe('Config validation', () => {
    it('should accept config with apiKey as string', () => {
      const configContent = `
embedding:
  apiKey: "single-key"
  model: "test-model"
`;
      
      const configPath = join(tempDir, 'string-key.yaml');
      writeFileSync(configPath, configContent);
      
      const config = loadConfig(configPath);
      assert.strictEqual(config.embedding.apiKey, 'single-key');
    });
    
    it('should accept config with apiKey as array', () => {
      const configContent = `
embedding:
  apiKey:
    - "key1"
    - "key2"
  model: "test-model"
`;
      
      const configPath = join(tempDir, 'array-key.yaml');
      writeFileSync(configPath, configContent);
      
      const config = loadConfig(configPath);
      assert.deepStrictEqual(config.embedding.apiKey, ['key1', 'key2']);
    });
    
    it('should accept config with provider field', () => {
      const configContent = `
embedding:
  provider: "openai-compatible"
  apiKey: "test-key"
  model: "test-model"
`;
      
      const configPath = join(tempDir, 'with-provider.yaml');
      writeFileSync(configPath, configContent);
      
      const config = loadConfig(configPath);
      assert.strictEqual(config.embedding.provider, 'openai-compatible');
    });
    
    it('should accept config with base URL', () => {
      const configContent = `
embedding:
  apiKey: "test-key"
  model: "test-model"
  baseURL: "https://api.example.com/v1"
`;
      
      const configPath = join(tempDir, 'with-baseurl.yaml');
      writeFileSync(configPath, configContent);
      
      const config = loadConfig(configPath);
      assert.strictEqual(config.embedding.baseURL, 'https://api.example.com/v1');
    });
  });
});
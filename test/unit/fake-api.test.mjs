/**
 * FakeOpenClawApi Unit Tests
 * 
 * Tests for src/fake-api.ts functionality:
 * - Constructor and initialization
 * - Path resolution
 * - Tool registration and management
 * - Event system
 * - Hook system
 * - CLI registration
 * - Tool calling
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';

// Import the module under test
import { FakeOpenClawApi } from '../../dist/fake-api.js';

describe('FakeOpenClawApi Unit Tests', () => {
  let api;
  let originalConsole;
  
  beforeEach(() => {
    // Mock console to suppress logs during tests
    originalConsole = { ...console };
    console.debug = () => {};
    console.info = () => {};
    console.warn = () => {};
    console.error = () => {};
    
    // Create fresh API instance
    api = new FakeOpenClawApi({
      pluginConfig: {
        embedding: {
          apiKey: 'test-key',
          model: 'test-model',
        },
      },
      quiet: true,
    });
  });
  
  afterEach(() => {
    // Restore console
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });
  
  describe('Constructor', () => {
    it('should initialize with pluginConfig', () => {
      assert.deepStrictEqual(api.pluginConfig, {
        embedding: {
          apiKey: 'test-key',
          model: 'test-model',
        },
      });
    });
    
    it('should use provided homeDir', () => {
      const customHome = '/custom/home';
      const customApi = new FakeOpenClawApi({
        pluginConfig: {},
        homeDir: customHome,
      });
      
      assert.strictEqual(customApi.resolvePath('~/test'), resolve(customHome, 'test'));
    });
    
    it('should use system homeDir when not provided', () => {
      assert.strictEqual(api.resolvePath('~/test'), resolve(homedir(), 'test'));
    });
    
    it('should create logger with all methods', () => {
      assert.ok(api.logger.debug);
      assert.ok(api.logger.info);
      assert.ok(api.logger.warn);
      assert.ok(api.logger.error);
    });
  });
  
  describe('Path Resolution', () => {
    it('should resolve ~/ paths', () => {
      const result = api.resolvePath('~/documents/file.txt');
      assert.strictEqual(result, resolve(homedir(), 'documents/file.txt'));
    });
    
    it('should resolve ~ alone', () => {
      const result = api.resolvePath('~');
      assert.strictEqual(result, resolve(homedir(), '.'));
    });
    
    it('should handle absolute paths', () => {
      const result = api.resolvePath('/absolute/path');
      assert.strictEqual(result, '/absolute/path');
    });
    
    it('should handle relative paths', () => {
      const result = api.resolvePath('relative/path');
      assert.strictEqual(result, resolve(homedir(), 'relative/path'));
    });
    
    it('should trim whitespace', () => {
      const result = api.resolvePath('  ~/test  ');
      assert.strictEqual(result, resolve(homedir(), 'test'));
    });
    
    it('should return non-string values as-is', () => {
      assert.strictEqual(api.resolvePath(null), null);
      assert.strictEqual(api.resolvePath(undefined), undefined);
      assert.strictEqual(api.resolvePath(123), 123);
    });
    
    it('should handle Windows absolute paths', () => {
      const result = api.resolvePath('C:\\Users\\test');
      assert.strictEqual(result, 'C:\\Users\\test');
    });
  });
  
  describe('Tool Registration', () => {
    it('should register tool with valid factory', () => {
      const factory = (ctx) => ({
        name: 'test-tool',
        description: 'A test tool',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ content: [{ type: 'text', text: 'result' }] }),
      });
      
      api.registerTool(factory);
      
      assert.deepStrictEqual(api.getToolNames(), ['test-tool']);
    });
    
    it('should not register tool with missing name', () => {
      const factory = (ctx) => ({
        description: 'A tool without name',
        parameters: {},
        execute: async () => ({ content: [] }),
      });
      
      api.registerTool(factory);
      
      assert.deepStrictEqual(api.getToolNames(), []);
    });
    
    it('should handle factory that throws during preview', () => {
      const factory = (ctx) => {
        throw new Error('Factory error');
      };
      
      // Should not throw
      api.registerTool(factory);
      
      assert.deepStrictEqual(api.getToolNames(), []);
    });
    
    it('should register multiple tools', () => {
      const factory1 = (ctx) => ({
        name: 'tool-1',
        description: 'First tool',
        parameters: {},
        execute: async () => ({ content: [] }),
      });
      
      const factory2 = (ctx) => ({
        name: 'tool-2',
        description: 'Second tool',
        parameters: {},
        execute: async () => ({ content: [] }),
      });
      
      api.registerTool(factory1);
      api.registerTool(factory2);
      
      const names = api.getToolNames();
      assert.ok(names.includes('tool-1'));
      assert.ok(names.includes('tool-2'));
      assert.strictEqual(names.length, 2);
    });
  });
  
  describe('Event System', () => {
    it('should register event handler', () => {
      const handler = () => {};
      
      api.on('test-event', handler);
      
      assert.deepStrictEqual(api.getRegisteredEvents(), ['test-event']);
    });
    
    it('should register multiple handlers for same event', () => {
      const handler1 = () => {};
      const handler2 = () => {};
      
      api.on('test-event', handler1);
      api.on('test-event', handler2);
      
      assert.deepStrictEqual(api.getRegisteredEvents(), ['test-event']);
    });
    
    it('should emit event to handlers', async () => {
      let receivedPayload = null;
      let receivedCtx = null;
      
      api.on('test-event', (payload, ctx) => {
        receivedPayload = payload;
        receivedCtx = ctx;
      });
      
      const payload = { data: 'test' };
      const ctx = { agentId: 'test' };
      
      await api.emitEvent('test-event', payload, ctx);
      
      assert.deepStrictEqual(receivedPayload, payload);
      assert.deepStrictEqual(receivedCtx, ctx);
    });
    
    it('should collect results from handlers', async () => {
      api.on('test-event', () => 'result1');
      api.on('test-event', () => 'result2');
      
      const results = await api.emitEvent('test-event', {});
      
      assert.deepStrictEqual(results, ['result1', 'result2']);
    });
    
    it('should handle handlers that return undefined', async () => {
      api.on('test-event', () => undefined);
      api.on('test-event', () => 'result');
      
      const results = await api.emitEvent('test-event', {});
      
      assert.deepStrictEqual(results, ['result']);
    });
    
    it('should handle handler errors gracefully', async () => {
      api.on('test-event', () => {
        throw new Error('Handler error');
      });
      api.on('test-event', () => 'result');
      
      const results = await api.emitEvent('test-event', {});
      
      assert.deepStrictEqual(results, ['result']);
    });
    
    it('should sort handlers by priority', async () => {
      const order = [];
      
      api.on('test-event', () => order.push('low'), { priority: 10 });
      api.on('test-event', () => order.push('high'), { priority: 1 });
      api.on('test-event', () => order.push('medium'), { priority: 5 });
      
      await api.emitEvent('test-event', {});
      
      assert.deepStrictEqual(order, ['high', 'medium', 'low']);
    });
    
    it('should handle events with no handlers', async () => {
      const results = await api.emitEvent('nonexistent-event', {});
      assert.deepStrictEqual(results, []);
    });
  });
  
  describe('Hook System', () => {
    it('should register hook handler', () => {
      const handler = () => {};
      
      api.registerHook('test-hook', handler);
      
      assert.deepStrictEqual(api.getRegisteredHooks(), ['test-hook']);
    });
    
    it('should trigger hook handlers', async () => {
      let receivedPayload = null;
      
      api.registerHook('test-hook', (payload) => {
        receivedPayload = payload;
      });
      
      const payload = { data: 'test' };
      await api.triggerHook('test-hook', payload);
      
      assert.deepStrictEqual(receivedPayload, payload);
    });
    
    it('should handle hook handler errors gracefully', async () => {
      api.registerHook('test-hook', () => {
        throw new Error('Hook error');
      });
      
      // Should not throw
      await api.triggerHook('test-hook', {});
    });
    
    it('should handle hooks with no handlers', async () => {
      // Should not throw
      await api.triggerHook('nonexistent-hook', {});
    });
  });
  
  describe('CLI Registration', () => {
    it('should register CLI instance', () => {
      const cliInstance = { command: () => {} };
      
      api.registerCli(cliInstance);
      
      assert.strictEqual(api.getCliInstance(), cliInstance);
    });
    
    it('should return null when no CLI registered', () => {
      assert.strictEqual(api.getCliInstance(), null);
    });
  });
  
  describe('Tool Calling', () => {
    beforeEach(() => {
      // Register a test tool
      const factory = (ctx) => ({
        name: 'test-tool',
        description: 'A test tool',
        parameters: { type: 'object', properties: {} },
        execute: async (callId, params, signal, onUpdate, runtimeCtx) => ({
          content: [{ type: 'text', text: `Result: ${params.input}` }],
          details: { callId, runtimeCtx },
        }),
      });
      
      api.registerTool(factory);
    });
    
    it('should call tool by name', async () => {
      const result = await api.callTool('test-tool', { input: 'hello' });
      
      assert.strictEqual(result.content[0].text, 'Result: hello');
    });
    
    it('should throw for unknown tool', async () => {
      await assert.rejects(
        () => api.callTool('unknown-tool', {}),
        /Unknown tool: unknown-tool/
      );
    });
    
    it('should provide default context', async () => {
      const result = await api.callTool('test-tool', { input: 'hello' });
      
      assert.strictEqual(result.details.runtimeCtx.agentId, 'main');
      assert.ok(result.details.runtimeCtx.sessionKey.startsWith('session-'));
    });
    
    it('should use provided context', async () => {
      const ctx = { agentId: 'test-agent', sessionKey: 'test-session' };
      const result = await api.callTool('test-tool', { input: 'hello' }, ctx);
      
      assert.strictEqual(result.details.runtimeCtx.agentId, 'test-agent');
      assert.strictEqual(result.details.runtimeCtx.sessionKey, 'test-session');
    });
  });
  
  describe('Tool Definitions', () => {
    beforeEach(() => {
      // Register test tools
      const factory1 = (ctx) => ({
        name: 'tool-1',
        description: 'First tool',
        parameters: { type: 'object', properties: { input: { type: 'string' } } },
        execute: async () => ({ content: [] }),
      });
      
      const factory2 = (ctx) => ({
        name: 'tool-2',
        description: 'Second tool',
        parameters: { type: 'object', properties: { value: { type: 'number' } } },
        execute: async () => ({ content: [] }),
      });
      
      api.registerTool(factory1);
      api.registerTool(factory2);
    });
    
    it('should get tool definition by name', () => {
      const def = api.getToolDefinition('tool-1');
      
      assert.strictEqual(def.name, 'tool-1');
      assert.strictEqual(def.description, 'First tool');
      assert.deepStrictEqual(def.parameters, { type: 'object', properties: { input: { type: 'string' } } });
    });
    
    it('should return undefined for unknown tool', () => {
      const def = api.getToolDefinition('unknown-tool');
      assert.strictEqual(def, undefined);
    });
    
    it('should get all tool definitions', () => {
      const defs = api.getAllToolDefinitions();
      
      assert.strictEqual(defs.length, 2);
      assert.ok(defs.some(d => d.name === 'tool-1'));
      assert.ok(defs.some(d => d.name === 'tool-2'));
    });
    
    it('should handle factory that throws during definition', () => {
      const brokenFactory = (ctx) => {
        throw new Error('Broken factory');
      };
      
      api.registerTool(brokenFactory);
      
      const defs = api.getAllToolDefinitions();
      assert.strictEqual(defs.length, 2); // Broken factory should be skipped
    });
  });
  
  describe('Additional Properties', () => {
    it('should allow arbitrary properties', () => {
      api.customProperty = 'custom value';
      assert.strictEqual(api.customProperty, 'custom value');
    });
    
    it('should have runtime property', () => {
      assert.strictEqual(api.runtime, undefined);
    });
    
    it('should have config property', () => {
      assert.deepStrictEqual(api.config, { agents: { list: [] } });
    });
  });
});
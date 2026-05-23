/**
 * Lifecycle Module Unit Tests
 * 
 * Tests for src/lifecycle.ts functionality:
 * - Auto-recall triggering
 * - Auto-capture triggering
 * - Session end triggering
 * - Message received triggering
 * - Context handling
 * - Result processing
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Import the module under test
import { 
  triggerAutoRecall, 
  triggerAutoCapture, 
  triggerSessionEnd, 
  triggerMessageReceived 
} from '../../dist/lifecycle.js';

// Mock FakeOpenClawApi
class MockFakeOpenClawApi {
  constructor() {
    this.events = [];
    this.eventHandlers = new Map();
  }
  
  async emitEvent(eventName, event, context) {
    this.events.push({ eventName, event, context });
    
    // Simulate handler results
    const handlers = this.eventHandlers.get(eventName) || [];
    const results = [];
    
    for (const handler of handlers) {
      const result = await handler(event, context);
      results.push(result);
    }
    
    return results;
  }
  
  on(eventName, handler) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName).push(handler);
  }
}

describe('Lifecycle Module Unit Tests', () => {
  let mockApi;
  
  beforeEach(() => {
    mockApi = new MockFakeOpenClawApi();
  });
  
  describe('triggerAutoRecall', () => {
    it('should trigger before_prompt_build event', async () => {
      const prompt = 'Test prompt';
      const context = { agentId: 'test-agent', sessionKey: 'test-session' };
      
      await triggerAutoRecall(mockApi, prompt, context);
      
      assert.strictEqual(mockApi.events.length, 1);
      assert.strictEqual(mockApi.events[0].eventName, 'before_prompt_build');
      assert.strictEqual(mockApi.events[0].event.prompt, prompt);
      assert.strictEqual(mockApi.events[0].event.content, prompt);
      assert.strictEqual(mockApi.events[0].context.agentId, 'test-agent');
      assert.strictEqual(mockApi.events[0].context.sessionKey, 'test-session');
    });
    
    it('should use default context when not provided', async () => {
      const prompt = 'Test prompt';
      
      await triggerAutoRecall(mockApi, prompt);
      
      assert.strictEqual(mockApi.events[0].context.agentId, 'main');
      assert.ok(mockApi.events[0].context.sessionKey.startsWith('session-'));
    });
    
    it('should return null prependContext when no handlers return context', async () => {
      const prompt = 'Test prompt';
      
      const result = await triggerAutoRecall(mockApi, prompt);
      
      assert.strictEqual(result.prependContext, null);
      assert.strictEqual(result.ephemeral, undefined);
    });
    
    it('should collect prependContext from handlers', async () => {
      const prompt = 'Test prompt';
      const expectedContext = 'Relevant memory context';
      
      // Register a handler that returns prependContext
      mockApi.on('before_prompt_build', () => {
        return { prependContext: expectedContext };
      });
      
      const result = await triggerAutoRecall(mockApi, prompt);
      
      assert.strictEqual(result.prependContext, expectedContext);
      assert.strictEqual(result.ephemeral, true);
    });
    
    it('should concatenate multiple prependContext values', async () => {
      const prompt = 'Test prompt';
      
      // Register multiple handlers
      mockApi.on('before_prompt_build', () => {
        return { prependContext: 'Context 1' };
      });
      mockApi.on('before_prompt_build', () => {
        return { prependContext: 'Context 2' };
      });
      
      const result = await triggerAutoRecall(mockApi, prompt);
      
      assert.strictEqual(result.prependContext, 'Context 1\n\nContext 2');
      assert.strictEqual(result.ephemeral, true);
    });
    
    it('should ignore empty prependContext', async () => {
      const prompt = 'Test prompt';
      
      // Register handler with empty context
      mockApi.on('before_prompt_build', () => {
        return { prependContext: '' };
      });
      
      const result = await triggerAutoRecall(mockApi, prompt);
      
      assert.strictEqual(result.prependContext, null);
    });
    
    it('should ignore non-string prependContext', async () => {
      const prompt = 'Test prompt';
      
      // Register handler with non-string context
      mockApi.on('before_prompt_build', () => {
        return { prependContext: 123 };
      });
      
      const result = await triggerAutoRecall(mockApi, prompt);
      
      assert.strictEqual(result.prependContext, null);
    });
    
    it('should generate session key when not provided', async () => {
      const prompt = 'Test prompt';
      
      await triggerAutoRecall(mockApi, prompt);
      
      assert.ok(mockApi.events[0].event.sessionKey.startsWith('session-'));
      assert.ok(mockApi.events[0].context.sessionKey.startsWith('session-'));
    });
  });
  
  describe('triggerAutoCapture', () => {
    it('should trigger agent_end event', async () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ];
      const context = { agentId: 'test-agent', sessionKey: 'test-session' };
      
      await triggerAutoCapture(mockApi, messages, context);
      
      assert.strictEqual(mockApi.events.length, 1);
      assert.strictEqual(mockApi.events[0].eventName, 'agent_end');
      assert.deepStrictEqual(mockApi.events[0].event.messages, messages);
      assert.strictEqual(mockApi.events[0].event.success, true);
      assert.strictEqual(mockApi.events[0].context.agentId, 'test-agent');
      assert.strictEqual(mockApi.events[0].context.sessionKey, 'test-session');
    });
    
    it('should use default context when not provided', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      
      await triggerAutoCapture(mockApi, messages);
      
      assert.strictEqual(mockApi.events[0].context.agentId, 'main');
      assert.ok(mockApi.events[0].context.sessionKey.startsWith('session-'));
    });
    
    it('should use provided success flag', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      
      await triggerAutoCapture(mockApi, messages, {}, false);
      
      assert.strictEqual(mockApi.events[0].event.success, false);
    });
    
    it('should default success to true', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      
      await triggerAutoCapture(mockApi, messages);
      
      assert.strictEqual(mockApi.events[0].event.success, true);
    });
    
    it('should generate session key when not provided', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      
      await triggerAutoCapture(mockApi, messages);
      
      assert.ok(mockApi.events[0].event.sessionKey.startsWith('session-'));
      assert.ok(mockApi.events[0].context.sessionKey.startsWith('session-'));
    });
  });
  
  describe('triggerSessionEnd', () => {
    it('should trigger session_end event', async () => {
      const context = { agentId: 'test-agent', sessionKey: 'test-session' };
      
      await triggerSessionEnd(mockApi, context);
      
      assert.strictEqual(mockApi.events.length, 1);
      assert.strictEqual(mockApi.events[0].eventName, 'session_end');
      assert.strictEqual(mockApi.events[0].event.sessionKey, 'test-session');
      assert.strictEqual(mockApi.events[0].context.agentId, 'test-agent');
      assert.strictEqual(mockApi.events[0].context.sessionKey, 'test-session');
    });
    
    it('should use default context when not provided', async () => {
      await triggerSessionEnd(mockApi);
      
      assert.strictEqual(mockApi.events[0].context.agentId, 'main');
      assert.ok(mockApi.events[0].context.sessionKey.startsWith('session-'));
    });
    
    it('should handle undefined session key in context', async () => {
      const context = { agentId: 'test-agent' };
      
      await triggerSessionEnd(mockApi, context);
      
      assert.strictEqual(mockApi.events[0].event.sessionKey, undefined);
      assert.ok(mockApi.events[0].context.sessionKey.startsWith('session-'));
    });
  });
  
  describe('triggerMessageReceived', () => {
    it('should trigger message_received event', async () => {
      const content = 'Hello, world!';
      const context = { agentId: 'test-agent', sessionKey: 'test-session', channelId: 'test-channel' };
      
      await triggerMessageReceived(mockApi, content, context);
      
      assert.strictEqual(mockApi.events.length, 1);
      assert.strictEqual(mockApi.events[0].eventName, 'message_received');
      assert.strictEqual(mockApi.events[0].event.content, content);
      assert.strictEqual(mockApi.events[0].event.role, 'user');
      assert.strictEqual(mockApi.events[0].context.agentId, 'test-agent');
      assert.strictEqual(mockApi.events[0].context.sessionKey, 'test-session');
      assert.strictEqual(mockApi.events[0].context.channelId, 'test-channel');
    });
    
    it('should use default context when not provided', async () => {
      const content = 'Hello, world!';
      
      await triggerMessageReceived(mockApi, content);
      
      assert.strictEqual(mockApi.events[0].context.agentId, 'main');
      assert.ok(mockApi.events[0].context.sessionKey.startsWith('session-'));
    });
    
    it('should generate session key when not provided', async () => {
      const content = 'Hello, world!';
      
      await triggerMessageReceived(mockApi, content);
      
      assert.ok(mockApi.events[0].event.sessionKey === undefined);
      assert.ok(mockApi.events[0].context.sessionKey.startsWith('session-'));
    });
  });
  
  describe('Integration tests', () => {
    it('should handle multiple lifecycle events in sequence', async () => {
      const messages = [
        { role: 'user', content: 'What is the weather?' },
        { role: 'assistant', content: 'I don\'t have access to weather data.' },
      ];
      
      // 1. Message received
      await triggerMessageReceived(mockApi, 'What is the weather?');
      
      // 2. Auto recall
      const recallResult = await triggerAutoRecall(mockApi, 'What is the weather?');
      
      // 3. Auto capture
      await triggerAutoCapture(mockApi, messages);
      
      // 4. Session end
      await triggerSessionEnd(mockApi);
      
      assert.strictEqual(mockApi.events.length, 4);
      assert.strictEqual(mockApi.events[0].eventName, 'message_received');
      assert.strictEqual(mockApi.events[1].eventName, 'before_prompt_build');
      assert.strictEqual(mockApi.events[2].eventName, 'agent_end');
      assert.strictEqual(mockApi.events[3].eventName, 'session_end');
    });
    
    it('should handle empty messages array', async () => {
      await triggerAutoCapture(mockApi, []);
      
      assert.strictEqual(mockApi.events[0].event.messages.length, 0);
    });
    
    it('should handle messages with array content', async () => {
      const messages = [
        { 
          role: 'user', 
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'text', text: 'World' },
          ] 
        },
      ];
      
      await triggerAutoCapture(mockApi, messages);
      
      assert.deepStrictEqual(mockApi.events[0].event.messages, messages);
    });
  });
});
/**
 * Schema Module Unit Tests
 * 
 * Tests for src/schema.ts functionality:
 * - TypeBox to JSON Schema conversion
 * - Input schema extraction
 * - Handling of TypeBox-specific properties
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import the module under test
import { typeboxToJsonSchema, extractInputSchema } from '../../dist/schema.js';

describe('Schema Module Unit Tests', () => {
  
  describe('typeboxToJsonSchema', () => {
    it('should return default object schema for null input', () => {
      const result = typeboxToJsonSchema(null);
      assert.deepStrictEqual(result, { type: 'object', properties: {} });
    });
    
    it('should return default object schema for undefined input', () => {
      const result = typeboxToJsonSchema(undefined);
      assert.deepStrictEqual(result, { type: 'object', properties: {} });
    });
    
    it('should return default object schema for non-object input', () => {
      const result = typeboxToJsonSchema('string');
      assert.deepStrictEqual(result, { type: 'object', properties: {} });
    });
    
    it('should convert basic object schema', () => {
      const input = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      };
      
      const result = typeboxToJsonSchema(input);
      assert.strictEqual(result.type, 'object');
      assert.strictEqual(result.properties.name.type, 'string');
      assert.strictEqual(result.properties.age.type, 'number');
      assert.deepStrictEqual(result.required, ['name']);
    });
    
    it('should handle nested objects', () => {
      const input = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
            },
            required: ['name'],
          },
        },
      };
      
      const result = typeboxToJsonSchema(input);
      assert.strictEqual(result.type, 'object');
      assert.strictEqual(result.properties.user.type, 'object');
      assert.strictEqual(result.properties.user.properties.name.type, 'string');
      assert.deepStrictEqual(result.properties.user.required, ['name']);
    });
    
    it('should handle array types', () => {
      const input = {
        type: 'array',
        items: {
          type: 'string',
        },
      };
      
      const result = typeboxToJsonSchema(input);
      assert.strictEqual(result.type, 'array');
      assert.strictEqual(result.items.type, 'string');
    });
    
    it('should handle enum types', () => {
      const input = {
        type: 'string',
        enum: ['option1', 'option2', 'option3'],
      };
      
      const result = typeboxToJsonSchema(input);
      assert.strictEqual(result.type, 'string');
      assert.deepStrictEqual(result.enum, ['option1', 'option2', 'option3']);
    });
    
    it('should handle numeric constraints', () => {
      const input = {
        type: 'number',
        minimum: 0,
        maximum: 100,
      };
      
      const result = typeboxToJsonSchema(input);
      assert.strictEqual(result.type, 'number');
      assert.strictEqual(result.minimum, 0);
      assert.strictEqual(result.maximum, 100);
    });
    
    it('should handle string constraints', () => {
      const input = {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: '^[a-zA-Z]+$',
      };
      
      const result = typeboxToJsonSchema(input);
      assert.strictEqual(result.type, 'string');
      assert.strictEqual(result.minLength, 1);
      assert.strictEqual(result.maxLength, 100);
      assert.strictEqual(result.pattern, '^[a-zA-Z]+$');
    });
    
    it('should handle default values', () => {
      const input = {
        type: 'string',
        default: 'default-value',
      };
      
      const result = typeboxToJsonSchema(input);
      assert.strictEqual(result.type, 'string');
      assert.strictEqual(result.default, 'default-value');
    });
    
    it('should handle description', () => {
      const input = {
        type: 'string',
        description: 'A test field',
      };
      
      const result = typeboxToJsonSchema(input);
      assert.strictEqual(result.type, 'string');
      assert.strictEqual(result.description, 'A test field');
    });
    
    it('should handle oneOf combinator', () => {
      const input = {
        oneOf: [
          { type: 'string' },
          { type: 'number' },
        ],
      };
      
      const result = typeboxToJsonSchema(input);
      assert.ok(Array.isArray(result.oneOf));
      assert.strictEqual(result.oneOf.length, 2);
      assert.strictEqual(result.oneOf[0].type, 'string');
      assert.strictEqual(result.oneOf[1].type, 'number');
    });
    
    it('should handle anyOf combinator', () => {
      const input = {
        anyOf: [
          { type: 'string' },
          { type: 'number' },
        ],
      };
      
      const result = typeboxToJsonSchema(input);
      assert.ok(Array.isArray(result.anyOf));
      assert.strictEqual(result.anyOf.length, 2);
    });
    
    it('should handle allOf combinator', () => {
      const input = {
        allOf: [
          { type: 'object', properties: { a: { type: 'string' } } },
          { type: 'object', properties: { b: { type: 'number' } } },
        ],
      };
      
      const result = typeboxToJsonSchema(input);
      assert.ok(Array.isArray(result.allOf));
      assert.strictEqual(result.allOf.length, 2);
    });
    
    it('should strip TypeBox-specific properties', () => {
      const input = {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            [Symbol.for('TypeBox.Kind')]: 'String',
            [Symbol.for('TypeBox.Modifier')]: 'Required',
          },
        },
        [Symbol.for('TypeBox.Kind')]: 'Object',
      };
      
      const result = typeboxToJsonSchema(input);
      assert.strictEqual(result.type, 'object');
      assert.strictEqual(result.properties.name.type, 'string');
      // TypeBox symbols should be stripped
      assert.strictEqual(result.properties.name[Symbol.for('TypeBox.Kind')], undefined);
      assert.strictEqual(result[Symbol.for('TypeBox.Kind')], undefined);
    });
    
    it('should infer object type when missing but has properties', () => {
      const input = {
        properties: {
          name: { type: 'string' },
        },
      };
      
      const result = typeboxToJsonSchema(input);
      assert.strictEqual(result.type, 'object');
    });
    
    it('should handle empty object schema', () => {
      const input = {
        type: 'object',
        properties: {},
      };
      
      const result = typeboxToJsonSchema(input);
      assert.strictEqual(result.type, 'object');
      assert.deepStrictEqual(result.properties, {});
    });
    
    it('should handle schema with additionalProperties', () => {
      const input = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: false,
      };
      
      const result = typeboxToJsonSchema(input);
      assert.strictEqual(result.type, 'object');
      assert.strictEqual(result.additionalProperties, false);
    });
  });
  
  describe('extractInputSchema', () => {
    it('should wrap non-object schema in object', () => {
      const input = {
        type: 'string',
      };
      
      const result = extractInputSchema(input);
      assert.strictEqual(result.type, 'object');
      assert.strictEqual(result.properties.input.type, 'string');
    });
    
    it('should return object schema as-is', () => {
      const input = {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      };
      
      const result = extractInputSchema(input);
      assert.strictEqual(result.type, 'object');
      assert.strictEqual(result.properties.query.type, 'string');
      assert.deepStrictEqual(result.required, ['query']);
    });
    
    it('should handle null input', () => {
      const result = extractInputSchema(null);
      assert.strictEqual(result.type, 'object');
      assert.deepStrictEqual(result.properties, {});
    });
    
    it('should handle undefined input', () => {
      const result = extractInputSchema(undefined);
      assert.strictEqual(result.type, 'object');
      assert.deepStrictEqual(result.properties, {});
    });
    
    it('should handle array input', () => {
      const input = {
        type: 'array',
        items: { type: 'string' },
      };
      
      const result = extractInputSchema(input);
      assert.strictEqual(result.type, 'object');
      assert.strictEqual(result.properties.input.type, 'array');
    });
    
    it('should handle TypeBox schema with properties', () => {
      const input = {
        properties: {
          text: {
            type: 'string',
            description: 'The text to store',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['text'],
      };
      
      const result = extractInputSchema(input);
      assert.strictEqual(result.type, 'object');
      assert.strictEqual(result.properties.text.type, 'string');
      assert.strictEqual(result.properties.text.description, 'The text to store');
      assert.strictEqual(result.properties.tags.type, 'array');
      assert.deepStrictEqual(result.required, ['text']);
    });
  });
});
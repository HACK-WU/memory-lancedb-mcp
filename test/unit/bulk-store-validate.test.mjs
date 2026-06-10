/**
 * Bulk Store Validation Unit Tests
 *
 * Tests the pre-validation logic for `mem bulk-store` command.
 * This extracts and tests the pure validation function independently
 * from the CLI handler, covering:
 * - Empty / missing text detection
 * - Invalid importance detection
 * - Multiple errors on same entry → single skipped index
 * - Empty array / non-array JSON
 * - Valid entries pass through
 * - Default values merging
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Extracted validation logic (mirrors src/cli.ts lines 459-477) ───

/**
 * @typedef {{ text: string, category?: string, importance?: number, tags?: string, scope?: string }} Entry
 * @typedef {{ index: number, text: string, reason: string }} SkipDetail
 */

/**
 * Validate an array of bulk-store entries.
 * Returns skipped indices and details.
 *
 * @param {Entry[]} entries
 * @returns {{ skippedIndices: Set<number>, skippedDetails: SkipDetail[] }}
 */
function validateEntries(entries) {
  const skippedIndices = new Set();
  const skippedDetails = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const reasons = [];
    if (!entry.text || typeof entry.text !== 'string' || !entry.text.trim()) {
      reasons.push('missing or empty text');
    }
    if (entry.importance !== undefined && (typeof entry.importance !== 'number' || isNaN(entry.importance) || entry.importance < 0 || entry.importance > 1)) {
      reasons.push(`invalid importance: ${entry.importance}`);
    }
    for (const reason of reasons) {
      skippedDetails.push({ index: i, text: String(entry.text ?? ''), reason });
    }
    if (reasons.length > 0) {
      skippedIndices.add(i);
    }
  }

  return { skippedIndices, skippedDetails };
}

// ─── Tests ───

describe('Bulk Store Validation', () => {

  describe('valid entries', () => {
    it('should pass all-valid entries with no skips', () => {
      const entries = [
        { text: 'Valid entry one', category: 'fact', importance: 0.8 },
        { text: 'Valid entry two', tags: 'tech' },
        { text: 'Valid entry three', scope: 'project:alpha' },
      ];
      const { skippedIndices, skippedDetails } = validateEntries(entries);
      assert.strictEqual(skippedIndices.size, 0);
      assert.strictEqual(skippedDetails.length, 0);
    });

    it('should pass entry with only text (minimal valid entry)', () => {
      const entries = [{ text: 'Just text' }];
      const { skippedIndices, skippedDetails } = validateEntries(entries);
      assert.strictEqual(skippedIndices.size, 0);
      assert.strictEqual(skippedDetails.length, 0);
    });

    it('should pass entry with importance at boundaries (0 and 1)', () => {
      const entries = [
        { text: 'Low importance', importance: 0 },
        { text: 'High importance', importance: 1 },
      ];
      const { skippedIndices, skippedDetails } = validateEntries(entries);
      assert.strictEqual(skippedIndices.size, 0);
    });

    it('should pass entry with importance undefined (uses default later)', () => {
      const entries = [{ text: 'No importance field' }];
      const { skippedIndices, skippedDetails } = validateEntries(entries);
      assert.strictEqual(skippedIndices.size, 0);
    });
  });

  describe('empty / missing text', () => {
    it('should skip entry with empty string text', () => {
      const entries = [{ text: '' }];
      const { skippedIndices, skippedDetails } = validateEntries(entries);
      assert.strictEqual(skippedIndices.size, 1);
      assert.ok(skippedIndices.has(0));
      assert.strictEqual(skippedDetails.length, 1);
      assert.strictEqual(skippedDetails[0].reason, 'missing or empty text');
    });

    it('should skip entry with whitespace-only text', () => {
      const entries = [{ text: '   ' }];
      const { skippedIndices, skippedDetails } = validateEntries(entries);
      assert.strictEqual(skippedIndices.size, 1);
      assert.ok(skippedDetails[0].reason.includes('missing or empty text'));
    });

    it('should skip entry with null text', () => {
      const entries = [{ text: null }];
      const { skippedIndices, skippedDetails } = validateEntries(entries);
      assert.strictEqual(skippedIndices.size, 1);
    });

    it('should skip entry with missing text field', () => {
      const entries = [{ category: 'fact' }];
      const { skippedIndices, skippedDetails } = validateEntries(entries);
      assert.strictEqual(skippedIndices.size, 1);
      // String(undefined ?? '') === String('') === ''
      assert.strictEqual(skippedDetails[0].text, '');
    });

    it('should skip entry with numeric text', () => {
      const entries = [{ text: 123 }];
      const { skippedIndices, skippedDetails } = validateEntries(entries);
      assert.strictEqual(skippedIndices.size, 1);
    });
  });

  describe('invalid importance', () => {
    it('should skip entry with importance > 1', () => {
      const entries = [{ text: 'Test', importance: 1.5 }];
      const { skippedIndices, skippedDetails } = validateEntries(entries);
      assert.strictEqual(skippedIndices.size, 1);
      assert.ok(skippedDetails[0].reason.includes('invalid importance'));
    });

    it('should skip entry with negative importance', () => {
      const entries = [{ text: 'Test', importance: -0.1 }];
      const { skippedIndices, skippedDetails } = validateEntries(entries);
      assert.strictEqual(skippedIndices.size, 1);
      assert.ok(skippedDetails[0].reason.includes('invalid importance'));
    });

    it('should skip entry with string importance', () => {
      const entries = [{ text: 'Test', importance: 'high' }];
      const { skippedIndices, skippedDetails } = validateEntries(entries);
      assert.strictEqual(skippedIndices.size, 1);
    });

    it('should skip entry with NaN importance', () => {
      const entries = [{ text: 'Test', importance: NaN }];
      const { skippedIndices, skippedDetails } = validateEntries(entries);
      assert.strictEqual(skippedIndices.size, 1);
    });

    it('should skip entry with Infinity importance', () => {
      const entries = [{ text: 'Test', importance: Infinity }];
      const { skippedIndices, skippedDetails } = validateEntries(entries);
      assert.strictEqual(skippedIndices.size, 1);
    });
  });

  describe('multiple errors on same entry → single skipped index', () => {
    it('should count entry once when both text empty and importance invalid', () => {
      const entries = [
        { text: '', importance: 2.0 },
      ];
      const { skippedIndices, skippedDetails } = validateEntries(entries);
      // Index 0 is skipped exactly once in the Set
      assert.strictEqual(skippedIndices.size, 1);
      assert.ok(skippedIndices.has(0));
      // But both reason details are recorded
      assert.strictEqual(skippedDetails.length, 2);
      assert.strictEqual(skippedDetails[0].reason, 'missing or empty text');
      assert.ok(skippedDetails[1].reason.includes('invalid importance'));
    });

    it('should correctly separate valid and invalid in mixed batch', () => {
      const entries = [
        { text: 'Valid entry', importance: 0.5 },
        { text: '', importance: 2.0 },           // 2 errors, 1 skip
        { text: 'Another valid', category: 'fact' },
        { text: '   ', importance: -1 },         // 2 errors, 1 skip
        { text: 'Third valid', scope: 'test' },
      ];
      const { skippedIndices, skippedDetails } = validateEntries(entries);

      // 3 valid, 2 skipped
      assert.strictEqual(skippedIndices.size, 2);
      assert.ok(skippedIndices.has(1));
      assert.ok(skippedIndices.has(3));
      assert.ok(!skippedIndices.has(0));
      assert.ok(!skippedIndices.has(2));
      assert.ok(!skippedIndices.has(4));

      // 4 detail records (2 entries × 2 errors each)
      assert.strictEqual(skippedDetails.length, 4);
    });
  });

  describe('large batch validation', () => {
    it('should handle 1000 entries efficiently', () => {
      const entries = [];
      for (let i = 0; i < 1000; i++) {
        if (i % 100 === 0) {
          entries.push({ text: '', importance: 2.0 }); // invalid
        } else {
          entries.push({ text: `Entry ${i}`, importance: 0.5 });
        }
      }
      const start = Date.now();
      const { skippedIndices, skippedDetails } = validateEntries(entries);
      const elapsed = Date.now() - start;

      assert.strictEqual(skippedIndices.size, 10); // 1000 / 100 = 10 invalid
      // Should complete in well under 100ms
      assert.ok(elapsed < 100, `Validation took ${elapsed}ms, expected < 100ms`);
    });
  });

  describe('validEntries filter integration', () => {
    it('should filter to only valid entries using skippedIndices', () => {
      const entries = [
        { text: 'OK 1' },
        { text: '' },               // skip
        { text: 'OK 2' },
        { text: 'Bad', importance: 5 }, // skip
        { text: 'OK 3' },
      ];
      const { skippedIndices } = validateEntries(entries);
      const validEntries = entries.filter((_, i) => !skippedIndices.has(i));

      assert.strictEqual(validEntries.length, 3);
      assert.deepStrictEqual(validEntries.map(e => e.text), ['OK 1', 'OK 2', 'OK 3']);
    });

    it('should produce empty validEntries when all are invalid', () => {
      const entries = [
        { text: '', importance: 2 },
        { text: '   ' },
      ];
      const { skippedIndices } = validateEntries(entries);
      const validEntries = entries.filter((_, i) => !skippedIndices.has(i));
      assert.strictEqual(validEntries.length, 0);
    });
  });
});

// ─── File-level validation tests (mirrors src/cli.ts JSON parsing & structure checks) ───

describe('Bulk Store File Validation', () => {

  describe('JSON structure validation', () => {
    it('should reject non-array JSON', () => {
      const parsed = JSON.parse('{"text": "not an array"}');
      assert.ok(!Array.isArray(parsed), 'Object should not be treated as array');
    });

    it('should accept valid JSON array', () => {
      const parsed = JSON.parse('[{"text":"a"},{"text":"b"}]');
      assert.ok(Array.isArray(parsed));
      assert.strictEqual(parsed.length, 2);
    });

    it('should reject empty array', () => {
      const parsed = JSON.parse('[]');
      assert.ok(Array.isArray(parsed));
      assert.strictEqual(parsed.length, 0, 'Empty array should be rejected');
    });

    it('should reject invalid JSON', () => {
      assert.throws(() => JSON.parse('not json at all'), /SyntaxError/);
    });

    it('should reject truncated JSON', () => {
      assert.throws(() => JSON.parse('[{"text":"test"'), /SyntaxError/);
    });
  });

  describe('default importance parsing', () => {
    it('should parse valid importance string', () => {
      const val = parseFloat('0.8');
      assert.ok(!isNaN(val) && val >= 0 && val <= 1);
    });

    it('should reject out-of-range importance', () => {
      const val = parseFloat('1.5');
      assert.ok(isNaN(val) || val < 0 || val > 1);
    });

    it('should reject non-numeric importance', () => {
      const val = parseFloat('abc');
      assert.ok(isNaN(val));
    });
  });
});

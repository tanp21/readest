import { describe, expect, it } from 'vitest';
import { sentenceContext } from '@/services/wordharvestContext';

describe('WordHarvest sentence context', () => {
  it('uses the selected occurrence when a word appears in two sentences', () => {
    const text = 'She ran to the door. He ran home after dark. They rested.';
    const offset = text.indexOf('ran', text.indexOf('He'));
    expect(sentenceContext(text, offset, 'ran')).toEqual({
      sentence: 'He ran home after dark.',
      before: ['She ran to the door.'],
      after: ['They rested.'],
    });
  });

  it('rejects a selection that cannot be found in its sentence', () => {
    expect(() => sentenceContext('She walked away.', 4, 'ran')).toThrow();
  });
});

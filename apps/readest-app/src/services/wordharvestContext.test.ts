import { describe, expect, it } from 'vitest';
import { sentenceContext } from './wordharvestContext';

describe('WordHarvest sentence context', () => {
  it('identifies the selected occurrence when a word repeats', () => {
    const text = 'The bank bought the river bank. Then they left.';
    expect(sentenceContext(text, 26, 'bank')).toMatchObject({
      sentence: 'The bank bought the river bank.',
      occurrenceIndex: 1,
      after: ['Then they left.'],
    });
  });
});

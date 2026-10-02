import { describe, expect, it } from 'vitest';
import type { BookNote } from '@/types/book';
import {
  markWordHarvestNoteLearning,
  upgradeLegacyWordHarvestColors,
  WORDHARVEST_LEARNING_COLOR,
  WORDHARVEST_SUGGESTED_COLOR,
} from '@/services/wordharvestHighlights';

const note = (id: string, status: 'suggested' | 'learning', color = '#80CBC4'): BookNote => ({
  id,
  type: 'annotation',
  cfi: `epubcfi(/6/2!/${id})`,
  text: 'gave up',
  note: '**Definition:** stop trying',
  style: 'highlight',
  color,
  wordHarvest: { term: 'give up', context: 'She gave up.', status },
  createdAt: 1,
  updatedAt: 1,
});

describe('WordHarvest scan highlight colors', () => {
  it('upgrades existing pending and learned scan notes while preserving custom colors', () => {
    const pending = note('1', 'suggested');
    const learned = note('2', 'learning');
    const custom = note('3', 'suggested', '#CBA6F7');
    const { notes, changed } = upgradeLegacyWordHarvestColors([pending, learned, custom], 5);

    expect(notes.map((item) => item.color)).toEqual([
      WORDHARVEST_SUGGESTED_COLOR,
      WORDHARVEST_LEARNING_COLOR,
      '#CBA6F7',
    ]);
    expect(notes.map((item) => item.updatedAt)).toEqual([5, 5, 1]);
    expect(changed).toHaveLength(2);
    expect(notes[0]?.note).toBe(pending.note);
    expect(notes[0]?.wordHarvest?.context).toBe(pending.wordHarvest?.context);
  });

  it('sets the learning color and status without replacing note content or its anchor', () => {
    const pending = note('1', 'suggested', WORDHARVEST_SUGGESTED_COLOR);
    const learned = markWordHarvestNoteLearning(pending, 10);

    expect(learned.color).toBe(WORDHARVEST_LEARNING_COLOR);
    expect(learned.wordHarvest?.status).toBe('learning');
    expect(learned.updatedAt).toBe(10);
    expect(learned.id).toBe(pending.id);
    expect(learned.cfi).toBe(pending.cfi);
    expect(learned.note).toBe(pending.note);
  });
});

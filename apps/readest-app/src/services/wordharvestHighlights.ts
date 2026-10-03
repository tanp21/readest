import type { BookNote } from '@/types/book';

// Both colors are outside Readest's standard red/yellow/green/blue/violet palette.
export const WORDHARVEST_SUGGESTED_COLOR = '#C9B5A7';
export const WORDHARVEST_LEARNING_COLOR = '#82C7BE';
const LEGACY_SCAN_COLOR = '#80CBC4';

export const markWordHarvestNoteLearning = (note: BookNote, updatedAt: number): BookNote => ({
  ...note,
  color: WORDHARVEST_LEARNING_COLOR,
  wordHarvest: note.wordHarvest ? { ...note.wordHarvest, status: 'learning' } : undefined,
  updatedAt,
});

export const applyWordHarvestLearningDecisions = (
  notes: BookNote[],
  decisions: Array<{ term: string; context: string; senseKey: string; decision: string }>,
  updatedAt: number,
): { notes: BookNote[]; changed: Array<{ before: BookNote; after: BookNote }> } => {
  const learned = new Set(decisions.filter((item) => item.decision === 'learning')
    .map((item) => `${item.term}\n${item.context}\n${item.senseKey}`));
  const changed: Array<{ before: BookNote; after: BookNote }> = [];
  const updated = notes.map((note) => {
    const metadata = note.wordHarvest;
    if (note.deletedAt || metadata?.status !== 'suggested' ||
        !learned.has(`${metadata.term}\n${metadata.context}\n${metadata.senseKey ?? ''}`)) return note;
    const after = markWordHarvestNoteLearning(note, updatedAt);
    changed.push({ before: note, after });
    return after;
  });
  return { notes: updated, changed };
};

/** Recolor scan notes made before suggested and learned terms had separate colors. */
export const upgradeLegacyWordHarvestColors = (
  notes: BookNote[],
  updatedAt: number,
): { notes: BookNote[]; changed: Array<{ before: BookNote; after: BookNote }> } => {
  const changed: Array<{ before: BookNote; after: BookNote }> = [];
  const upgraded = notes.map((note) => {
    if (note.deletedAt || !note.wordHarvest || note.color?.toUpperCase() !== LEGACY_SCAN_COLOR)
      return note;
    const color =
      note.wordHarvest.status === 'suggested'
        ? WORDHARVEST_SUGGESTED_COLOR
        : WORDHARVEST_LEARNING_COLOR;
    const after = { ...note, color, updatedAt };
    changed.push({ before: note, after });
    return after;
  });
  return { notes: upgraded, changed };
};

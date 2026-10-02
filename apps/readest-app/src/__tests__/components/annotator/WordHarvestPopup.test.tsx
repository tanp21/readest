import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WordHarvestLookupRequest } from '@/services/wordharvest';

const h = vi.hoisted(() => ({
  lookup: vi.fn(),
  learn: vi.fn(),
  addNote: vi.fn(),
}));

vi.mock('@/services/wordharvest', () => ({
  lookupWordHarvest: h.lookup,
  learnWordHarvest: h.learn,
}));

vi.mock('@/components/Popup', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import WordHarvestPopup from '@/app/reader/components/annotator/WordHarvestPopup';

const request: WordHarvestLookupRequest = {
  selection: 'gave up',
  sentence: 'She gave up after a week.',
  before: [],
  after: [],
  source: { bookKey: 'book-1', title: 'A Book', author: 'An Author', locator: 'chapter.xhtml' },
};

const renderPopup = () =>
  render(
    <WordHarvestPopup
      request={request}
      position={{ point: { x: 0, y: 0 } }}
      trianglePosition={{ point: { x: 0, y: 0 } }}
      width={320}
      height={180}
      onDismiss={() => {}}
      onAddNote={h.addNote}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  h.lookup.mockResolvedValue({
    lookupId: 'lookup-1',
    surfaceForm: 'gave up',
    canonicalTerm: 'give up',
    termKind: 'phrase',
    partOfSpeech: 'verb',
    definitionEn: 'stop trying',
    meaningVi: 'từ bỏ',
    examples: ['She gave up.', 'Do not give up.'],
  });
  h.learn.mockResolvedValue({ candidateId: 1, vocabularyId: 2, ankiState: 'pending' });
});

afterEach(cleanup);

describe('WordHarvest lookup actions', () => {
  it('learns before opening the highlight note editor', async () => {
    const order: string[] = [];
    h.learn.mockImplementation(async () => {
      order.push('learn');
      return { candidateId: 1, vocabularyId: 2, ankiState: 'pending' };
    });
    h.addNote.mockImplementation(() => order.push('note'));
    renderPopup();

    fireEvent.click(await screen.findByRole('button', { name: 'Learn' }));

    await waitFor(() => expect(h.addNote).toHaveBeenCalledOnce());
    expect(h.learn).toHaveBeenCalledExactlyOnceWith('lookup-1');
    expect(order).toEqual(['learn', 'note']);
    expect(h.addNote.mock.calls[0]?.[0]).toContain('**Definition:** stop trying');
  });

  it('keeps the lookup open when learning fails so the user can retry', async () => {
    h.learn.mockRejectedValueOnce(new Error('WordHarvest is unavailable'));
    renderPopup();

    fireEvent.click(await screen.findByRole('button', { name: 'Learn' }));

    expect((await screen.findByRole('alert')).textContent).toContain('WordHarvest is unavailable');
    expect(h.addNote).not.toHaveBeenCalled();
    expect(
      (screen.getByRole('button', { name: 'Learn' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('does not learn twice when Anki was added before highlighting', async () => {
    renderPopup();
    fireEvent.click(await screen.findByRole('button', { name: 'Add Anki card' }));
    await screen.findByText('Saved in WordHarvest. Waiting for Anki.');

    fireEvent.click(screen.getByRole('button', { name: 'Learn' }));

    await waitFor(() => expect(h.addNote).toHaveBeenCalledOnce());
    expect(h.learn).toHaveBeenCalledOnce();
  });
});

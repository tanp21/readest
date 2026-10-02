import { getTextFromRange, type TextSelection } from '@/utils/sel';
import type { WordHarvestLookupRequest, WordHarvestSource } from './wordharvest';

const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

export function sentenceContext(text: string, offset: number, selection: string) {
  const segments = Array.from(new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text));
  const index = segments.findIndex(({ index: start, segment }) => offset >= start && offset < start + segment.length);
  if (index < 0) throw new Error('Could not find the selected sentence.');
  const target = clean(segments[index]!.segment);
  if (!target.toLocaleLowerCase().includes(clean(selection).toLocaleLowerCase())) {
    throw new Error('Could not match the selection to its sentence.');
  }
  if (target.length > 2_000) throw new Error('The selected sentence is too long for a contextual lookup.');
  const before = segments.slice(Math.max(0, index - 3), index).map(({ segment }) => clean(segment)).filter(Boolean);
  const after = segments.slice(index + 1, index + 4).map(({ segment }) => clean(segment)).filter(Boolean);
  while (before.join('').length + after.join('').length + target.length > 6_000) {
    if (before.length >= after.length && before.length) before.shift();
    else if (after.length) after.pop();
    else break;
  }
  return { sentence: target, before, after };
}

export function buildWordHarvestLookup(
  selection: TextSelection,
  source: WordHarvestSource,
): WordHarvestLookupRequest {
  const selectedText = clean(selection.text);
  if (!selectedText || selectedText.length > 120) throw new Error('Select a word or phrase up to 120 characters.');
  const range = selection.range;
  const node = range.startContainer;
  const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  const root = element?.closest('.textLayer, p, li, blockquote, td, th') ?? element;
  if (!root) throw new Error('Could not read context around the selection.');
  const fullRange = range.cloneRange();
  fullRange.selectNodeContents(root);
  const prefixRange = fullRange.cloneRange();
  prefixRange.setEnd(range.startContainer, range.startOffset);
  const text = getTextFromRange(fullRange);
  const offset = getTextFromRange(prefixRange).length;
  return { selection: selectedText, ...sentenceContext(text, offset, selectedText), source };
}

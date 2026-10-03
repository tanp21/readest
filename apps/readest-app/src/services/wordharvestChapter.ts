import { CFI, type SectionItem } from '@/libs/document';
import type { WordHarvestChapterSentence } from '@/services/wordharvest';

interface TextPosition {
  node: Text;
  offset: number;
}

interface ChapterSentenceAnchor {
  id: string;
  text: string;
  characterMap: TextPosition[];
}

export interface ChapterScanText {
  sentences: WordHarvestChapterSentence[];
  anchors: Map<string, ChapterSentenceAnchor>;
}

const EXCLUDED = 'script,style,noscript,nav,header,footer,aside,[hidden],[aria-hidden="true"]';
const BLOCKS = 'p,li,blockquote,h1,h2,h3,h4,h5,h6';

const normalizedTextWithMap = (element: Element) => {
  const text = '';
  const positions: TextPosition[] = [];
  const walker = element.ownerDocument!.createTreeWalker(element, 4);
  let node = walker.nextNode();
  let value = text;
  while (node) {
    const textNode = node as Text;
    if (!textNode.parentElement?.closest(EXCLUDED)) {
      for (let offset = 0; offset < textNode.data.length; offset += 1) {
        const character = textNode.data[offset]!;
        if (/\s/u.test(character)) {
          if (!value || value.endsWith(' ')) continue;
          value += ' ';
        } else {
          value += character;
        }
        positions.push({ node: textNode, offset });
      }
    }
    node = walker.nextNode();
  }
  if (value.endsWith(' ')) {
    value = value.slice(0, -1);
    positions.pop();
  }
  return { value, positions };
};

const splitLongSentence = (
  text: string,
  maxLength: number,
): Array<{ text: string; start: number }> => {
  const pieces: Array<{ text: string; start: number }> = [];
  let start = 0;
  while (start < text.length) {
    while (/\s/u.test(text[start] ?? '')) start += 1;
    if (start >= text.length) break;
    let end = Math.min(start + maxLength, text.length);
    if (end < text.length) {
      const cut = text.lastIndexOf(' ', end);
      if (cut > start + maxLength / 2) end = cut;
    }
    pieces.push({ text: text.slice(start, end).trim(), start });
    start = end;
  }
  return pieces;
};

export const collectChapterScanText = (doc: Document, maxChars = 400_000): ChapterScanText => {
  const sentences: WordHarvestChapterSentence[] = [];
  const anchors = new Map<string, ChapterSentenceAnchor>();
  let totalChars = 0;
  const blocks = Array.from(doc.body.querySelectorAll(BLOCKS)).filter((element) => {
    if (element.closest(EXCLUDED) || !element.textContent?.trim()) return false;
    return !element.parentElement?.closest(BLOCKS);
  });
  for (const block of blocks) {
    const { value, positions } = normalizedTextWithMap(block);
    if (!value) continue;
    const segments =
      typeof Intl.Segmenter === 'function'
        ? Array.from(new Intl.Segmenter('en', { granularity: 'sentence' }).segment(value))
        : [{ segment: value, index: 0 }];
    for (const segment of segments) {
      const start = segment.index;
      for (const piece of splitLongSentence(segment.segment, 1_800)) {
        const from = start + piece.start;
        const to = from + piece.text.length;
        const id = `s${sentences.length}`;
        sentences.push({ id, text: piece.text });
        anchors.set(id, { id, text: piece.text, characterMap: positions.slice(from, to) });
        totalChars += piece.text.length;
        if (totalChars >= maxChars) return { sentences, anchors };
      }
    }
  }
  return { sentences, anchors };
};

const occurrencesInSentence = (text: string, surface: string): number[] => {
  const result: number[] = [];
  if (!surface.trim()) return result;
  const lowerText = text.toLocaleLowerCase('en');
  const lowerSurface = surface.toLocaleLowerCase('en');
  let from = 0;
  while (from <= lowerText.length - lowerSurface.length) {
    const index = lowerText.indexOf(lowerSurface, from);
    if (index < 0) break;
    const before = lowerText[index - 1] ?? '';
    const after = lowerText[index + lowerSurface.length] ?? '';
    const first = lowerSurface[0] ?? '';
    const last = lowerSurface.at(-1) ?? '';
    if (
      (!/[\p{L}\p{N}]/u.test(first) || !/[\p{L}\p{N}]/u.test(before)) &&
      (!/[\p{L}\p{N}]/u.test(last) || !/[\p{L}\p{N}]/u.test(after))
    ) {
      result.push(index);
    }
    from = index + Math.max(1, lowerSurface.length);
  }
  return result;
};

export const findChapterOccurrenceCfis = (
  section: SectionItem,
  sentence: ChapterSentenceAnchor,
  surfaceForm: string,
  occurrenceIndex?: number,
): string[] => {
  const cfis: string[] = [];
  const matches = occurrencesInSentence(sentence.text, surfaceForm);
  for (const start of occurrenceIndex === undefined ? matches : matches.slice(occurrenceIndex, occurrenceIndex + 1)) {
    const first = sentence.characterMap[start];
    const last = sentence.characterMap[start + surfaceForm.length - 1];
    if (!first || !last) continue;
    const range = first.node.ownerDocument!.createRange();
    try {
      range.setStart(first.node, first.offset);
      range.setEnd(last.node, last.offset + 1);
      const rangeCfi = CFI.fromRange(range);
      if (rangeCfi) cfis.push(CFI.joinIndir(section.cfi, rangeCfi));
    } catch {
      // The range may straddle malformed publisher markup; skip only this span.
    }
  }
  return [...new Set(cfis)];
};

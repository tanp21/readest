import type { BookDoc, TOCItem } from '@/libs/document';

export interface WordHarvestChapterOption {
  index: number;
  label: string;
}

export const getWordHarvestChapterOptions = (bookDoc: BookDoc): WordHarvestChapterOption[] => {
  const labels = new Map<number, string>();
  const sectionIndex = new Map(bookDoc.sections.map((section, index) => [section.id, index]));

  const visit = (items: TOCItem[]) => {
    for (const item of items) {
      if (item.href && item.label.trim()) {
        const id = String(bookDoc.splitTOCHref(item.href)[0] ?? '');
        const index = sectionIndex.get(id);
        if (index !== undefined && !labels.has(index)) labels.set(index, item.label.trim());
      }
      if (item.subitems) visit(item.subitems);
    }
  };
  visit(bookDoc.toc ?? []);

  return bookDoc.sections.map((section, index) => ({
    index,
    label: labels.get(index) ?? section.href ?? `Chapter ${index + 1}`,
  }));
};

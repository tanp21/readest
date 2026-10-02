import { invoke } from '@tauri-apps/api/core';
import { isTauriAppPlatform } from '@/services/environment';
import { getOSPlatform } from '@/utils/misc';

export const wordHarvestAvailable = () =>
  isTauriAppPlatform() && typeof navigator !== 'undefined' && getOSPlatform() === 'windows';

export interface WordHarvestSource {
  bookKey: string;
  title: string;
  author: string;
  locator: string;
}

export interface WordHarvestLookupRequest {
  selection: string;
  sentence: string;
  before: string[];
  after: string[];
  source: WordHarvestSource;
}

export interface WordHarvestLookupResult {
  lookupId: string;
  surfaceForm: string;
  canonicalTerm: string;
  termKind: string;
  partOfSpeech: string;
  definitionEn: string;
  meaningVi: string;
  examples: string[];
}

export interface WordHarvestLearnResult {
  candidateId: number;
  vocabularyId: number;
  ankiState: 'pending' | 'synced' | 'error';
}

export interface WordHarvestChapterSentence {
  id: string;
  text: string;
}

export interface WordHarvestChapterScanRequest {
  source: WordHarvestSource;
  chapterLabel: string;
  sentences: WordHarvestChapterSentence[];
}

export interface WordHarvestChapterOccurrence {
  sentenceId: string;
  surfaceForm: string;
  context: string;
}

export interface WordHarvestChapterSuggestion {
  candidateId: number;
  term: string;
  kind: string;
  partOfSpeech: string;
  definition: string;
  meaningVi: string;
  examples: string[];
  cefr: string;
  context: string;
  occurrences: WordHarvestChapterOccurrence[];
}

export interface WordHarvestChapterScanSnapshot {
  scanId: string;
  status: 'queued' | 'scanning' | 'enriching' | 'done' | 'partial' | 'cancelled' | 'error';
  completed: number;
  total: number;
  error: string | null;
  suggestions: WordHarvestChapterSuggestion[];
}

async function request<T>(operation: string, body: object = {}): Promise<T> {
  if (!wordHarvestAvailable())
    throw new Error('WordHarvest integration requires Readest on Windows.');
  return invoke<T>('wordharvest_request', { operation, body });
}

export async function setWordHarvestToken(token: string): Promise<void> {
  if (!wordHarvestAvailable())
    throw new Error('WordHarvest integration requires Readest on Windows.');
  await invoke('wordharvest_set_token', { token });
}

export const pingWordHarvest = () => request<{ protocolVersion: number }>('ping');
export const lookupWordHarvest = (body: WordHarvestLookupRequest) =>
  request<WordHarvestLookupResult>('lookup', body);
export const learnWordHarvest = (lookupId: string) =>
  request<WordHarvestLearnResult>('learn', { lookupId });
export const startWordHarvestChapterScan = (body: WordHarvestChapterScanRequest) =>
  request<WordHarvestChapterScanSnapshot>('scan_start', body);
export const getWordHarvestChapterScan = (scanId: string) =>
  request<WordHarvestChapterScanSnapshot>('scan_status', { scanId });
export const cancelWordHarvestChapterScan = (scanId: string) =>
  request<{ status: string }>('scan_cancel', { scanId });
export const decideWordHarvestChapterCandidate = (
  term: string,
  context: string,
  action: 'learn' | 'ignore',
) =>
  request<{ status: string; ankiState: string }>('candidate_feedback', { term, context, action });
export const translateWithWordHarvest = async (text: string) => {
  const result = await request<{ translation: string }>('translate', { text });
  return result.translation;
};

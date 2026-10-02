import type { TranslationProvider } from '../types';
import { translateWithWordHarvest, wordHarvestAvailable } from '@/services/wordharvest';

export const wordHarvestProvider: TranslationProvider = {
  name: 'wordharvest',
  label: 'WordHarvest (English → Vietnamese)',
  disabled: !wordHarvestAvailable(),
  async translate(texts) {
    return Promise.all(texts.map((text) => translateWithWordHarvest(text)));
  },
};

import { classify, ner } from '../lib/api';
import { translateText as translationService } from '../lib/translation';
import type { TranslationRequest, TranslationResponse } from '../lib/translation';

export class ApiService {
  static async classify(text: string): Promise<{ name?: string; tag?: string; label?: number; keywordId?: number; parentId?: number }[]> {
    return await classify(text);
  }

  static async ner(text: string): Promise<{ start: number; end: number; entity: string }[]> {
    return await ner(text);
  }

  static async translate(params: TranslationRequest): Promise<TranslationResponse> {
    return await translationService(params);
  }
}

// Re-export for backward compatibility
export async function translateText(params: TranslationRequest): Promise<TranslationResponse> {
  return translationService(params);
}

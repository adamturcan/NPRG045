import { classify as classifyRequest, ner as nerRequest } from '../../lib/api';
import {
  translateText,
  getSupportedLanguages,
  type LanguageCode,
  type TranslationRequest,
  type TranslationResponse,
} from '../../lib/translation';
import type { NerSpan } from '../../types/NotationEditor';
import type {
  ApiService as ApiServiceContract,
  ClassificationResult,
} from '../../core/interfaces/services/ApiService';

/**
 * Browser-based implementation of the ApiService contract.
 *
 * Wraps the existing fetch-based helpers and normalises responses so that
 * presentation and hooks can rely on consistent shapes via the provider layer.
 */
export class BrowserApiService implements ApiServiceContract {
  async classify(text: string): Promise<ClassificationResult> {
    const raw = await classifyRequest(text);
    return raw as ClassificationResult;
  }

  async ner(text: string): Promise<NerSpan[]> {
    const result = (await nerRequest(text)) as {
      result?: Array<{ start: number; end: number; type: string; score?: number }>;
    };

    const spans = Array.isArray(result?.result) ? result.result : [];
    return spans.map<NerSpan>((span) => ({
      start: span.start,
      end: span.end,
      entity: span.type,
      score: typeof span.score === 'number' ? span.score : 1,
    }));
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    return translateText(request);
  }

  async getSupportedLanguages(): Promise<LanguageCode[]> {
    return getSupportedLanguages();
  }
}



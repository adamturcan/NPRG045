import { classify as classifyRequest, ner as nerRequest } from '../../shared/utils/api';
import {
  translateText,
  getSupportedLanguages as fetchSupportedLanguages,
  type LanguageCode,
  type TranslationRequest,
  type TranslationResponse,
} from '../../shared/utils/translation';
import type { NerSpan } from '../../types/NotationEditor';
import type {
  ApiService as ApiServiceContract,
  ClassificationResult,
} from '../../core/interfaces/services/ApiService';
import { errorHandlingService } from './ErrorHandlingService';

/**
 * Browser-based implementation of the ApiService contract.
 *
 * Wraps the existing fetch-based helpers and normalises responses so that
 * presentation and hooks can rely on consistent shapes via the provider layer.
 */
export class BrowserApiService implements ApiServiceContract {
  async classify(text: string): Promise<ClassificationResult> {
    try {
      const raw = await classifyRequest(text);
      return raw as ClassificationResult;
    } catch (error) {
      throw errorHandlingService.handleApiError(error, {
        operation: 'classify text',
        service: 'BrowserApiService',
        layer: 'api-service',
      });
    }
  }

  async ner(text: string): Promise<NerSpan[]> {
    try {
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
    } catch (error) {
      throw errorHandlingService.handleApiError(error, {
        operation: 'run NER',
        service: 'BrowserApiService',
        layer: 'api-service',
      });
    }
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    try {
      return await translateText(request);
    } catch (error) {
      throw errorHandlingService.handleApiError(error, {
        operation: 'translate text',
        service: 'BrowserApiService',
        layer: 'api-service',
        targetLang: request.targetLang,
      });
    }
  }

  async getSupportedLanguages(): Promise<LanguageCode[]> {
    try {
      return await fetchSupportedLanguages();
    } catch (error) {
      throw errorHandlingService.handleApiError(error, {
        operation: 'load supported languages',
        service: 'BrowserApiService',
        layer: 'api-service',
      });
    }
  }
}



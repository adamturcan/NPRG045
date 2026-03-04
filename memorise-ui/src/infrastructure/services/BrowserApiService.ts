
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
} from '../../core/interfaces/services/ApiService';
import { errorHandlingService } from './ErrorHandlingService';
import type { Segment } from '../../types/Segment';

const NER_ENDPOINT = "https://ner-api.dev.memorise.sdu.dk/recognize";
const SEGMENT_ENDPOINT = "https://textseg-api.dev.memorise.sdu.dk/segment";
const CLASSIFY_ENDPOINT = "https://semtag-api.dev.memorise.sdu.dk/classify";
/**
 * Browser-based implementation of the ApiService contract.
 *
 * Wraps the existing fetch-based helpers and normalises responses so that
 * presentation and hooks can rely on consistent shapes via the provider layer.
 */
export class BrowserApiService implements ApiServiceContract {
  async classify(text: string): Promise<{ label?: number; name?: string; }[]> {
    const context = { operation: "classify text", payloadLength: text.length };

    try {      
      const response = await fetch(CLASSIFY_ENDPOINT, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw errorHandlingService.handleApiError(response, context);
      }

      const data = await response.json();
      
      return Array.isArray(data?.result) 
        ? data.result 
        : Array.isArray(data?.results) ? data.results : [];

    } catch (error) {        
      if (errorHandlingService.isAppError(error)) throw error;
      throw errorHandlingService.handleApiError(error, context);
    }
  }

  async ner(text: string): Promise<NerSpan[]> {
    const context = { operation: "run NER", payloadLength: text.length };

    try {
      const response = await fetch(NER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw errorHandlingService.handleApiError(response, context);
      }

      const result = await response.json();
      const rawSpans = Array.isArray(result?.result) ? result.result : [];

      return rawSpans.map((span: { start: number; end: number; type: string; score?: number }) => ({
        start: span.start,
        end: span.end,
        entity: span.type,
        score: typeof span.score === "number" ? span.score : 1,
      }));

    } catch (error) {
    
      if (errorHandlingService.isAppError(error)) throw error; 
      
      throw errorHandlingService.handleApiError(error, context);
    }

  }

  async segmentText(text: string): Promise<Segment[]> {
    if (!text || text.trim().length === 0) return [];
    
    const context = { operation: "segment text", payloadLength: text.length };

    try {
      const response = await fetch(SEGMENT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw errorHandlingService.handleApiError(response, context);
      }

      const data = await response.json();
      if (!data.results || data.results.length === 0) return [];

      const segments: Segment[] = [];
      let searchStart = 0;

      for (let i = 0; i < data.results.length; i++) {
        const segmentText = data.results[i].sentence_text;
        let segmentStart = text.indexOf(segmentText, searchStart);

        if (segmentStart === -1) {
          segmentStart = text.indexOf(segmentText);
          if (segmentStart === -1) continue; 
        }

        const segmentEnd = segmentStart + segmentText.length;
        segments.push({
          id: `seg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          start: segmentStart,
          end: segmentEnd,
          order: data.results[i].label,
          text: segmentText
        });
        
        searchStart = segmentEnd;
      }

      return segments;
    } catch (error) {
      throw errorHandlingService.handleApiError(error, context);
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



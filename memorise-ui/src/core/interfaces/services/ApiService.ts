import type { NerSpan } from '../../../types/NotationEditor';
import type { LanguageCode, TranslationRequest, TranslationResponse } from '../../../shared/utils/translation';

/**
 * Classification result from the semantic tagging API.
 *
 * The service currently mirrors the raw API response (array of objects).
 * We keep the shape loose for forward compatibility.
 */
export type ClassificationResult = unknown;

/**
 * Contract for browser/API integrations that presentation can rely on.
 */
export interface ApiService {
  /**
   * Classify text (semantic tagging / categorisation).
   */
  classify(text: string): Promise<ClassificationResult>;

  /**
   * Run Named Entity Recognition and return normalised spans.
   */
  ner(text: string): Promise<NerSpan[]>;

  /**
   * Translate text between languages.
   */
  translate(params: TranslationRequest): Promise<TranslationResponse>;

  /**
   * Retrieve supported translation languages.
   */
  getSupportedLanguages(): Promise<LanguageCode[]>;
}



import type { NerSpan } from '../../../types/NotationEditor';

/**
 * Classification result from API
 */
export interface ClassificationResult {
  labels: number[];
  scores: number[];
}

/**
 * NER result from API
 */
export interface NerResult {
  spans: NerSpan[];
}

/**
 * Translation parameters
 */
export interface TranslationParams {
  text: string;
  targetLang: string;
  sourceLang?: string;
}

/**
 * Translation result from API
 */
export interface TranslationResult {
  translatedText: string;
  targetLang: string;
  sourceLang?: string;
}

/**
 * API Service interface
 * Defines the contract for external API interactions
 */
export interface ApiService {
  /**
   * Classify text (semantic classification)
   */
  classify(text: string): Promise<ClassificationResult>;

  /**
   * Named Entity Recognition on text
   */
  ner(text: string): Promise<NerResult>;

  /**
   * Translate text between languages
   */
  translate(params: TranslationParams): Promise<TranslationResult>;

}


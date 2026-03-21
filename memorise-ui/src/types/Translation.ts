export type LanguageCode = string;

export interface TranslationRequest {
  text: string;
  targetLang: LanguageCode;
  sourceLang?: LanguageCode;
}

export interface TranslationResponse {
  translatedText: string;
  targetLang: LanguageCode;
  sourceLang?: LanguageCode;
}

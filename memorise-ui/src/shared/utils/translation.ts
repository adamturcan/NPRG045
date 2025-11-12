/**
 * Translation API Integration
 *
 * This module provides translation services for the workspace editor.
 * Currently backed by the Memorise machine translation service.
 * Adjust `API_BASE_URL` and the request/response mapping below if the
 * endpoint or payload schema changes in the future.
 */

import { errorHandlingService } from "../../infrastructure/services/ErrorHandlingService";

// =============================================================================
// Configuration
// =============================================================================

export type LanguageCode = string;

const API_BASE_URL =
  import.meta.env.VITE_TRANSLATION_API_URL ?? "https://mt-api.dev.memorise.sdu.dk";

const SUPPORTED_LANGUAGES_ENDPOINT = `${API_BASE_URL.replace(/\/$/, "")}/supported_languages`;

const FALLBACK_LANGUAGES: LanguageCode[] = [
  "ar",
  "be",
  "bg",
  "bs",
  "cs",
  "da",
  "de",
  "el",
  "en",
  "es",
  "et",
  "fa",
  "fi",
  "fr",
  "ga",
  "he",
  "hi",
  "hr",
  "hu",
  "hy",
  "it",
  "jp",
  "ko",
  "ku",
  "lt",
  "lv",
  "mk",
  "mt",
  "nl",
  "no",
  "pl",
  "pt",
  "ro",
  "ru",
  "sk",
  "sl",
  "sr",
  "sv",
  "tr",
  "uk",
  "vi",
  "yi",
  "zh",
];

const LANGUAGE_DISPLAY_OVERRIDES: Record<LanguageCode, string> = {
  ar: "Arabic",
  be: "Belarusian",
  bg: "Bulgarian",
  bs: "Bosnian",
  cs: "Čeština (Czech)",
  da: "Dansk (Danish)",
  de: "Deutsch (German)",
  el: "Ελληνικά (Greek)",
  en: "English",
  es: "Español (Spanish)",
  et: "Eesti (Estonian)",
  fa: "فارسی (Persian)",
  fi: "Suomi (Finnish)",
  fr: "Français (French)",
  ga: "Gaeilge (Irish)",
  he: "עברית (Hebrew)",
  hi: "हिन्दी (Hindi)",
  hr: "Hrvatski (Croatian)",
  hu: "Magyar (Hungarian)",
  hy: "Հայերեն (Armenian)",
  it: "Italiano (Italian)",
  jp: "Japanese",
  ko: "한국어 (Korean)",
  ku: "Kurdish",
  lt: "Lietuvių (Lithuanian)",
  lv: "Latviešu (Latvian)",
  mk: "Македонски (Macedonian)",
  mt: "Malti (Maltese)",
  nl: "Nederlands (Dutch)",
  no: "Norsk (Norwegian)",
  pl: "Polski (Polish)",
  pt: "Português (Portuguese)",
  ro: "Română (Romanian)",
  ru: "Русский (Russian)",
  sk: "Slovenčina (Slovak)",
  sl: "Slovenščina (Slovenian)",
  sr: "Српски (Serbian)",
  sv: "Svenska (Swedish)",
  tr: "Türkçe (Turkish)",
  uk: "Українська (Ukrainian)",
  vi: "Tiếng Việt (Vietnamese)",
  yi: "ייִדיש (Yiddish)",
  zh: "中文 (Chinese)",
};

/**
 * Map old 3-letter codes to new 2-letter codes for backward compatibility
 */
const LANGUAGE_CODE_MAP: Record<string, LanguageCode> = {
  eng: "en",
  ces: "cs",
  dan: "da",
  nld: "nl",
};

let supportedLanguagesCache: LanguageCode[] | null = null;
let supportedLanguagesSetCache: Set<LanguageCode> | null = null;
let supportedLanguagesPromise: Promise<LanguageCode[]> | null = null;

/**
 * Translation request parameters
 */
export interface TranslationRequest {
  text: string;
  targetLang: LanguageCode;
  sourceLang?: LanguageCode;
}

/**
 * Translation response from API
 */
export interface TranslationResponse {
  translatedText: string;
  targetLang: LanguageCode;
  sourceLang?: LanguageCode;
}

// =============================================================================
// Language Detection & Translation Service
// =============================================================================

async function fetchSupportedLanguagesFromApi(): Promise<LanguageCode[]> {
  const context = {
    operation: "fetch supported languages",
    endpoint: SUPPORTED_LANGUAGES_ENDPOINT,
  };

  let response: Response;
  try {
    response = await fetch(SUPPORTED_LANGUAGES_ENDPOINT);
  } catch (error) {
    throw errorHandlingService.handleApiError(error, context);
  }

  if (!response.ok) {
    throw errorHandlingService.handleApiError(response, context);
  }

  let data: { languages?: unknown };
  try {
    data = (await response.json()) as { languages?: unknown };
  } catch (error) {
    throw errorHandlingService.handleApiError(error, {
      ...context,
      operation: "parse supported languages response",
    });
  }

  const languages = Array.isArray(data.languages)
    ? data.languages.filter(
        (lang): lang is LanguageCode => typeof lang === "string"
      )
    : null;

  if (!languages || languages.length === 0) {
    throw errorHandlingService.handleValidationError(
      "Supported languages response malformed",
      {
        ...context,
        receivedType: typeof data.languages,
      }
    );
  }

  return languages;
}

async function loadSupportedLanguages(): Promise<LanguageCode[]> {
  if (supportedLanguagesCache) {
    return supportedLanguagesCache;
  }

  if (!supportedLanguagesPromise) {
    supportedLanguagesPromise = (async () => {
      try {
        const languages = await fetchSupportedLanguagesFromApi();
        supportedLanguagesCache = languages;
        supportedLanguagesSetCache = new Set(languages);
        return languages;
      } catch (error) {
        const appError = errorHandlingService.handleApiError(error, {
          operation: "load supported languages",
          endpoint: SUPPORTED_LANGUAGES_ENDPOINT,
        });

        errorHandlingService.logError(appError, {
          component: "translation.loadSupportedLanguages",
        });

        console.warn(
          "Falling back to bundled supported languages list:",
          appError.message
        );
        supportedLanguagesCache = [...FALLBACK_LANGUAGES];
        supportedLanguagesSetCache = new Set(FALLBACK_LANGUAGES);
        return supportedLanguagesCache;
      } finally {
        supportedLanguagesPromise = null;
      }
    })();
  }

  return supportedLanguagesPromise;
}

async function memoizedSupportedLanguagesSet(): Promise<Set<LanguageCode>> {
  if (supportedLanguagesSetCache) {
    return supportedLanguagesSetCache;
  }

  const languages = await loadSupportedLanguages();
  supportedLanguagesSetCache = new Set(languages);
  return supportedLanguagesSetCache;
}

async function memoriseTranslate(
  request: TranslationRequest
): Promise<TranslationResponse> {
  const endpoint = `${API_BASE_URL.replace(/\/$/, "")}/translate`;

  const context = {
    operation: "translate text",
    endpoint,
    targetLang: request.targetLang,
    payloadLength: request.text.length,
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tgt_lang: request.targetLang,
        text: request.text,
      }),
    });
  } catch (error) {
    throw errorHandlingService.handleApiError(error, context);
  }

  if (!response.ok) {
    throw errorHandlingService.handleApiError(response, context);
  }

  let data: { text?: string };
  try {
    data = (await response.json()) as { text?: string };
  } catch (error) {
    throw errorHandlingService.handleApiError(error, {
      ...context,
      operation: "parse translation response",
    });
  }

  if (!data || typeof data.text !== "string") {
    throw errorHandlingService.handleValidationError(
      "Translation API returned an invalid response",
      {
        ...context,
        responseSnapshot: data,
      }
    );
  }

  return {
    translatedText: data.text,
    targetLang: request.targetLang,
    sourceLang: request.sourceLang,
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Translate text from source language to target language via the Memorise MT API.
 *
 * @param request - Translation parameters (text and target language; optional source language hint)
 * @returns Translation result with translated text
 * @throws Error if translation fails
 */
export async function translateText(
  request: TranslationRequest
): Promise<TranslationResponse> {
  // Input validation
  if (!request.text || !request.text.trim()) {
    throw errorHandlingService.handleValidationError(
      "Translation text cannot be empty",
      {
        operation: "validate translation request",
        field: "text",
      }
    );
  }

  if (request.text.length > 50000) {
    throw errorHandlingService.handleValidationError(
      "Translation text too long (max 50,000 characters)",
      {
        operation: "validate translation request",
        field: "text",
        length: request.text.length,
      }
    );
  }

  // Normalize language codes (handle old 3-letter codes)
  let sourceLang = request.sourceLang;
  let targetLang = request.targetLang;
  
  if (LANGUAGE_CODE_MAP[targetLang]) {
    targetLang = LANGUAGE_CODE_MAP[targetLang];
  }

  const supportedLanguages = await memoizedSupportedLanguagesSet();

  if (!supportedLanguages.has(targetLang)) {
    throw errorHandlingService.handleValidationError(
      `Unsupported target language: ${targetLang}`,
      {
        operation: "validate translation request",
        field: "targetLang",
        value: targetLang,
      }
    );
  }

  if (sourceLang && LANGUAGE_CODE_MAP[sourceLang]) {
    sourceLang = LANGUAGE_CODE_MAP[sourceLang];
  }

  if (sourceLang && !supportedLanguages.has(sourceLang)) {
    throw errorHandlingService.handleValidationError(
      `Unsupported source language: ${sourceLang}`,
      {
        operation: "validate translation request",
        field: "sourceLang",
        value: sourceLang,
      }
    );
  }

  const normalizedRequest = {
    ...request,
    sourceLang: sourceLang as LanguageCode | undefined,
    targetLang: targetLang as LanguageCode,
  } satisfies TranslationRequest;

  try {
    // Memorise MT API automatically detects the source language, so we only
    // provide the target language in the request payload. The detected source
    // language reported to callers comes from the input when provided.
    return await memoriseTranslate(normalizedRequest);
  } catch (error) {
    throw errorHandlingService.handleApiError(error, {
      operation: "translate text",
      targetLang: normalizedRequest.targetLang,
      sourceLang: normalizedRequest.sourceLang,
    });
  }
}

/**
 * Get list of supported language codes
 */
export async function getSupportedLanguages(options?: {
  forceRefresh?: boolean;
}): Promise<LanguageCode[]> {
  if (options?.forceRefresh) {
    supportedLanguagesCache = null;
    supportedLanguagesSetCache = null;
  }

  return loadSupportedLanguages();
}

const languageDisplayNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames !== "undefined"
    ? new Intl.DisplayNames(["en"], { type: "language" })
    : null;

/**
 * Get display name for a language code
 */
export function getLanguageName(code: LanguageCode): string {
  return (
    LANGUAGE_DISPLAY_OVERRIDES[code] ||
    languageDisplayNames?.of(code) ||
    (typeof code === "string" ? code.toUpperCase() : "")
  );
}

/**
 * Translate a single segment of text
 * This is a convenience wrapper around translateText for segment-based translation
 * 
 * @param segmentText - The text of the segment to translate
 * @param targetLang - Target language code
 * @param sourceLang - Optional source language hint
 * @returns Translation result with translated text
 * @throws Error if translation fails
 */
export async function translateSegment(
  segmentText: string,
  targetLang: LanguageCode,
  sourceLang?: LanguageCode
): Promise<TranslationResponse> {
  return translateText({
    text: segmentText,
    targetLang,
    sourceLang,
  });
}


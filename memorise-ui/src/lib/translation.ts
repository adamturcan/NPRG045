/**
 * Translation API Integration
 * 
 * This module provides translation services for the workspace editor.
 * Currently uses a mock implementation that will be replaced with
 * the team's OpenAPI endpoint when available.
 * 
 * To switch to the real API later:
 * 1. Update the API_BASE_URL constant
 * 2. Adjust the request/response format in translateText()
 * 3. Update supported languages if needed
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Supported language pairs for translation
 * Uses ISO 639-1 codes (2-letter) for API compatibility
 */
export const SUPPORTED_LANGUAGES = {
  en: "English",
  cs: "Čeština (Czech)",
  da: "Dansk (Danish)",
  nl: "Nederlands (Dutch)",
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

/**
 * Map old 3-letter codes to new 2-letter codes for backward compatibility
 */
const LANGUAGE_CODE_MAP: Record<string, LanguageCode> = {
  eng: "en",
  ces: "cs",
  dan: "da",
  nld: "nl",
};

/**
 * Translation request parameters
 */
export interface TranslationRequest {
  text: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
}

/**
 * Translation response from API
 */
export interface TranslationResponse {
  translatedText: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  detectedLanguage?: LanguageCode; // If auto-detect was used
}

// =============================================================================
// Language Detection & Translation Service
// =============================================================================

/**
 * Detect the language of text using LibreTranslate's free detection API
 * Falls back to heuristic detection if API fails
 * 
 * This is exported so it can be used by the UI to detect source language
 */
export async function detectLanguage(text: string): Promise<LanguageCode> {
  // Use a sample for detection (first 300 chars)
  const sample = text.slice(0, 300).trim();
  
  if (!sample) return "en";

  try {
    // Try LibreTranslate's free language detection API
    const response = await fetch("https://libretranslate.com/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: sample }),
    });

    if (response.ok) {
      const data = await response.json();
      // Returns array like [{ language: "cs", confidence: 0.95 }]
      if (data && data.length > 0) {
        const detected = data[0].language as string;
        
        // Map to our supported languages
        if (detected === "en") return "en";
        if (detected === "cs" || detected === "cz") return "cs";
        if (detected === "da") return "da";
        if (detected === "nl") return "nl";
      }
    }
  } catch (error) {
    console.warn("Language detection API failed, using fallback:", error);
  }

  // Fallback: Simple heuristic detection
  // Czech: ř, ž, ý, č, š, ě (unique characters)
  if (/[řžčšě]/i.test(sample)) return "cs";
  
  // Danish: æ, ø, å (unique characters)
  if (/[æø]/i.test(sample)) return "da";
  
  // Dutch: common words
  if (/\b(het|een|van|de|zijn|wordt)\b/i.test(sample)) return "nl";
  
  // Default to English
  return "en";
}

/**
 * MyMemory - Free translation API (10k words/day)
 * Using this for real translations until team provides OpenAPI endpoint
 */
async function myMemoryTranslate(
  request: TranslationRequest
): Promise<TranslationResponse> {
  let sourceLang = request.sourceLang;
  const targetLang = request.targetLang;
  
  // Auto-detect source language if it's the same as target
  if (sourceLang === targetLang) {
    sourceLang = await detectLanguage(request.text);
    
    // If detected language is still the same as target, just return original
    if (sourceLang === targetLang) {
      return {
        translatedText: request.text,
        sourceLang: sourceLang,
        targetLang: targetLang,
        detectedLanguage: sourceLang,
      };
    }
  }
  
  const langPair = `${sourceLang}|${targetLang}`;
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", request.text);
  url.searchParams.set("langpair", langPair);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Translation failed: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.responseStatus !== 200) {
    throw new Error(`Translation API error: ${data.responseDetails}`);
  }

  // Ensure we return valid text (fallback to original if translation fails)
  const translatedText = data.responseData?.translatedText || request.text;

  return {
    translatedText,
    sourceLang: sourceLang,
    targetLang: targetLang,
    detectedLanguage: sourceLang !== request.sourceLang ? sourceLang : undefined,
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Translate text from source language to target language
 * 
 * Currently uses mock implementation. To switch to real API:
 * 1. Replace mockTranslate with actual API call
 * 2. Update API_BASE_URL constant
 * 3. Adjust request/response format as needed
 * 
 * @param request - Translation parameters (text, source, target language)
 * @returns Translation result with translated text
 * @throws Error if translation fails
 */
export async function translateText(
  request: TranslationRequest
): Promise<TranslationResponse> {
  // Input validation
  if (!request.text || !request.text.trim()) {
    throw new Error("Translation text cannot be empty");
  }

  if (request.text.length > 50000) {
    throw new Error("Translation text too long (max 50,000 characters)");
  }

  // Normalize language codes (handle old 3-letter codes)
  let sourceLang = request.sourceLang;
  let targetLang = request.targetLang;
  
  if (LANGUAGE_CODE_MAP[sourceLang]) {
    sourceLang = LANGUAGE_CODE_MAP[sourceLang];
  }
  if (LANGUAGE_CODE_MAP[targetLang]) {
    targetLang = LANGUAGE_CODE_MAP[targetLang];
  }

  if (!SUPPORTED_LANGUAGES[sourceLang as LanguageCode]) {
    throw new Error(`Unsupported source language: ${sourceLang}`);
  }

  if (!SUPPORTED_LANGUAGES[targetLang as LanguageCode]) {
    throw new Error(`Unsupported target language: ${targetLang}`);
  }

  try {
    // Using MyMemory free translation API
    // Switch to your team's OpenAPI endpoint when available
    return await myMemoryTranslate({
      ...request,
      sourceLang: sourceLang as LanguageCode,
      targetLang: targetLang as LanguageCode,
    });
    
    // TODO: Replace with team's OpenAPI endpoint:
    // const response = await fetch("YOUR_API_URL", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(request),
    // });
    // if (!response.ok) throw new Error(`Translation failed: ${response.status}`);
    // return await response.json();
  } catch (error) {
    console.error("Translation error:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Translation service unavailable"
    );
  }
}

/**
 * Get list of supported language codes
 */
export function getSupportedLanguages(): LanguageCode[] {
  return Object.keys(SUPPORTED_LANGUAGES) as LanguageCode[];
}

/**
 * Get display name for a language code
 */
export function getLanguageName(code: LanguageCode): string {
  return SUPPORTED_LANGUAGES[code] || code;
}


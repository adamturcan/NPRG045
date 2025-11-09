import { classify as classifyRequest, ner as nerRequest } from "../lib/api";
import {
  translateText as translationService,
  type TranslationRequest,
  type TranslationResponse,
} from "../lib/translation";
import { errorHandlingService } from "../infrastructure/services/ErrorHandlingService";

export class ApiService {
  static async classify(text: string): Promise<{ name?: string; tag?: string; label?: number; keywordId?: number; parentId?: number }[]> {
    try {
      return await classifyRequest(text);
    } catch (error) {
      throw errorHandlingService.handleApiError(error, {
        operation: "classify text",
        layer: "ApiService",
      });
    }
  }

  static async ner(text: string): Promise<{ start: number; end: number; entity: string }[]> {
    try {
      return await nerRequest(text);
    } catch (error) {
      throw errorHandlingService.handleApiError(error, {
        operation: "run NER",
        layer: "ApiService",
      });
    }
  }

  static async translate(params: TranslationRequest): Promise<TranslationResponse> {
    try {
      return await translationService(params);
    } catch (error) {
      throw errorHandlingService.handleApiError(error, {
        operation: "translate text",
        layer: "ApiService",
      });
    }
  }
}

// Re-export for backward compatibility
export async function translateText(params: TranslationRequest): Promise<TranslationResponse> {
  try {
    return await translationService(params);
  } catch (error) {
    throw errorHandlingService.handleApiError(error, {
      operation: "translate text",
      layer: "ApiService",
      entrypoint: "function-export",
    });
  }
}

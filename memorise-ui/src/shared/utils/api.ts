import { errorHandlingService } from "../../infrastructure/services/ErrorHandlingService";

const CLASSIFY_ENDPOINT = "https://semtag-api.dev.memorise.sdu.dk/classify";
const NER_ENDPOINT = "https://ner-api.dev.memorise.sdu.dk/recognize";

export async function classify(text: string) {
  const context = {
    operation: "classify text",
    endpoint: CLASSIFY_ENDPOINT,
    payloadLength: text.length,
  };

  let response: Response;
  try {
    response = await fetch(CLASSIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (error) {
    throw errorHandlingService.handleApiError(error, context);
  }

  if (!response.ok) {
    throw errorHandlingService.handleApiError(response, context);
  }

  try {
    return await response.json();
  } catch (error) {
    throw errorHandlingService.handleApiError(error, {
      ...context,
      operation: "parse classification response",
    });
  }
}

export async function ner(text: string) {
  const context = {
    operation: "run NER",
    endpoint: NER_ENDPOINT,
    payloadLength: text.length,
  };

  let response: Response;
  try {
    response = await fetch(NER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (error) {
    throw errorHandlingService.handleApiError(error, context);
  }

  if (!response.ok) {
    throw errorHandlingService.handleApiError(response, context);
  }

  try {
    return await response.json();
  } catch (error) {
    throw errorHandlingService.handleApiError(error, {
      ...context,
      operation: "parse NER response",
    });
  }
}

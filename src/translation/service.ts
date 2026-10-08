import type {
  ExtensionSettings,
  TranslationRequest,
  TranslationResult
} from "../types";
import { translateWithDemo } from "./demo-provider";
import { translateWithLocalApi } from "./local-api-provider";

export async function translate(
  request: TranslationRequest,
  settings: ExtensionSettings
): Promise<TranslationResult> {
  if (!settings.enabled) {
    throw new Error("확장프로그램이 비활성화되어 있습니다.");
  }

  if (request.text.length > 5_000) {
    throw new Error("한 번에 번역할 수 있는 최대 길이는 5,000자입니다.");
  }

  if (settings.mode === "local-api") {
    return translateWithLocalApi(request, settings.localApiBaseUrl);
  }

  return translateWithDemo(request);
}

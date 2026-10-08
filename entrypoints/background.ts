import { browser } from "wxt/browser";
import { getSettings, saveSettings } from "../src/settings";
import { translate } from "../src/translation/service";
import type {
  BackgroundMessage,
  BackgroundResponse,
  ExtensionSettings,
  TranslationResult
} from "../src/types";
import {
  getUsage,
  recordTranslation,
  recordTranslationError
} from "../src/usage";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    async (message: BackgroundMessage): Promise<BackgroundResponse<unknown>> => {
      try {
        if (message.type === "get-settings") {
          return { ok: true, data: await getSettings() };
        }

        if (message.type === "save-settings") {
          await saveSettings(message.payload);
          return { ok: true, data: message.payload };
        }

        if (message.type === "get-usage") {
          return { ok: true, data: await getUsage() };
        }

        const settings = await getSettings();
        const request = {
          ...message.payload,
          requestId: crypto.randomUUID()
        };
        const result = await translate(request, settings);
        await recordTranslation(result.inputCharacters);
        return { ok: true, data: result satisfies TranslationResult };
      } catch (error) {
        await recordTranslationError();
        return {
          ok: false,
          error: error instanceof Error ? error.message : "번역 중 알 수 없는 오류가 발생했습니다."
        };
      }
    }
  );
});

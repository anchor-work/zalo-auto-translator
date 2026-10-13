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
import {
  getAuthState,
  getFirebaseIdToken,
  signInWithGoogle,
  signOut
} from "../src/auth/service";
import { isAuthConfigured } from "../src/auth/config";
import {
  createBillingRedirect,
  getAccountUsage
} from "../src/translation/local-api-provider";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === "install") {
      void browser.tabs.create({
        url: browser.runtime.getURL("/onboarding.html")
      });
    }
  });

  browser.runtime.onMessage.addListener(
    async (message: BackgroundMessage): Promise<BackgroundResponse<unknown>> => {
      try {
        if (message.type === "get-settings") {
          return { ok: true, data: await getSettings() };
        }

        if (message.type === "save-settings") {
          await saveSettings(message.payload);
          return { ok: true, data: await getSettings() };
        }

        if (message.type === "get-usage") {
          return { ok: true, data: await getUsage() };
        }

        if (message.type === "get-auth-state") {
          return { ok: true, data: await getAuthState() };
        }

        if (message.type === "sign-in") {
          return { ok: true, data: await signInWithGoogle() };
        }

        if (message.type === "sign-out") {
          return { ok: true, data: await signOut() };
        }

        if (message.type === "get-account-usage") {
          const settings = await getSettings();
          const idToken = await getFirebaseIdToken();
          if (!idToken) throw new Error("Sign in is required.");
          return {
            ok: true,
            data: await getAccountUsage(settings.localApiBaseUrl, idToken)
          };
        }

        if (message.type === "create-billing-checkout" || message.type === "create-billing-portal") {
          const settings = await getSettings();
          const idToken = await getFirebaseIdToken();
          if (!idToken) throw new Error("Sign in is required.");
          return {
            ok: true,
            data: await createBillingRedirect(
              settings.localApiBaseUrl,
              idToken,
              message.type === "create-billing-checkout" ? "checkout" : "portal"
            )
          };
        }

        const settings = await getSettings();
        const idToken = await getFirebaseIdToken();
        if (isAuthConfigured() && !idToken) {
          throw new Error("Sign in is required to use translation.");
        }
        const request = {
          ...message.payload,
          requestId: crypto.randomUUID()
        };
        const result = await translate(request, settings, idToken);
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

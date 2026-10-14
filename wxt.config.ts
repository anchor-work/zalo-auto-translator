import { defineConfig } from "wxt";

const PRODUCTION_API_ORIGIN =
  "https://zalo-translator-api-s6bip5vp3a-du.a.run.app";
const BUILD_API_ORIGIN =
  process.env.WXT_PUBLIC_API_BASE_URL?.trim() || PRODUCTION_API_ORIGIN;

function normalizeExtensionKey(value?: string): string {
  return (value ?? "")
    .replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "")
    .trim();
}

export default defineConfig({
  manifest: ({ mode }) => {
    const development = mode === "development";
    const icons = {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png"
    };

    const oauthClientId = process.env.WXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim();
    const extensionKey = normalizeExtensionKey(
      process.env.WXT_PUBLIC_EXTENSION_KEY
    );
    return {
      name: process.env.WXT_PUBLIC_BILLING_SANDBOX === "true"
        ? "Zalo Language Bridge (Sandbox)"
        : "Zalo Language Bridge",
      description: "Write and understand Zalo Web messages naturally across Korean, English, and Vietnamese.",
      version: "0.11.9",
      ...(extensionKey ? { key: extensionKey } : {}),
      permissions: ["storage", "identity"],
      ...(oauthClientId
        ? {
            oauth2: {
              client_id: oauthClientId,
              scopes: ["openid", "email", "profile"]
            }
          }
        : {}),
      host_permissions: development
        ? [
            "https://chat.zalo.me/*",
            "http://localhost/*",
            "http://127.0.0.1/*",
            `${PRODUCTION_API_ORIGIN}/*`,
            `${BUILD_API_ORIGIN}/*`
          ]
        : ["https://chat.zalo.me/*", `${BUILD_API_ORIGIN}/*`],
      icons,
      action: {
        default_title: "Zalo Language Bridge Settings",
        default_icon: icons
      }
    };
  }
});

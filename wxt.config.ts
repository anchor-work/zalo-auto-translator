import { defineConfig } from "wxt";

const PRODUCTION_API_ORIGIN =
  "https://zalo-translator-api-s6bip5vp3a-du.a.run.app";

export default defineConfig({
  manifest: ({ mode }) => {
    const development = mode === "development";
    const icons = {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png"
    };

    return {
      name: "Zalo Language Bridge",
      description: "Write and understand Zalo Web messages naturally across Korean, English, and Vietnamese.",
      version: "0.10.3",
      permissions: ["storage"],
      host_permissions: development
        ? [
            "https://chat.zalo.me/*",
            "http://localhost/*",
            "http://127.0.0.1/*",
            `${PRODUCTION_API_ORIGIN}/*`
          ]
        : ["https://chat.zalo.me/*", `${PRODUCTION_API_ORIGIN}/*`],
      icons,
      action: {
        default_title: "Zalo Language Bridge Settings",
        default_icon: icons
      }
    };
  }
});

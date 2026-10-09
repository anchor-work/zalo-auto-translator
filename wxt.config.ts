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
      name: "Zalo 한국어-베트남어 번역기",
      description: "Zalo Web에서 보낼 메시지를 베트남어·영어로, 받은 메시지를 한국어로 번역합니다.",
      version: "0.7.5",
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
        default_title: "Zalo 번역기 설정",
        default_icon: icons
      }
    };
  }
});

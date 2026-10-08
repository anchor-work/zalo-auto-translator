import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Zalo 한국어-베트남어 번역기",
    description: "Zalo Web에서 한국어 메시지를 베트남어로 번역하고 전송 전에 확인합니다.",
    version: "0.5.0",
    permissions: ["storage"],
    host_permissions: [
      "https://chat.zalo.me/*",
      "http://localhost/*",
      "http://127.0.0.1/*",
      "https://*.run.app/*"
    ],
    action: {
      default_title: "Zalo 번역기 설정"
    }
  }
});

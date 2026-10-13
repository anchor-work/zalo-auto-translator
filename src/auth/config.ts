export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

const config: FirebaseClientConfig = {
  apiKey: import.meta.env.WXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.WXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.WXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: import.meta.env.WXT_PUBLIC_FIREBASE_APP_ID ?? ""
};

export function getFirebaseClientConfig(): FirebaseClientConfig | null {
  return Object.values(config).every((value) => value.trim().length > 0)
    ? config
    : null;
}

export function isAuthConfigured(): boolean {
  return Boolean(
    getFirebaseClientConfig() &&
      (import.meta.env.WXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "").trim()
  );
}

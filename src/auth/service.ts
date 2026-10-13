import { initializeApp, type FirebaseApp } from "firebase/app";
import { browser } from "wxt/browser";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
  type Auth
} from "firebase/auth";
import { getFirebaseClientConfig, isAuthConfigured } from "./config";
import type { AuthState } from "../types";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let googleAccessToken: string | undefined;

function authInstance(): Auth {
  const config = getFirebaseClientConfig();
  if (!config || !isAuthConfigured()) {
    throw new Error("Firebase authentication is not configured for this build.");
  }
  app ??= initializeApp(config);
  auth ??= getAuth(app);
  return auth;
}

async function currentState(): Promise<AuthState> {
  if (!isAuthConfigured()) return { configured: false, signedIn: false };
  const instance = authInstance();
  await instance.authStateReady();
  const user = instance.currentUser;
  return user
    ? {
        configured: true,
        signedIn: true,
        user: {
          uid: user.uid,
          email: user.email ?? "",
          displayName: user.displayName ?? ""
        }
      }
    : { configured: true, signedIn: false };
}

export async function getAuthState(): Promise<AuthState> {
  return currentState();
}

export async function signInWithGoogle(): Promise<AuthState> {
  const tokenResult = await browser.identity.getAuthToken({ interactive: true });
  const token = typeof tokenResult === "string" ? tokenResult : tokenResult.token;
  if (!token) throw new Error("Google did not return an access token.");
  googleAccessToken = token;
  await signInWithCredential(
    authInstance(),
    GoogleAuthProvider.credential(null, token)
  );
  return currentState();
}

export async function signOut(): Promise<AuthState> {
  if (isAuthConfigured()) await firebaseSignOut(authInstance());
  let cachedToken = googleAccessToken;
  if (!cachedToken && isAuthConfigured()) {
    try {
      const tokenResult = await browser.identity.getAuthToken({ interactive: false });
      cachedToken =
        typeof tokenResult === "string" ? tokenResult : tokenResult.token;
    } catch {
      // No cached Google token remains; Firebase sign-out is already complete.
    }
  }
  if (cachedToken) {
    await browser.identity.removeCachedAuthToken({ token: cachedToken });
  }
  googleAccessToken = undefined;
  return { configured: isAuthConfigured(), signedIn: false };
}

export async function getFirebaseIdToken(): Promise<string | null> {
  if (!isAuthConfigured()) return null;
  const instance = authInstance();
  await instance.authStateReady();
  return instance.currentUser?.getIdToken() ?? null;
}

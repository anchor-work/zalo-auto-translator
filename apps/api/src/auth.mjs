import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function firebaseAdminAuth() {
  const app = getApps()[0] || initializeApp();
  return getAuth(app);
}

export async function verifyFirebaseIdToken(token) {
  return firebaseAdminAuth().verifyIdToken(token);
}

export function bearerToken(authorization) {
  if (typeof authorization !== "string") return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

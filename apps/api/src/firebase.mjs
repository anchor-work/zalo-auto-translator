import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export function firestoreInstance() {
  const app = getApps()[0] || initializeApp();
  const databaseId = process.env.ZALO_FIRESTORE_DATABASE_ID?.trim();
  return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
}


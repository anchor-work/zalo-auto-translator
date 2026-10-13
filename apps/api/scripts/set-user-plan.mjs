import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const [identifier, requestedPlan] = process.argv.slice(2);
const plan = requestedPlan?.toLowerCase();

if (!identifier || !["free", "pro"].includes(plan)) {
  console.error("Usage: npm run account:set-plan -- <Firebase UID or email> <free|pro>");
  process.exitCode = 1;
} else {
  const app = getApps()[0] || initializeApp();
  const databaseId = process.env.ZALO_FIRESTORE_DATABASE_ID?.trim();
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

  let userRef;
  if (identifier.includes("@")) {
    const matches = await db.collection("users").where("email", "==", identifier).limit(2).get();
    if (matches.empty) throw new Error("No signed-in user was found for that email address.");
    if (matches.size > 1) throw new Error("Multiple users matched that email address; use UID instead.");
    userRef = matches.docs[0].ref;
  } else {
    userRef = db.collection("users").doc(identifier);
    const snapshot = await userRef.get();
    if (!snapshot.exists) throw new Error("No signed-in user was found for that UID.");
  }

  await userRef.set(
    {
      plan,
      status: "active",
      planSource: "manual",
      planUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  console.log(`Updated ${userRef.id} to the ${plan} plan.`);
}

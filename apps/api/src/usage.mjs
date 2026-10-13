import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { TranslationError } from "./gemini.mjs";

export const PLAN_LIMITS = {
  free: {
    outgoing: { requests: 30, characters: 3_000, perRequestCharacters: 1_000 },
    incoming_manual: { requests: 30, characters: 5_000, perRequestCharacters: 5_000 },
    incoming_auto: { requests: 0, characters: 0, perRequestCharacters: 0 }
  },
  pro: {
    outgoing: { requests: 1_000, characters: 150_000, perRequestCharacters: 5_000 },
    incoming_manual: { requests: 1_000, characters: 150_000, perRequestCharacters: 5_000 },
    incoming_auto: { requests: 1_000, characters: 150_000, perRequestCharacters: 5_000 }
  }
};

const FIELD_PREFIX = {
  outgoing: "outgoing",
  incoming_manual: "incomingManual",
  incoming_auto: "incomingAuto"
};

function firestoreInstance() {
  const app = getApps()[0] || initializeApp();
  const databaseId = process.env.ZALO_FIRESTORE_DATABASE_ID?.trim();
  return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
}

export function billingPeriod(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function nextResetAt(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString();
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function planFor(value) {
  return value === "pro" ? "pro" : "free";
}

function usageBucket(data, translationType) {
  const prefix = FIELD_PREFIX[translationType];
  return {
    requests: number(data?.[`${prefix}Requests`]),
    characters: number(data?.[`${prefix}Characters`])
  };
}

export function usageSummary(plan, period, data, date = new Date()) {
  return {
    plan,
    period,
    resetAt: nextResetAt(date),
    limits: PLAN_LIMITS[plan],
    used: {
      outgoing: usageBucket(data, "outgoing"),
      incoming_manual: usageBucket(data, "incoming_manual"),
      incoming_auto: usageBucket(data, "incoming_auto")
    }
  };
}

function assertAllowed(plan, translationType, characters, current) {
  const limit = PLAN_LIMITS[plan][translationType];
  if (!limit || limit.requests === 0) {
    throw new TranslationError(
      "현재 요금제에서는 받은 메시지 자동 번역을 사용할 수 없습니다.",
      403,
      "feature_not_available"
    );
  }
  if (characters > limit.perRequestCharacters) {
    throw new TranslationError(
      `한 번에 최대 ${limit.perRequestCharacters.toLocaleString()}자까지 번역할 수 있습니다.`,
      413,
      "request_character_limit"
    );
  }
  if (
    current.requests + 1 > limit.requests ||
    current.characters + characters > limit.characters
  ) {
    throw new TranslationError(
      "이번 달 무료 번역 한도를 모두 사용했습니다.",
      429,
      "monthly_quota_exceeded"
    );
  }
}

export function createFirestoreUsageStore({ db = firestoreInstance(), now = () => new Date() } = {}) {
  async function readUser(transaction, identity) {
    const userRef = db.collection("users").doc(identity.uid);
    const userSnapshot = await transaction.get(userRef);
    const existing = userSnapshot.data();
    const plan = planFor(existing?.plan);
    if (existing?.status === "suspended") {
      throw new TranslationError("사용이 중지된 계정입니다.", 403, "account_suspended");
    }
    return { userRef, userSnapshot, plan };
  }

  function writeUser(transaction, identity, userRef, userSnapshot, plan) {
    const timestamp = FieldValue.serverTimestamp();
    transaction.set(userRef, {
      email: identity.email || "",
      displayName: identity.name || "",
      plan,
      status: "active",
      ...(userSnapshot.exists ? {} : { createdAt: timestamp }),
      updatedAt: timestamp,
      lastSeenAt: timestamp
    }, { merge: true });
  }

  return {
    async reserve(identity, translationType, characters) {
      const date = now();
      const period = billingPeriod(date);
      return db.runTransaction(async (transaction) => {
        const { userRef, userSnapshot, plan } = await readUser(transaction, identity);
        const usageRef = userRef.collection("usage").doc(period);
        const usageSnapshot = await transaction.get(usageRef);
        const data = usageSnapshot.data() || {};
        const current = usageBucket(data, translationType);
        assertAllowed(plan, translationType, characters, current);
        const prefix = FIELD_PREFIX[translationType];
        const updated = {
          ...data,
          [`${prefix}Requests`]: current.requests + 1,
          [`${prefix}Characters`]: current.characters + characters,
          updatedAt: FieldValue.serverTimestamp()
        };
        writeUser(transaction, identity, userRef, userSnapshot, plan);
        transaction.set(usageRef, updated, { merge: true });
        return {
          uid: identity.uid,
          period,
          translationType,
          characters,
          summary: usageSummary(plan, period, updated, date)
        };
      });
    },

    async commit(reservation, providerUsage = {}) {
      const usageRef = db
        .collection("users")
        .doc(reservation.uid)
        .collection("usage")
        .doc(reservation.period);
      await usageRef.set(
        {
          totalPromptTokens: FieldValue.increment(number(providerUsage.promptTokens)),
          totalOutputTokens: FieldValue.increment(number(providerUsage.outputTokens)),
          totalTokens: FieldValue.increment(number(providerUsage.totalTokens)),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    },

    async rollback(reservation) {
      const usageRef = db
        .collection("users")
        .doc(reservation.uid)
        .collection("usage")
        .doc(reservation.period);
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(usageRef);
        if (!snapshot.exists) return;
        const data = snapshot.data() || {};
        const prefix = FIELD_PREFIX[reservation.translationType];
        transaction.set(
          usageRef,
          {
            [`${prefix}Requests`]: Math.max(0, number(data[`${prefix}Requests`]) - 1),
            [`${prefix}Characters`]: Math.max(
              0,
              number(data[`${prefix}Characters`]) - reservation.characters
            ),
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      });
    },

    async getSummary(identity) {
      const date = now();
      const period = billingPeriod(date);
      return db.runTransaction(async (transaction) => {
        const { userRef, userSnapshot, plan } = await readUser(transaction, identity);
        const snapshot = await transaction.get(userRef.collection("usage").doc(period));
        writeUser(transaction, identity, userRef, userSnapshot, plan);
        return usageSummary(plan, period, snapshot.data() || {}, date);
      });
    }
  };
}

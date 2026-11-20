import { withCoreTransaction } from "./index";
import { ensureUserRowInTx } from "./economy";

export type GenderCode = "male" | "female" | "other" | "prefer_not_to_say";

export const GENDER_LABELS: Record<GenderCode, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

export function isValidGenderCode(raw: string): raw is GenderCode {
  return (
    raw === "male" ||
    raw === "female" ||
    raw === "other" ||
    raw === "prefer_not_to_say"
  );
}

export function formatGenderLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  if (isValidGenderCode(code)) {
    return GENDER_LABELS[code];
  }
  return code;
}

export async function setPlayerGenderOnceTx(
  userId: number,
  gender: GenderCode,
  now: number = Math.floor(Date.now() / 1000)
): Promise<
  | { status: "ok"; gender: GenderCode }
  | { status: "already_set"; existingGender: string }
> {
  return withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, userId, null, now);

    const res = await client.query(
      "SELECT gender FROM users WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    const current = res.rows[0]?.gender ? String(res.rows[0].gender) : null;

    if (current) {
      return { status: "already_set", existingGender: current };
    }

    await client.query(
      "UPDATE users SET gender = $1, updated_at = $2 WHERE user_id = $3",
      [gender, now, userId]
    );

    return { status: "ok", gender };
  });
}

export async function ownerSetPlayerGenderTx(params: {
  ownerId: number;
  targetUserId: number;
  targetFirstName?: string;
  newGender: GenderCode | null;
  idempotencyKey: string;
}): Promise<
  | { status: "ok"; previousGender: string | null; newGender: GenderCode | null }
  | { status: "duplicate" }
> {
  return withCoreTransaction(async (client) => {
    const now = Math.floor(Date.now() / 1000);

    const idemRes = await client.query(
      `INSERT INTO idempotency_keys (key, operation, status, created_at)
       VALUES ($1, 'owner_set_gender', 'completed', $2)
       ON CONFLICT (key) DO NOTHING
       RETURNING key`,
      [params.idempotencyKey, now]
    );
    if (idemRes.rows.length === 0) {
      return { status: "duplicate" };
    }

    await ensureUserRowInTx(client, params.targetUserId, params.targetFirstName, now);

    const userRes = await client.query(
      "SELECT gender FROM users WHERE user_id = $1 FOR UPDATE",
      [params.targetUserId]
    );
    const previousGender = userRes.rows[0]?.gender ? String(userRes.rows[0].gender) : null;

    await client.query(
      "UPDATE users SET gender = $1, updated_at = $2 WHERE user_id = $3",
      [params.newGender, now, params.targetUserId]
    );

    await client.query(
      `INSERT INTO owner_audit_logs (owner_id, target_user_id, action, amount, before_value, after_value, reference_id, created_at)
       VALUES ($1, $2, 'SET_GENDER', NULL, $3, $4, $5, $6)`,
      [
        params.ownerId,
        params.targetUserId,
        previousGender,
        params.newGender,
        params.idempotencyKey,
        now,
      ]
    );

    return {
      status: "ok",
      previousGender,
      newGender: params.newGender,
    };
  });
}

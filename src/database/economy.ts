import { PoolClient } from "pg";
import { withCoreTransaction } from "./index";
import { BOT_SETTINGS } from "../settings/bot-settings";
import { ECONOMY_LIMITS } from "../settings/economy-config";

export function getIstDateKey(timestampSec: number = Math.floor(Date.now() / 1000)): string {
  // Shift UTC timestamp by +05:30 (19800s) to align daily reset strictly with IST midnight
  const istMs = (timestampSec + 19800) * 1000;
  return new Date(istMs).toISOString().slice(0, 10);
}

export function getIstWeekKey(timestampSec: number = Math.floor(Date.now() / 1000)): string {
  const istDate = new Date((timestampSec + 19800) * 1000);
  const dayNum = istDate.getUTCDay() || 7;
  istDate.setUTCDate(istDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(istDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((istDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${istDate.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export async function ensureUserRowInTx(
  client: PoolClient,
  userId: number,
  firstName?: string | null,
  now: number = Math.floor(Date.now() / 1000)
): Promise<void> {
  const cleanName = firstName?.trim() || null;
  await client.query(
    `INSERT INTO users (user_id, first_name, balance, ammo, kills, is_alive, protected_until, last_daily, created_at, updated_at)
     VALUES ($1, $2, $3, 0, 0, 1, 0, 0, $4, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       first_name = COALESCE(EXCLUDED.first_name, users.first_name),
       updated_at = EXCLUDED.updated_at`,
    [userId, cleanName, BOT_SETTINGS.STARTING_BALANCE, now]
  );
}

export async function creditWalletInTx(
  client: PoolClient,
  params: {
    userId: number;
    amount: number;
    txType: string;
    referenceId?: string;
    idempotencyKey?: string;
    enforceDailyActiveCap?: boolean;
    now?: number;
  }
): Promise<
  | { status: "ok"; credited: number; oldBalance: number; newBalance: number }
  | { status: "daily_cap_reached"; dailyEarned: number; cap: number }
  | { status: "duplicate" }
> {
  const now = params.now ?? Math.floor(Date.now() / 1000);
  const todayKey = getIstDateKey(now);

  if (params.idempotencyKey) {
    const idemRes = await client.query(
      `INSERT INTO idempotency_keys (key, operation, status, created_at)
       VALUES ($1, $2, 'completed', $3)
       ON CONFLICT (key) DO NOTHING
       RETURNING key`,
      [params.idempotencyKey, params.txType, now]
    );
    if (idemRes.rows.length === 0) {
      return { status: "duplicate" };
    }
  }

  await ensureUserRowInTx(client, params.userId, null, now);

  const userRes = await client.query(
    "SELECT balance, daily_active_earned, daily_active_date FROM users WHERE user_id = $1 FOR UPDATE",
    [params.userId]
  );

  const row = userRes.rows[0];
  const oldBalance = Number(row?.balance ?? 0);
  const currentDailyEarned =
    row?.daily_active_date === todayKey ? Number(row?.daily_active_earned ?? 0) : 0;

  let actualCredit = Math.max(0, Math.floor(params.amount));

  if (params.enforceDailyActiveCap) {
    const remainingCap = Math.max(0, ECONOMY_LIMITS.DAILY_ACTIVE_INCOME_CAP - currentDailyEarned);
    if (remainingCap <= 0) {
      return {
        status: "daily_cap_reached",
        dailyEarned: currentDailyEarned,
        cap: ECONOMY_LIMITS.DAILY_ACTIVE_INCOME_CAP,
      };
    }
    actualCredit = Math.min(actualCredit, remainingCap);
  }

  const nextDailyEarned = params.enforceDailyActiveCap
    ? currentDailyEarned + actualCredit
    : currentDailyEarned;

  const updRes = await client.query(
    `UPDATE users
     SET balance = balance + $1,
         daily_active_earned = $2,
         daily_active_date = $3,
         updated_at = $4
     WHERE user_id = $5
     RETURNING balance`,
    [actualCredit, nextDailyEarned, todayKey, now, params.userId]
  );

  const newBalance = Number(updRes.rows[0].balance);

  await client.query(
    `INSERT INTO economy_transactions (user_id, tx_type, amount, balance_before, balance_after, reference_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      params.userId,
      params.txType,
      actualCredit,
      oldBalance,
      newBalance,
      params.referenceId || params.idempotencyKey || null,
      now,
    ]
  );

  return { status: "ok", credited: actualCredit, oldBalance, newBalance };
}

export async function debitWalletInTx(
  client: PoolClient,
  params: {
    userId: number;
    amount: number;
    txType: string;
    referenceId?: string;
    idempotencyKey?: string;
    now?: number;
  }
): Promise<
  | { status: "ok"; oldBalance: number; newBalance: number }
  | { status: "insufficient_balance"; balance: number }
  | { status: "duplicate" }
> {
  const now = params.now ?? Math.floor(Date.now() / 1000);
  const cost = Math.max(0, Math.floor(params.amount));

  if (params.idempotencyKey) {
    const idemRes = await client.query(
      `INSERT INTO idempotency_keys (key, operation, status, created_at)
       VALUES ($1, $2, 'completed', $3)
       ON CONFLICT (key) DO NOTHING
       RETURNING key`,
      [params.idempotencyKey, params.txType, now]
    );
    if (idemRes.rows.length === 0) {
      return { status: "duplicate" };
    }
  }

  await ensureUserRowInTx(client, params.userId, null, now);

  const userRes = await client.query(
    "SELECT balance FROM users WHERE user_id = $1 FOR UPDATE",
    [params.userId]
  );
  const oldBalance = Number(userRes.rows[0]?.balance ?? 0);

  if (oldBalance < cost) {
    return { status: "insufficient_balance", balance: oldBalance };
  }

  const updRes = await client.query(
    "UPDATE users SET balance = balance - $1, updated_at = $2 WHERE user_id = $3 RETURNING balance",
    [cost, now, params.userId]
  );
  const newBalance = Number(updRes.rows[0].balance);

  await client.query(
    `INSERT INTO economy_transactions (user_id, tx_type, amount, balance_before, balance_after, reference_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      params.userId,
      params.txType,
      -cost,
      oldBalance,
      newBalance,
      params.referenceId || params.idempotencyKey || null,
      now,
    ]
  );

  return { status: "ok", oldBalance, newBalance };
}

export async function adminAdjustWalletTx(params: {
  ownerId: number;
  targetUserId: number;
  targetFirstName?: string;
  deltaAmount: number;
  idempotencyKey: string;
}): Promise<
  | { status: "ok"; oldBalance: number; newBalance: number; adjustedAmount: number }
  | { status: "insufficient_balance"; balance: number }
  | { status: "duplicate" }
> {
  return withCoreTransaction(async (client) => {
    const now = Math.floor(Date.now() / 1000);

    const idemRes = await client.query(
      `INSERT INTO idempotency_keys (key, operation, status, created_at)
       VALUES ($1, 'owner_wallet_adjust', 'completed', $2)
       ON CONFLICT (key) DO NOTHING
       RETURNING key`,
      [params.idempotencyKey, now]
    );
    if (idemRes.rows.length === 0) {
      return { status: "duplicate" };
    }

    await ensureUserRowInTx(client, params.targetUserId, params.targetFirstName, now);

    const userRes = await client.query(
      "SELECT balance FROM users WHERE user_id = $1 FOR UPDATE",
      [params.targetUserId]
    );
    const oldBalance = Number(userRes.rows[0]?.balance ?? 0);
    const delta = Math.trunc(params.deltaAmount);

    if (delta < 0 && oldBalance + delta < 0) {
      return { status: "insufficient_balance", balance: oldBalance };
    }

    const updRes = await client.query(
      "UPDATE users SET balance = balance + $1, updated_at = $2 WHERE user_id = $3 RETURNING balance",
      [delta, now, params.targetUserId]
    );
    const newBalance = Number(updRes.rows[0].balance);

    const txType = delta >= 0 ? "OWNER_CREDIT" : "OWNER_DEBIT";

    await client.query(
      `INSERT INTO economy_transactions (user_id, tx_type, amount, balance_before, balance_after, reference_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [params.targetUserId, txType, delta, oldBalance, newBalance, params.idempotencyKey, now]
    );

    await client.query(
      `INSERT INTO owner_audit_logs (owner_id, target_user_id, action, amount, before_value, after_value, reference_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        params.ownerId,
        params.targetUserId,
        txType,
        delta,
        String(oldBalance),
        String(newBalance),
        params.idempotencyKey,
        now,
      ]
    );

    return { status: "ok", oldBalance, newBalance, adjustedAmount: delta };
  });
}

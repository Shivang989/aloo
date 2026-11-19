import { getCoreDb, withCoreTransaction } from "./index";
import { UserData } from "../types/player";
import { BOT_SETTINGS } from "../settings/bot-settings";

function mapUserRow(row: any): UserData {
  return {
    user_id: Number(row.user_id),
    first_name: row.first_name ?? null,
    balance: Number(row.balance ?? 0),
    ammo: Number(row.ammo ?? 0),
    kills: Number(row.kills ?? 0),
    is_alive: Number(row.is_alive ?? 1),
    protected_until: Number(row.protected_until ?? 0),
    last_daily: Number(row.last_daily ?? 0),
    created_at: row.created_at ? Number(row.created_at) : undefined,
    updated_at: row.updated_at ? Number(row.updated_at) : undefined,
  };
}

export async function ensureUserExists(userId: number, firstName?: string): Promise<void> {
  const db = getCoreDb();
  const cleanName = firstName?.trim() || null;
  const now = Math.floor(Date.now() / 1000);

  if (cleanName) {
    await db.query(
      `INSERT INTO users (user_id, first_name, balance, ammo, kills, is_alive, protected_until, last_daily, created_at, updated_at)
       VALUES ($1, $2, $3, 0, 0, 1, 0, 0, $4, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         updated_at = EXCLUDED.updated_at
       WHERE users.first_name IS DISTINCT FROM EXCLUDED.first_name`,
      [userId, cleanName, BOT_SETTINGS.STARTING_BALANCE, now]
    );
  } else {
    await db.query(
      `INSERT INTO users (user_id, first_name, balance, ammo, kills, is_alive, protected_until, last_daily, created_at, updated_at)
       VALUES ($1, NULL, $2, 0, 0, 1, 0, 0, $3, $3)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, BOT_SETTINGS.STARTING_BALANCE, now]
    );
  }
}

export async function syncUserFirstName(userId: number, firstName: string): Promise<void> {
  const cleanName = firstName.trim();
  if (!cleanName) return;
  const now = Math.floor(Date.now() / 1000);
  await getCoreDb().query(
    `UPDATE users SET first_name = $1, updated_at = $2
     WHERE user_id = $3 AND (first_name IS NULL OR first_name != $1)`,
    [cleanName, now, userId]
  );
}

export async function getUser(userId: number): Promise<UserData | null> {
  const res = await getCoreDb().query("SELECT * FROM users WHERE user_id = $1", [userId]);
  if (res.rows.length === 0) return null;
  return mapUserRow(res.rows[0]);
}

export async function updateBalance(userId: number, balance: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await getCoreDb().query("UPDATE users SET balance = $1, updated_at = $2 WHERE user_id = $3", [
    balance,
    now,
    userId,
  ]);
}

export async function getTopPlayers(limit: number = 5): Promise<UserData[]> {
  const res = await getCoreDb().query("SELECT * FROM users ORDER BY balance DESC LIMIT $1", [
    limit,
  ]);
  return res.rows.map(mapUserRow);
}

export async function activateSafeProtectionTx(
  userId: number,
  durationSec: number,
  price: number
): Promise<
  | { status: "ok"; expiryTimestamp: number; newBalance: number }
  | { status: "already_active"; protectedUntil: number }
  | { status: "insufficient_balance"; balance: number }
> {
  return withCoreTransaction(async (client) => {
    const now = Math.floor(Date.now() / 1000);
    await client.query(
      `INSERT INTO users (user_id, balance, ammo, kills, is_alive, protected_until, last_daily, created_at, updated_at)
       VALUES ($1, $2, 0, 0, 1, 0, 0, $3, $3)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, BOT_SETTINGS.STARTING_BALANCE, now]
    );

    const rowRes = await client.query(
      "SELECT balance, protected_until FROM users WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    const balance = Number(rowRes.rows[0].balance ?? 0);
    const protectedUntil = Number(rowRes.rows[0].protected_until ?? 0);

    if (protectedUntil > now) {
      return { status: "already_active", protectedUntil };
    }
    if (balance < price) {
      return { status: "insufficient_balance", balance };
    }

    const expiryTimestamp = now + durationSec;
    const upd = await client.query(
      `UPDATE users
       SET balance = balance - $1, protected_until = $2, updated_at = $3
       WHERE user_id = $4
       RETURNING balance`,
      [price, expiryTimestamp, now, userId]
    );
    const newBalance = Number(upd.rows[0].balance);

    await client.query(
      `INSERT INTO economy_transactions (user_id, tx_type, amount, balance_before, balance_after, created_at)
       VALUES ($1, 'safe_purchase', $2, $3, $4, $5)`,
      [userId, -price, balance, newBalance, now]
    );

    return { status: "ok", expiryTimestamp, newBalance };
  });
}

export async function purchaseBulletsTx(
  userId: number,
  quantity: number,
  unitPrice: number
): Promise<
  | { status: "ok"; newBalance: number; newBullets: number }
  | { status: "insufficient_balance"; balance: number }
> {
  return withCoreTransaction(async (client) => {
    const now = Math.floor(Date.now() / 1000);
    await client.query(
      `INSERT INTO users (user_id, balance, ammo, kills, is_alive, protected_until, last_daily, created_at, updated_at)
       VALUES ($1, $2, 0, 0, 1, 0, 0, $3, $3)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, BOT_SETTINGS.STARTING_BALANCE, now]
    );

    const rowRes = await client.query(
      "SELECT balance, ammo FROM users WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    const balance = Number(rowRes.rows[0].balance ?? 0);
    const cost = quantity * unitPrice;

    if (balance < cost) {
      return { status: "insufficient_balance", balance };
    }

    const upd = await client.query(
      `UPDATE users
       SET balance = balance - $1, ammo = ammo + $2, updated_at = $3
       WHERE user_id = $4
       RETURNING balance, ammo`,
      [cost, quantity, now, userId]
    );
    const newBalance = Number(upd.rows[0].balance);
    const newBullets = Number(upd.rows[0].ammo);

    await client.query(
      `INSERT INTO economy_transactions (user_id, tx_type, amount, balance_before, balance_after, created_at)
       VALUES ($1, 'bullet_purchase', $2, $3, $4, $5)`,
      [userId, -cost, balance, newBalance, now]
    );

    return { status: "ok", newBalance, newBullets };
  });
}

export async function claimDailyRewardTx(
  userId: number,
  reward: number,
  cooldownSeconds: number
): Promise<
  | { status: "ok"; newBalance: number }
  | { status: "cooldown"; remainingSeconds: number }
> {
  return withCoreTransaction(async (client) => {
    const now = Math.floor(Date.now() / 1000);
    await client.query(
      `INSERT INTO users (user_id, balance, ammo, kills, is_alive, protected_until, last_daily, created_at, updated_at)
       VALUES ($1, $2, 0, 0, 1, 0, 0, $3, $3)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, BOT_SETTINGS.STARTING_BALANCE, now]
    );

    const rowRes = await client.query(
      "SELECT balance, last_daily FROM users WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    const balance = Number(rowRes.rows[0].balance ?? 0);
    const lastDaily = Number(rowRes.rows[0].last_daily ?? 0);
    const threshold = now - cooldownSeconds;

    if (lastDaily > 0 && lastDaily > threshold) {
      const remainingSeconds = Math.max(0, cooldownSeconds - (now - lastDaily));
      return { status: "cooldown", remainingSeconds };
    }

    const upd = await client.query(
      `UPDATE users
       SET balance = balance + $1, last_daily = $2, updated_at = $3
       WHERE user_id = $4
       RETURNING balance`,
      [reward, now, now, userId]
    );
    const newBalance = Number(upd.rows[0].balance);

    await client.query(
      `INSERT INTO economy_transactions (user_id, tx_type, amount, balance_before, balance_after, created_at)
       VALUES ($1, 'daily_reward', $2, $3, $4, $5)`,
      [userId, reward, balance, newBalance, now]
    );

    return { status: "ok", newBalance };
  });
}

export async function robPlayerTx(
  attackerId: number,
  targetId: number,
  amount: number
): Promise<
  | { status: "ok" }
  | { status: "attacker_dead" }
  | { status: "target_not_found" }
  | { status: "target_protected" }
  | { status: "target_insufficient" }
> {
  return withCoreTransaction(async (client) => {
    const now = Math.floor(Date.now() / 1000);
    await client.query(
      `INSERT INTO users (user_id, balance, ammo, kills, is_alive, protected_until, last_daily, created_at, updated_at)
       VALUES ($1, $2, 0, 0, 1, 0, 0, $3, $3)
       ON CONFLICT (user_id) DO NOTHING`,
      [attackerId, BOT_SETTINGS.STARTING_BALANCE, now]
    );

    const lockRes = await client.query(
      "SELECT * FROM users WHERE user_id = ANY($1::bigint[]) ORDER BY user_id ASC FOR UPDATE",
      [[attackerId, targetId]]
    );

    const attackerRow = lockRes.rows.find((r) => Number(r.user_id) === attackerId);
    const targetRow = lockRes.rows.find((r) => Number(r.user_id) === targetId);

    if (!attackerRow || Number(attackerRow.is_alive) === 0) {
      return { status: "attacker_dead" };
    }
    if (!targetRow) {
      return { status: "target_not_found" };
    }

    const attackerBal = Number(attackerRow.balance ?? 0);
    const targetBal = Number(targetRow.balance ?? 0);
    const targetProtectedUntil = Number(targetRow.protected_until ?? 0);

    if (targetProtectedUntil > now) {
      await client.query(
        "UPDATE users SET balance = balance + 10, updated_at = $1 WHERE user_id = $2",
        [now, attackerId]
      );
      await client.query(
        `INSERT INTO economy_transactions (user_id, tx_type, amount, balance_before, balance_after, created_at)
         VALUES ($1, 'rob_compensation', 10, $2, $3, $4)`,
        [attackerId, attackerBal, attackerBal + 10, now]
      );
      return { status: "target_protected" };
    }

    if (targetBal < amount) {
      return { status: "target_insufficient" };
    }

    await client.query(
      "UPDATE users SET balance = balance - $1, updated_at = $2 WHERE user_id = $3",
      [amount, now, targetId]
    );
    await client.query(
      "UPDATE users SET balance = balance + $1, updated_at = $2 WHERE user_id = $3",
      [amount, now, attackerId]
    );

    await client.query(
      `INSERT INTO economy_transactions (user_id, tx_type, amount, balance_before, balance_after, created_at)
       VALUES ($1, 'rob_loss', $2, $3, $4, $5), ($6, 'rob_gain', $7, $8, $9, $5)`,
      [
        targetId,
        -amount,
        targetBal,
        targetBal - amount,
        now,
        attackerId,
        amount,
        attackerBal,
        attackerBal + amount,
      ]
    );

    return { status: "ok" };
  });
}

export async function transferMoneyTx(
  senderId: number,
  targetId: number,
  amount: number
): Promise<
  | { status: "ok"; senderNewBalance: number }
  | { status: "sender_dead" }
  | { status: "insufficient_balance"; balance: number }
> {
  return withCoreTransaction(async (client) => {
    const now = Math.floor(Date.now() / 1000);
    for (const uid of [senderId, targetId]) {
      await client.query(
        `INSERT INTO users (user_id, balance, ammo, kills, is_alive, protected_until, last_daily, created_at, updated_at)
         VALUES ($1, $2, 0, 0, 1, 0, 0, $3, $3)
         ON CONFLICT (user_id) DO NOTHING`,
        [uid, BOT_SETTINGS.STARTING_BALANCE, now]
      );
    }

    const lockRes = await client.query(
      "SELECT * FROM users WHERE user_id = ANY($1::bigint[]) ORDER BY user_id ASC FOR UPDATE",
      [[senderId, targetId]]
    );

    const senderRow = lockRes.rows.find((r) => Number(r.user_id) === senderId);
    const targetRow = lockRes.rows.find((r) => Number(r.user_id) === targetId);

    if (!senderRow || Number(senderRow.is_alive) === 0) {
      return { status: "sender_dead" };
    }

    const senderBal = Number(senderRow.balance ?? 0);
    const targetBal = Number(targetRow?.balance ?? 0);

    if (senderBal < amount) {
      return { status: "insufficient_balance", balance: senderBal };
    }

    await client.query(
      "UPDATE users SET balance = balance - $1, updated_at = $2 WHERE user_id = $3",
      [amount, now, senderId]
    );
    await client.query(
      "UPDATE users SET balance = balance + $1, updated_at = $2 WHERE user_id = $3",
      [amount, now, targetId]
    );

    await client.query(
      `INSERT INTO economy_transactions (user_id, tx_type, amount, balance_before, balance_after, created_at)
       VALUES ($1, 'transfer_out', $2, $3, $4, $5), ($6, 'transfer_in', $7, $8, $9, $5)`,
      [
        senderId,
        -amount,
        senderBal,
        senderBal - amount,
        now,
        targetId,
        amount,
        targetBal,
        targetBal + amount,
      ]
    );

    return { status: "ok", senderNewBalance: senderBal - amount };
  });
}

export async function fireAtTargetTx(
  attackerId: number,
  targetId: number
): Promise<
  | { status: "eliminated"; reward: number; remainingBullets: number }
  | { status: "attacker_dead" }
  | { status: "no_ammo" }
  | { status: "target_not_found" }
  | { status: "target_dead" }
  | { status: "target_protected"; remainingBullets: number }
> {
  return withCoreTransaction(async (client) => {
    const now = Math.floor(Date.now() / 1000);
    await client.query(
      `INSERT INTO users (user_id, balance, ammo, kills, is_alive, protected_until, last_daily, created_at, updated_at)
       VALUES ($1, $2, 0, 0, 1, 0, 0, $3, $3)
       ON CONFLICT (user_id) DO NOTHING`,
      [attackerId, BOT_SETTINGS.STARTING_BALANCE, now]
    );

    const lockRes = await client.query(
      "SELECT * FROM users WHERE user_id = ANY($1::bigint[]) ORDER BY user_id ASC FOR UPDATE",
      [[attackerId, targetId]]
    );

    const attackerRow = lockRes.rows.find((r) => Number(r.user_id) === attackerId);
    const targetRow = lockRes.rows.find((r) => Number(r.user_id) === targetId);

    if (!attackerRow || Number(attackerRow.is_alive) === 0) {
      return { status: "attacker_dead" };
    }
    if (Number(attackerRow.ammo ?? 0) <= 0) {
      return { status: "no_ammo" };
    }
    if (!targetRow) {
      return { status: "target_not_found" };
    }
    if (Number(targetRow.is_alive) === 0) {
      return { status: "target_dead" };
    }

    // Consume 1 bullet atomically
    const ammoUpd = await client.query(
      "UPDATE users SET ammo = ammo - 1, updated_at = $1 WHERE user_id = $2 RETURNING ammo",
      [now, attackerId]
    );
    const remainingBullets = Number(ammoUpd.rows[0].ammo);

    if (Number(targetRow.protected_until ?? 0) > now) {
      return { status: "target_protected", remainingBullets };
    }

    const reward = Math.floor(Math.random() * (300 - 200 + 1)) + 200;
    const attackerBal = Number(attackerRow.balance ?? 0);

    await client.query("UPDATE users SET is_alive = 0, updated_at = $1 WHERE user_id = $2", [
      now,
      targetId,
    ]);
    await client.query(
      "UPDATE users SET balance = balance + $1, kills = kills + 1, updated_at = $2 WHERE user_id = $3",
      [reward, now, attackerId]
    );

    await client.query(
      `INSERT INTO economy_transactions (user_id, tx_type, amount, balance_before, balance_after, created_at)
       VALUES ($1, 'kill_reward', $2, $3, $4, $5)`,
      [attackerId, reward, attackerBal, attackerBal + reward, now]
    );

    return { status: "eliminated", reward, remainingBullets };
  });
}

export async function deployShieldTx(
  userId: number,
  cost: number,
  durationSec: number
): Promise<
  | { status: "ok"; newBalance: number; expireTime: number }
  | { status: "not_found" }
  | { status: "dead" }
  | { status: "insufficient_balance" }
> {
  return withCoreTransaction(async (client) => {
    const now = Math.floor(Date.now() / 1000);
    const rowRes = await client.query(
      "SELECT balance, is_alive FROM users WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    if (rowRes.rows.length === 0) return { status: "not_found" };

    const balance = Number(rowRes.rows[0].balance ?? 0);
    const isAlive = Number(rowRes.rows[0].is_alive ?? 1);

    if (isAlive === 0) return { status: "dead" };
    if (balance < cost) return { status: "insufficient_balance" };

    const expireTime = now + durationSec;
    const upd = await client.query(
      `UPDATE users
       SET balance = balance - $1, protected_until = $2, updated_at = $3
       WHERE user_id = $4
       RETURNING balance`,
      [cost, expireTime, now, userId]
    );
    const newBalance = Number(upd.rows[0].balance);

    await client.query(
      `INSERT INTO economy_transactions (user_id, tx_type, amount, balance_before, balance_after, created_at)
       VALUES ($1, 'shield_purchase', $2, $3, $4, $5)`,
      [userId, -cost, balance, newBalance, now]
    );

    return { status: "ok", newBalance, expireTime };
  });
}

export async function revivePlayerTx(
  userId: number,
  cost: number
): Promise<
  | { status: "ok"; newBalance: number }
  | { status: "not_found" }
  | { status: "already_alive" }
  | { status: "insufficient_balance" }
> {
  return withCoreTransaction(async (client) => {
    const now = Math.floor(Date.now() / 1000);
    const rowRes = await client.query(
      "SELECT balance, is_alive FROM users WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    if (rowRes.rows.length === 0) return { status: "not_found" };

    const balance = Number(rowRes.rows[0].balance ?? 0);
    const isAlive = Number(rowRes.rows[0].is_alive ?? 1);

    if (isAlive === 1) return { status: "already_alive" };
    if (balance < cost) return { status: "insufficient_balance" };

    const upd = await client.query(
      `UPDATE users
       SET balance = balance - $1, is_alive = 1, updated_at = $2
       WHERE user_id = $3
       RETURNING balance`,
      [cost, now, userId]
    );
    const newBalance = Number(upd.rows[0].balance);

    await client.query(
      `INSERT INTO economy_transactions (user_id, tx_type, amount, balance_before, balance_after, created_at)
       VALUES ($1, 'revive_purchase', $2, $3, $4, $5)`,
      [userId, -cost, balance, newBalance, now]
    );

    return { status: "ok", newBalance };
  });
}

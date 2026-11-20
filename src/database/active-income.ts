import { PoolClient } from "pg";
import { getCoreDb, withCoreTransaction } from "./index";
import {
  creditWalletInTx,
  ensureUserRowInTx,
  getIstDateKey,
  getIstWeekKey,
} from "./economy";
import {
  DAILY_MISSIONS,
  ECONOMY_LIMITS,
  MissionDefinition,
  PROFESSIONS,
  WEEKLY_CHALLENGES,
} from "../settings/economy-config";

export interface UserWorkState {
  balance: number;
  profession: string | null;
  lastWorkAt: number;
  lastJobChangeAt: number;
  dailyActiveEarned: number;
  totalShifts: number;
}

export interface DeliveryOrderRow {
  order_id: string;
  user_id: number;
  delivery_type: string;
  title: string;
  destination: string;
  base_reward: number;
  vehicle_bonus: number;
  status: "offered" | "accepted" | "completed" | "skipped" | "expired";
  expires_at: number;
  created_at: number;
}

export interface FreelanceTaskRow {
  task_id: string;
  user_id: number;
  title: string;
  category: string;
  reward: number;
  status: "open" | "completed" | "expired";
  expires_at: number;
  created_at: number;
}

export interface MissionProgressItem {
  mission_id: string;
  period: "daily" | "weekly";
  title: string;
  progress: number;
  target: number;
  reward: number;
  claimed: boolean;
}

async function ensurePeriodMissionsInTx(
  client: PoolClient,
  userId: number,
  period: "daily" | "weekly",
  periodKey: string,
  now: number
): Promise<void> {
  const catalog: readonly MissionDefinition[] =
    period === "daily" ? DAILY_MISSIONS : WEEKLY_CHALLENGES;

  for (const m of catalog) {
    await client.query(
      `INSERT INTO mission_progress (user_id, period_type, period_key, mission_id, progress, target, reward, claimed, updated_at)
       VALUES ($1, $2, $3, $4, 0, $5, $6, 0, $7)
       ON CONFLICT (user_id, period_type, period_key, mission_id) DO NOTHING`,
      [userId, period, periodKey, m.id, m.target, m.reward, now]
    );
  }
}

export async function incrementMissionMetricInTx(
  client: PoolClient,
  userId: number,
  metric: MissionDefinition["metric"],
  delta: number = 1,
  now: number = Math.floor(Date.now() / 1000)
): Promise<void> {
  if (delta <= 0) return;

  const dayKey = getIstDateKey(now);
  const weekKey = getIstWeekKey(now);

  await ensurePeriodMissionsInTx(client, userId, "daily", dayKey, now);
  await ensurePeriodMissionsInTx(client, userId, "weekly", weekKey, now);

  const matchingDaily = DAILY_MISSIONS.filter((m) => m.metric === metric).map((m) => m.id);
  if (matchingDaily.length > 0) {
    await client.query(
      `UPDATE mission_progress
       SET progress = LEAST(target, progress + $1),
           updated_at = $2
       WHERE user_id = $3
         AND period_type = 'daily'
         AND period_key = $4
         AND mission_id = ANY($5::text[])
         AND claimed = 0`,
      [delta, now, userId, dayKey, matchingDaily]
    );
  }

  const matchingWeekly = WEEKLY_CHALLENGES.filter((m) => m.metric === metric).map((m) => m.id);
  if (matchingWeekly.length > 0) {
    await client.query(
      `UPDATE mission_progress
       SET progress = LEAST(target, progress + $1),
           updated_at = $2
       WHERE user_id = $3
         AND period_type = 'weekly'
         AND period_key = $4
         AND mission_id = ANY($5::text[])
         AND claimed = 0`,
      [delta, now, userId, weekKey, matchingWeekly]
    );
  }
}

export async function recordMissionEvent(
  userId: number,
  metric: MissionDefinition["metric"],
  delta: number = 1
): Promise<void> {
  try {
    await withCoreTransaction(async (client) => {
      const now = Math.floor(Date.now() / 1000);
      await ensureUserRowInTx(client, userId, null, now);
      await incrementMissionMetricInTx(client, userId, metric, delta, now);
    });
  } catch (err) {
    console.error("Non-fatal recordMissionEvent error:", err);
  }
}

// ==========================================
// 💼 WORK & PROFESSIONS
// ==========================================

export async function getUserWorkState(
  userId: number,
  now: number = Math.floor(Date.now() / 1000)
): Promise<UserWorkState> {
  const db = getCoreDb();
  const todayKey = getIstDateKey(now);

  const [userRes, countRes] = await Promise.all([
    db.query(
      `SELECT balance, profession, last_work_at, last_job_change_at, daily_active_earned, daily_active_date
       FROM users WHERE user_id = $1`,
      [userId]
    ),
    db.query(
      `SELECT COUNT(*)::int AS cnt FROM economy_transactions WHERE user_id = $1 AND tx_type = 'work_shift'`,
      [userId]
    ),
  ]);

  const row = userRes.rows[0];
  const dailyEarned =
    row?.daily_active_date === todayKey ? Number(row?.daily_active_earned ?? 0) : 0;

  return {
    balance: Number(row?.balance ?? 0),
    profession: row?.profession ? String(row.profession) : null,
    lastWorkAt: Number(row?.last_work_at ?? 0),
    lastJobChangeAt: Number(row?.last_job_change_at ?? 0),
    dailyActiveEarned: dailyEarned,
    totalShifts: Number(countRes.rows[0]?.cnt ?? 0),
  };
}

export async function selectUserProfession(
  userId: number,
  professionId: string,
  now: number = Math.floor(Date.now() / 1000)
): Promise<
  | { status: "ok"; professionId: string }
  | { status: "invalid_profession" }
  | { status: "already_selected" }
  | { status: "switch_cooldown"; remainingSec: number }
> {
  const prof = PROFESSIONS.find((p) => p.id === professionId);
  if (!prof) return { status: "invalid_profession" };

  return withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, userId, null, now);
    const res = await client.query(
      "SELECT profession, last_job_change_at FROM users WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    const currentProf = res.rows[0]?.profession ? String(res.rows[0].profession) : null;
    const lastChange = Number(res.rows[0]?.last_job_change_at ?? 0);

    if (currentProf === professionId) {
      return { status: "already_selected" };
    }

    if (currentProf !== null && lastChange > 0) {
      const elapsed = now - lastChange;
      if (elapsed < ECONOMY_LIMITS.JOB_SWITCH_COOLDOWN_SEC) {
        return {
          status: "switch_cooldown",
          remainingSec: ECONOMY_LIMITS.JOB_SWITCH_COOLDOWN_SEC - elapsed,
        };
      }
    }

    await client.query(
      "UPDATE users SET profession = $1, last_job_change_at = $2, updated_at = $2 WHERE user_id = $3",
      [professionId, now, userId]
    );

    return { status: "ok", professionId };
  });
}

export async function completeWorkShiftTx(
  userId: number,
  rewardAmount: number,
  idempotencyKey: string,
  now: number = Math.floor(Date.now() / 1000)
): Promise<
  | { status: "ok"; professionId: string; earned: number; newBalance: number }
  | { status: "no_profession" }
  | { status: "cooldown"; remainingSec: number }
  | { status: "daily_cap_reached"; cap: number }
  | { status: "duplicate" }
> {
  return withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, userId, null, now);

    const userRes = await client.query(
      "SELECT profession, last_work_at FROM users WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    const professionId = userRes.rows[0]?.profession ? String(userRes.rows[0].profession) : null;
    const lastWorkAt = Number(userRes.rows[0]?.last_work_at ?? 0);

    if (!professionId) {
      return { status: "no_profession" };
    }

    const elapsed = now - lastWorkAt;
    if (lastWorkAt > 0 && elapsed < ECONOMY_LIMITS.WORK_COOLDOWN_SEC) {
      return {
        status: "cooldown",
        remainingSec: ECONOMY_LIMITS.WORK_COOLDOWN_SEC - elapsed,
      };
    }

    const creditRes = await creditWalletInTx(client, {
      userId,
      amount: rewardAmount,
      txType: "work_shift",
      referenceId: professionId,
      idempotencyKey,
      enforceDailyActiveCap: true,
      now,
    });

    if (creditRes.status === "duplicate") return { status: "duplicate" };
    if (creditRes.status === "daily_cap_reached") {
      return { status: "daily_cap_reached", cap: creditRes.cap };
    }

    await client.query(
      "UPDATE users SET last_work_at = $1, updated_at = $1 WHERE user_id = $2",
      [now, userId]
    );

    await incrementMissionMetricInTx(client, userId, "work_shifts", 1, now);
    await incrementMissionMetricInTx(client, userId, "eligible_activities", 1, now);

    return {
      status: "ok",
      professionId,
      earned: creditRes.credited,
      newBalance: creditRes.newBalance,
    };
  });
}

// ==========================================
// 📦 DELIVERY SYSTEM
// ==========================================

export async function getDeliveryState(
  userId: number,
  now: number = Math.floor(Date.now() / 1000)
): Promise<{
  lastDeliveryAt: number;
  activeOrder: DeliveryOrderRow | null;
}> {
  const db = getCoreDb();
  const [userRes, orderRes] = await Promise.all([
    db.query("SELECT last_delivery_at FROM users WHERE user_id = $1", [userId]),
    db.query(
      `SELECT order_id, user_id, delivery_type, title, destination, base_reward, vehicle_bonus, status, expires_at, created_at
       FROM delivery_orders
       WHERE user_id = $1 AND status IN ('offered', 'accepted') AND expires_at > $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, now]
    ),
  ]);

  const row = orderRes.rows[0];
  return {
    lastDeliveryAt: Number(userRes.rows[0]?.last_delivery_at ?? 0),
    activeOrder: row
      ? {
          order_id: String(row.order_id),
          user_id: Number(row.user_id),
          delivery_type: String(row.delivery_type),
          title: String(row.title),
          destination: String(row.destination),
          base_reward: Number(row.base_reward),
          vehicle_bonus: Number(row.vehicle_bonus),
          status: row.status,
          expires_at: Number(row.expires_at),
          created_at: Number(row.created_at),
        }
      : null,
  };
}

export async function createDeliveryOrder(
  order: Omit<DeliveryOrderRow, "status">
): Promise<DeliveryOrderRow> {
  await withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, order.user_id, null, order.created_at);
    await client.query(
      `UPDATE delivery_orders
       SET status = 'expired'
       WHERE user_id = $1 AND status IN ('offered', 'accepted')`,
      [order.user_id]
    );
    await client.query(
      `INSERT INTO delivery_orders (order_id, user_id, delivery_type, title, destination, base_reward, vehicle_bonus, status, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'offered', $8, $9)`,
      [
        order.order_id,
        order.user_id,
        order.delivery_type,
        order.title,
        order.destination,
        order.base_reward,
        order.vehicle_bonus,
        order.expires_at,
        order.created_at,
      ]
    );
  });

  return { ...order, status: "offered" };
}

export async function acceptDeliveryOrder(
  userId: number,
  orderId: string,
  now: number = Math.floor(Date.now() / 1000)
): Promise<
  | { status: "ok"; order: DeliveryOrderRow }
  | { status: "expired_or_invalid" }
> {
  return withCoreTransaction(async (client) => {
    const res = await client.query(
      `SELECT order_id, user_id, delivery_type, title, destination, base_reward, vehicle_bonus, status, expires_at, created_at
       FROM delivery_orders
       WHERE order_id = $1 AND user_id = $2
       FOR UPDATE`,
      [orderId, userId]
    );
    if (res.rows.length === 0) return { status: "expired_or_invalid" };

    const row = res.rows[0];
    if (Number(row.expires_at) <= now || !["offered", "accepted"].includes(row.status)) {
      return { status: "expired_or_invalid" };
    }

    if (row.status === "offered") {
      await client.query(
        "UPDATE delivery_orders SET status = 'accepted' WHERE order_id = $1",
        [orderId]
      );
    }

    return {
      status: "ok",
      order: {
        order_id: String(row.order_id),
        user_id: Number(row.user_id),
        delivery_type: String(row.delivery_type),
        title: String(row.title),
        destination: String(row.destination),
        base_reward: Number(row.base_reward),
        vehicle_bonus: Number(row.vehicle_bonus),
        status: "accepted",
        expires_at: Number(row.expires_at),
        created_at: Number(row.created_at),
      },
    };
  });
}

export async function skipDeliveryOrder(userId: number, orderId: string): Promise<void> {
  await getCoreDb().query(
    `UPDATE delivery_orders
     SET status = 'skipped'
     WHERE order_id = $1 AND user_id = $2 AND status IN ('offered', 'accepted')`,
    [orderId, userId]
  );
}

export async function completeDeliveryOrderTx(
  userId: number,
  orderId: string,
  idempotencyKey: string,
  now: number = Math.floor(Date.now() / 1000)
): Promise<
  | {
      status: "ok";
      title: string;
      destination: string;
      earned: number;
      vehicleBonus: number;
      newBalance: number;
    }
  | { status: "expired_or_invalid" }
  | { status: "already_completed" }
  | { status: "daily_cap_reached"; cap: number }
  | { status: "duplicate" }
> {
  return withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, userId, null, now);

    const orderRes = await client.query(
      `SELECT order_id, title, destination, base_reward, vehicle_bonus, status, expires_at
       FROM delivery_orders
       WHERE order_id = $1 AND user_id = $2
       FOR UPDATE`,
      [orderId, userId]
    );
    if (orderRes.rows.length === 0) return { status: "expired_or_invalid" };

    const order = orderRes.rows[0];
    if (order.status === "completed") return { status: "already_completed" };
    if (order.status !== "accepted" || Number(order.expires_at) <= now) {
      return { status: "expired_or_invalid" };
    }

    const totalReward = Number(order.base_reward) + Number(order.vehicle_bonus);
    const creditRes = await creditWalletInTx(client, {
      userId,
      amount: totalReward,
      txType: "delivery_reward",
      referenceId: orderId,
      idempotencyKey,
      enforceDailyActiveCap: true,
      now,
    });

    if (creditRes.status === "duplicate") return { status: "duplicate" };
    if (creditRes.status === "daily_cap_reached") {
      return { status: "daily_cap_reached", cap: creditRes.cap };
    }

    await client.query(
      "UPDATE delivery_orders SET status = 'completed', completed_at = $1 WHERE order_id = $2",
      [now, orderId]
    );
    await client.query(
      "UPDATE users SET last_delivery_at = $1, updated_at = $1 WHERE user_id = $2",
      [now, userId]
    );

    await incrementMissionMetricInTx(client, userId, "deliveries", 1, now);
    await incrementMissionMetricInTx(client, userId, "eligible_activities", 1, now);

    return {
      status: "ok",
      title: String(order.title),
      destination: String(order.destination),
      earned: creditRes.credited,
      vehicleBonus: Number(order.vehicle_bonus),
      newBalance: creditRes.newBalance,
    };
  });
}

// ==========================================
// 💻 FREELANCE TASKS
// ==========================================

export async function getFreelanceState(
  userId: number,
  now: number = Math.floor(Date.now() / 1000)
): Promise<{
  lastFreelanceAt: number;
  openTask: FreelanceTaskRow | null;
}> {
  const db = getCoreDb();
  const [userRes, taskRes] = await Promise.all([
    db.query("SELECT last_freelance_at FROM users WHERE user_id = $1", [userId]),
    db.query(
      `SELECT task_id, user_id, title, category, reward, status, expires_at, created_at
       FROM freelance_tasks
       WHERE user_id = $1 AND status = 'open' AND expires_at > $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, now]
    ),
  ]);

  const row = taskRes.rows[0];
  return {
    lastFreelanceAt: Number(userRes.rows[0]?.last_freelance_at ?? 0),
    openTask: row
      ? {
          task_id: String(row.task_id),
          user_id: Number(row.user_id),
          title: String(row.title),
          category: String(row.category),
          reward: Number(row.reward),
          status: row.status,
          expires_at: Number(row.expires_at),
          created_at: Number(row.created_at),
        }
      : null,
  };
}

export async function createFreelanceTask(
  task: Omit<FreelanceTaskRow, "status">
): Promise<FreelanceTaskRow> {
  await withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, task.user_id, null, task.created_at);
    await client.query(
      "UPDATE freelance_tasks SET status = 'expired' WHERE user_id = $1 AND status = 'open'",
      [task.user_id]
    );
    await client.query(
      `INSERT INTO freelance_tasks (task_id, user_id, title, category, reward, status, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, 'open', $6, $7)`,
      [
        task.task_id,
        task.user_id,
        task.title,
        task.category,
        task.reward,
        task.expires_at,
        task.created_at,
      ]
    );
  });

  return { ...task, status: "open" };
}

export async function completeFreelanceTaskTx(
  userId: number,
  taskId: string,
  idempotencyKey: string,
  now: number = Math.floor(Date.now() / 1000)
): Promise<
  | { status: "ok"; title: string; category: string; earned: number; newBalance: number }
  | { status: "expired_or_invalid" }
  | { status: "already_completed" }
  | { status: "cooldown"; remainingSec: number }
  | { status: "daily_cap_reached"; cap: number }
  | { status: "duplicate" }
> {
  return withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, userId, null, now);

    const userRes = await client.query(
      "SELECT last_freelance_at FROM users WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    const lastFreelanceAt = Number(userRes.rows[0]?.last_freelance_at ?? 0);
    const elapsed = now - lastFreelanceAt;
    if (lastFreelanceAt > 0 && elapsed < ECONOMY_LIMITS.FREELANCE_COOLDOWN_SEC) {
      return {
        status: "cooldown",
        remainingSec: ECONOMY_LIMITS.FREELANCE_COOLDOWN_SEC - elapsed,
      };
    }

    const taskRes = await client.query(
      `SELECT task_id, title, category, reward, status, expires_at
       FROM freelance_tasks
       WHERE task_id = $1 AND user_id = $2
       FOR UPDATE`,
      [taskId, userId]
    );
    if (taskRes.rows.length === 0) return { status: "expired_or_invalid" };

    const task = taskRes.rows[0];
    if (task.status === "completed") return { status: "already_completed" };
    if (task.status !== "open" || Number(task.expires_at) <= now) {
      return { status: "expired_or_invalid" };
    }

    const creditRes = await creditWalletInTx(client, {
      userId,
      amount: Number(task.reward),
      txType: "freelance_reward",
      referenceId: taskId,
      idempotencyKey,
      enforceDailyActiveCap: true,
      now,
    });

    if (creditRes.status === "duplicate") return { status: "duplicate" };
    if (creditRes.status === "daily_cap_reached") {
      return { status: "daily_cap_reached", cap: creditRes.cap };
    }

    await client.query(
      "UPDATE freelance_tasks SET status = 'completed', completed_at = $1 WHERE task_id = $2",
      [now, taskId]
    );
    await client.query(
      "UPDATE users SET last_freelance_at = $1, updated_at = $1 WHERE user_id = $2",
      [now, userId]
    );

    await incrementMissionMetricInTx(client, userId, "freelance_tasks", 1, now);
    await incrementMissionMetricInTx(client, userId, "eligible_activities", 1, now);

    return {
      status: "ok",
      title: String(task.title),
      category: String(task.category),
      earned: creditRes.credited,
      newBalance: creditRes.newBalance,
    };
  });
}

// ==========================================
// 🎯 DAILY MISSIONS & WEEKLY CHALLENGES
// ==========================================

export async function getUserMissionsBoard(
  userId: number,
  period: "daily" | "weekly",
  now: number = Math.floor(Date.now() / 1000)
): Promise<MissionProgressItem[]> {
  const periodKey = period === "daily" ? getIstDateKey(now) : getIstWeekKey(now);
  const catalog = period === "daily" ? DAILY_MISSIONS : WEEKLY_CHALLENGES;

  return withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, userId, null, now);
    await ensurePeriodMissionsInTx(client, userId, period, periodKey, now);

    if (period === "weekly") {
      const bizRes = await client.query(
        "SELECT COUNT(*)::int AS cnt FROM user_businesses WHERE user_id = $1",
        [userId]
      );
      const bizCount = Number(bizRes.rows[0]?.cnt ?? 0);
      if (bizCount > 0) {
        await client.query(
          `UPDATE mission_progress
           SET progress = LEAST(target, GREATEST(progress, $1)),
               updated_at = $2
           WHERE user_id = $3
             AND period_type = 'weekly'
             AND period_key = $4
             AND mission_id = 'weekly_business_1'
             AND claimed = 0`,
          [bizCount, now, userId, periodKey]
        );
      }
    }

    const rowsRes = await client.query(
      `SELECT mission_id, progress, target, reward, claimed
       FROM mission_progress
       WHERE user_id = $1 AND period_type = $2 AND period_key = $3`,
      [userId, period, periodKey]
    );

    const map = new Map<string, any>(rowsRes.rows.map((r) => [String(r.mission_id), r]));

    return catalog.map((def) => {
      const row = map.get(def.id);
      return {
        mission_id: def.id,
        period,
        title: def.title,
        progress: Number(row?.progress ?? 0),
        target: Number(row?.target ?? def.target),
        reward: Number(row?.reward ?? def.reward),
        claimed: Number(row?.claimed ?? 0) === 1,
      };
    });
  });
}

export async function claimMissionRewardTx(
  userId: number,
  period: "daily" | "weekly",
  missionId: string,
  idempotencyKey: string,
  now: number = Math.floor(Date.now() / 1000)
): Promise<
  | { status: "ok"; title: string; reward: number; newBalance: number }
  | { status: "not_completed"; progress: number; target: number }
  | { status: "already_claimed" }
  | { status: "not_found" }
  | { status: "duplicate" }
> {
  const catalog = period === "daily" ? DAILY_MISSIONS : WEEKLY_CHALLENGES;
  const def = catalog.find((m) => m.id === missionId);
  if (!def) return { status: "not_found" };

  const periodKey = period === "daily" ? getIstDateKey(now) : getIstWeekKey(now);

  return withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, userId, null, now);
    await ensurePeriodMissionsInTx(client, userId, period, periodKey, now);

    const rowRes = await client.query(
      `SELECT progress, target, reward, claimed
       FROM mission_progress
       WHERE user_id = $1 AND period_type = $2 AND period_key = $3 AND mission_id = $4
       FOR UPDATE`,
      [userId, period, periodKey, missionId]
    );

    if (rowRes.rows.length === 0) return { status: "not_found" };

    const row = rowRes.rows[0];
    if (Number(row.claimed) === 1) return { status: "already_claimed" };
    if (Number(row.progress) < Number(row.target)) {
      return {
        status: "not_completed",
        progress: Number(row.progress),
        target: Number(row.target),
      };
    }

    const reward = Number(row.reward);
    const creditRes = await creditWalletInTx(client, {
      userId,
      amount: reward,
      txType: period === "daily" ? "daily_mission_reward" : "weekly_challenge_reward",
      referenceId: `${periodKey}:${missionId}`,
      idempotencyKey,
      enforceDailyActiveCap: false,
      now,
    });

    if (creditRes.status === "duplicate") return { status: "duplicate" };
    if (creditRes.status !== "ok") return { status: "already_claimed" };

    await client.query(
      `UPDATE mission_progress
       SET claimed = 1, updated_at = $1
       WHERE user_id = $2 AND period_type = $3 AND period_key = $4 AND mission_id = $5`,
      [now, userId, period, periodKey, missionId]
    );

    if (period === "daily") {
      await incrementMissionMetricInTx(client, userId, "daily_missions_completed", 1, now);
    }

    return {
      status: "ok",
      title: def.title,
      reward: creditRes.credited,
      newBalance: creditRes.newBalance,
    };
  });
}

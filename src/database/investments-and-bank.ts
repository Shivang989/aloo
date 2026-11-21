import { getCoreDb, withCoreTransaction } from "./index";
import { creditWalletInTx, debitWalletInTx, ensureUserRowInTx } from "./economy";
import {
  BUSINESS_CATALOG,
  BusinessCatalogItem,
  ECONOMY_LIMITS,
  getWealthRank,
  PROPERTY_CATALOG,
  PropertyCatalogItem,
  WealthRankTier,
} from "../settings/economy-config";
import { getShopItemById } from "../features/money/market-pricing";
import { MARKET_ITEMS } from "../settings/market-items";

// ==========================================
// 🧮 PURE ACCRUAL & VALUATION HELPERS
// ==========================================

export function getLevelMultiplier(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return 1 + (safeLevel - 1) * ECONOMY_LIMITS.UPGRADE_MULTIPLIER_PER_LEVEL;
}

export function calculateBusinessAccrual(
  item: BusinessCatalogItem,
  level: number,
  lastCollectedAt: number,
  now: number
): {
  cappedElapsedSec: number;
  dailyGross: number;
  dailyExpenses: number;
  dailyNet: number;
  accruedGross: number;
  accruedExpenses: number;
  accruedNet: number;
} {
  const mult = getLevelMultiplier(level);
  const dailyGross = Math.floor(item.dailyGrossIncome * mult);
  const dailyExpenses = Math.floor(dailyGross * ECONOMY_LIMITS.BUSINESS_EXPENSE_RATE);
  const dailyNet = dailyGross - dailyExpenses;

  const rawElapsed = Math.max(0, now - lastCollectedAt);
  const cappedElapsedSec = Math.min(rawElapsed, ECONOMY_LIMITS.PASSIVE_ACCRUAL_CAP_SEC);

  const accruedGross = Math.floor((dailyGross * cappedElapsedSec) / 86400);
  const accruedExpenses = Math.floor(accruedGross * ECONOMY_LIMITS.BUSINESS_EXPENSE_RATE);
  const accruedNet = accruedGross - accruedExpenses;

  return {
    cappedElapsedSec,
    dailyGross,
    dailyExpenses,
    dailyNet,
    accruedGross,
    accruedExpenses,
    accruedNet,
  };
}

export function calculatePropertyAccrual(
  item: PropertyCatalogItem,
  level: number,
  lastCollectedAt: number,
  now: number
): {
  cappedElapsedSec: number;
  dailyRent: number;
  accruedRent: number;
} {
  const mult = getLevelMultiplier(level);
  const dailyRent = Math.floor(item.dailyBaseRent * mult);

  const rawElapsed = Math.max(0, now - lastCollectedAt);
  const cappedElapsedSec = Math.min(rawElapsed, ECONOMY_LIMITS.PASSIVE_ACCRUAL_CAP_SEC);
  const accruedRent = Math.floor((dailyRent * cappedElapsedSec) / 86400);

  return {
    cappedElapsedSec,
    dailyRent,
    accruedRent,
  };
}

export function calculateBankAccruedInterest(
  savingsBalance: number,
  lastInterestAt: number,
  now: number
): {
  eligiblePrincipal: number;
  elapsedSec: number;
  accruedInterest: number;
} {
  const eligiblePrincipal = Math.min(
    Math.max(0, Math.floor(savingsBalance)),
    ECONOMY_LIMITS.BANK_MAX_INTEREST_PRINCIPAL
  );
  const elapsedSec = Math.max(0, now - lastInterestAt);
  // 0.03% = 3 basis points (3 / 10,000) computed with exact integer arithmetic
  const interestBps = Math.round(ECONOMY_LIMITS.BANK_DAILY_INTEREST_RATE * 10_000);
  const accruedInterest = Math.floor(
    (eligiblePrincipal * interestBps * elapsedSec) / (10_000 * 86400)
  );

  return {
    eligiblePrincipal,
    elapsedSec,
    accruedInterest,
  };
}

export function calculateUpgradeCost(basePrice: number, currentLevel: number): number {
  return Math.floor(basePrice * ECONOMY_LIMITS.UPGRADE_COST_FACTOR * Math.max(1, currentLevel));
}

export function calculateAssetValuation(basePrice: number, level: number): number {
  let total = basePrice;
  for (let lv = 1; lv < level; lv++) {
    total += calculateUpgradeCost(basePrice, lv);
  }
  return total;
}

export function getAllowedBusinessSlots(netWorth: number): number {
  if (netWorth >= 10_000_000) return ECONOMY_LIMITS.MAX_OWNED_BUSINESSES; // 3 at ₹1 Cr+
  if (netWorth >= 1_000_000) return 2; // 2 at ₹10 Lakh+
  return 1; // 1 starter slot
}

// ==========================================
// 🏢 BUSINESS REPOSITORY
// ==========================================

export interface OwnedBusinessRecord {
  id: number;
  user_id: number;
  business_type: string;
  level: number;
  last_collected_at: number;
  total_earned: number;
  created_at: number;
  catalog: BusinessCatalogItem;
}

export async function getUserBusinesses(userId: number): Promise<OwnedBusinessRecord[]> {
  const res = await getCoreDb().query(
    `SELECT id, user_id, business_type, level, last_collected_at, total_earned, created_at
     FROM user_businesses
     WHERE user_id = $1
     ORDER BY id ASC`,
    [userId]
  );

  const list: OwnedBusinessRecord[] = [];
  for (const r of res.rows) {
    const catalog = BUSINESS_CATALOG.find((b) => b.id === String(r.business_type));
    if (!catalog) continue;
    list.push({
      id: Number(r.id),
      user_id: Number(r.user_id),
      business_type: String(r.business_type),
      level: Number(r.level),
      last_collected_at: Number(r.last_collected_at),
      total_earned: Number(r.total_earned),
      created_at: Number(r.created_at),
      catalog,
    });
  }
  return list;
}

export async function purchaseBusinessTx(
  userId: number,
  businessType: string,
  idempotencyKey: string,
  now: number = Math.floor(Date.now() / 1000)
): Promise<
  | { status: "ok"; businessId: number; name: string; paid: number; newBalance: number }
  | { status: "not_found" }
  | { status: "slot_limit_reached"; current: number; maxAllowed: number }
  | { status: "already_owned_type" }
  | { status: "insufficient_balance"; balance: number; required: number }
  | { status: "duplicate" }
> {
  const item = BUSINESS_CATALOG.find((b) => b.id === businessType);
  if (!item) return { status: "not_found" };

  const nw = await getPlayerNetWorth(userId);
  const maxAllowed = getAllowedBusinessSlots(nw.netWorth);

  return withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, userId, null, now);

    const ownedRes = await client.query(
      "SELECT id, business_type FROM user_businesses WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    if (ownedRes.rows.length >= maxAllowed) {
      return {
        status: "slot_limit_reached",
        current: ownedRes.rows.length,
        maxAllowed,
      };
    }
    if (ownedRes.rows.some((r) => String(r.business_type) === businessType)) {
      return { status: "already_owned_type" };
    }

    const debitRes = await debitWalletInTx(client, {
      userId,
      amount: item.purchasePrice,
      txType: "business_purchase",
      referenceId: `${businessType}:${idempotencyKey}`,
      idempotencyKey,
      now,
    });

    if (debitRes.status === "duplicate") return { status: "duplicate" };
    if (debitRes.status === "insufficient_balance") {
      return {
        status: "insufficient_balance",
        balance: debitRes.balance,
        required: item.purchasePrice,
      };
    }

    const insRes = await client.query(
      `INSERT INTO user_businesses (user_id, business_type, level, last_collected_at, total_earned, created_at)
       VALUES ($1, $2, 1, $3, 0, $3)
       RETURNING id`,
      [userId, businessType, now]
    );

    return {
      status: "ok",
      businessId: Number(insRes.rows[0].id),
      name: item.name,
      paid: item.purchasePrice,
      newBalance: debitRes.newBalance,
    };
  });
}

export async function collectBusinessProfitTx(
  userId: number,
  businessId: number,
  idempotencyKey: string,
  now: number = Math.floor(Date.now() / 1000)
): Promise<
  | {
      status: "ok";
      name: string;
      gross: number;
      expenses: number;
      netProfit: number;
      newBalance: number;
    }
  | { status: "not_found" }
  | { status: "nothing_to_collect" }
  | { status: "duplicate" }
> {
  return withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, userId, null, now);

    const bizRes = await client.query(
      `SELECT id, business_type, level, last_collected_at
       FROM user_businesses
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [businessId, userId]
    );
    if (bizRes.rows.length === 0) return { status: "not_found" };

    const row = bizRes.rows[0];
    const catalog = BUSINESS_CATALOG.find((b) => b.id === String(row.business_type));
    if (!catalog) return { status: "not_found" };

    const accrual = calculateBusinessAccrual(
      catalog,
      Number(row.level),
      Number(row.last_collected_at),
      now
    );

    if (accrual.accruedNet <= 0) {
      return { status: "nothing_to_collect" };
    }

    const creditRes = await creditWalletInTx(client, {
      userId,
      amount: accrual.accruedNet,
      txType: "business_profit",
      referenceId: `${catalog.id}:${businessId}:${idempotencyKey}`,
      idempotencyKey,
      enforceDailyActiveCap: false,
      now,
    });

    if (creditRes.status === "duplicate") return { status: "duplicate" };
    if (creditRes.status !== "ok") return { status: "nothing_to_collect" };

    await client.query(
      `UPDATE user_businesses
       SET last_collected_at = $1,
           total_earned = total_earned + $2
       WHERE id = $3`,
      [now, accrual.accruedNet, businessId]
    );

    return {
      status: "ok",
      name: catalog.name,
      gross: accrual.accruedGross,
      expenses: accrual.accruedExpenses,
      netProfit: accrual.accruedNet,
      newBalance: creditRes.newBalance,
    };
  });
}

export async function upgradeBusinessTx(
  userId: number,
  businessId: number,
  idempotencyKey: string,
  now: number = Math.floor(Date.now() / 1000)
): Promise<
  | {
      status: "ok";
      name: string;
      newLevel: number;
      upgradeCost: number;
      settledPriorNet: number;
      newBalance: number;
    }
  | { status: "not_found" }
  | { status: "max_level" }
  | { status: "insufficient_balance"; balance: number; required: number }
  | { status: "duplicate" }
> {
  return withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, userId, null, now);

    const bizRes = await client.query(
      `SELECT id, business_type, level, last_collected_at
       FROM user_businesses
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [businessId, userId]
    );
    if (bizRes.rows.length === 0) return { status: "not_found" };

    const row = bizRes.rows[0];
    const currentLevel = Number(row.level);
    const catalog = BUSINESS_CATALOG.find((b) => b.id === String(row.business_type));
    if (!catalog) return { status: "not_found" };

    if (currentLevel >= catalog.maxLevel) {
      return { status: "max_level" };
    }

    const upgradeCost = calculateUpgradeCost(catalog.purchasePrice, currentLevel);

    // Deduct upgrade cost first before applying upgrade
    const debitRes = await debitWalletInTx(client, {
      userId,
      amount: upgradeCost,
      txType: "business_upgrade",
      referenceId: `${catalog.id}:lv${currentLevel + 1}:${idempotencyKey}`,
      idempotencyKey,
      now,
    });

    if (debitRes.status === "duplicate") return { status: "duplicate" };
    if (debitRes.status === "insufficient_balance") {
      return {
        status: "insufficient_balance",
        balance: debitRes.balance,
        required: upgradeCost,
      };
    }

    // Settle any already-generated earnings strictly at the OLD level so upgrades never apply retroactively
    const priorAccrual = calculateBusinessAccrual(
      catalog,
      currentLevel,
      Number(row.last_collected_at),
      now
    );

    let finalBalance = debitRes.newBalance;
    if (priorAccrual.accruedNet > 0) {
      const settleRes = await creditWalletInTx(client, {
        userId,
        amount: priorAccrual.accruedNet,
        txType: "business_profit",
        referenceId: `${catalog.id}:${businessId}:pre_upgrade:${idempotencyKey}`,
        enforceDailyActiveCap: false,
        now,
      });
      if (settleRes.status === "ok") {
        finalBalance = settleRes.newBalance;
      }
    }

    const nextLevel = currentLevel + 1;
    await client.query(
      `UPDATE user_businesses
       SET level = $1,
           last_collected_at = $2,
           total_earned = total_earned + $3
       WHERE id = $4`,
      [nextLevel, now, priorAccrual.accruedNet, businessId]
    );

    return {
      status: "ok",
      name: catalog.name,
      newLevel: nextLevel,
      upgradeCost,
      settledPriorNet: priorAccrual.accruedNet,
      newBalance: finalBalance,
    };
  });
}

// ==========================================
// 🏠 PROPERTY & RENT REPOSITORY
// ==========================================

export interface OwnedPropertyRecord {
  id: number;
  user_id: number;
  property_type: string;
  level: number;
  last_rent_collected_at: number;
  total_rent_earned: number;
  created_at: number;
  catalog: PropertyCatalogItem;
}

export async function getUserProperties(userId: number): Promise<OwnedPropertyRecord[]> {
  const res = await getCoreDb().query(
    `SELECT id, user_id, property_type, level, last_rent_collected_at, total_rent_earned, created_at
     FROM user_properties
     WHERE user_id = $1
     ORDER BY id ASC`,
    [userId]
  );

  const list: OwnedPropertyRecord[] = [];
  for (const r of res.rows) {
    const catalog = PROPERTY_CATALOG.find((p) => p.id === String(r.property_type));
    if (!catalog) continue;
    list.push({
      id: Number(r.id),
      user_id: Number(r.user_id),
      property_type: String(r.property_type),
      level: Number(r.level),
      last_rent_collected_at: Number(r.last_rent_collected_at),
      total_rent_earned: Number(r.total_rent_earned),
      created_at: Number(r.created_at),
      catalog,
    });
  }
  return list;
}

export async function purchasePropertyTx(
  userId: number,
  propertyType: string,
  idempotencyKey: string,
  now: number = Math.floor(Date.now() / 1000)
): Promise<
  | { status: "ok"; propertyId: number; name: string; paid: number; newBalance: number }
  | { status: "not_found" }
  | { status: "limit_reached"; max: number }
  | { status: "already_owned_type" }
  | { status: "insufficient_balance"; balance: number; required: number }
  | { status: "duplicate" }
> {
  const item = PROPERTY_CATALOG.find((p) => p.id === propertyType);
  if (!item) return { status: "not_found" };

  return withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, userId, null, now);

    const ownedRes = await client.query(
      "SELECT id, property_type FROM user_properties WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    if (ownedRes.rows.length >= ECONOMY_LIMITS.MAX_OWNED_PROPERTIES) {
      return { status: "limit_reached", max: ECONOMY_LIMITS.MAX_OWNED_PROPERTIES };
    }
    if (ownedRes.rows.some((r) => String(r.property_type) === propertyType)) {
      return { status: "already_owned_type" };
    }

    const debitRes = await debitWalletInTx(client, {
      userId,
      amount: item.purchasePrice,
      txType: "property_purchase",
      referenceId: `${propertyType}:${idempotencyKey}`,
      idempotencyKey,
      now,
    });

    if (debitRes.status === "duplicate") return { status: "duplicate" };
    if (debitRes.status === "insufficient_balance") {
      return {
        status: "insufficient_balance",
        balance: debitRes.balance,
        required: item.purchasePrice,
      };
    }

    const insRes = await client.query(
      `INSERT INTO user_properties (user_id, property_type, level, last_rent_collected_at, total_rent_earned, created_at)
       VALUES ($1, $2, 1, $3, 0, $3)
       RETURNING id`,
      [userId, propertyType, now]
    );

    return {
      status: "ok",
      propertyId: Number(insRes.rows[0].id),
      name: item.name,
      paid: item.purchasePrice,
      newBalance: debitRes.newBalance,
    };
  });
}

export async function collectAllPropertyRentTx(
  userId: number,
  idempotencyKey: string,
  now: number = Math.floor(Date.now() / 1000)
): Promise<
  | { status: "ok"; totalRent: number; propertyCount: number; newBalance: number }
  | { status: "no_properties" }
  | { status: "nothing_to_collect" }
  | { status: "duplicate" }
> {
  return withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, userId, null, now);

    const propsRes = await client.query(
      `SELECT id, property_type, level, last_rent_collected_at
       FROM user_properties
       WHERE user_id = $1
       ORDER BY id ASC
       FOR UPDATE`,
      [userId]
    );

    if (propsRes.rows.length === 0) return { status: "no_properties" };

    let totalRent = 0;
    const updates: Array<{ id: number; rent: number }> = [];

    for (const row of propsRes.rows) {
      const catalog = PROPERTY_CATALOG.find((p) => p.id === String(row.property_type));
      if (!catalog) continue;
      const accrual = calculatePropertyAccrual(
        catalog,
        Number(row.level),
        Number(row.last_rent_collected_at),
        now
      );
      if (accrual.accruedRent > 0) {
        totalRent += accrual.accruedRent;
        updates.push({ id: Number(row.id), rent: accrual.accruedRent });
      }
    }

    if (totalRent <= 0) return { status: "nothing_to_collect" };

    const creditRes = await creditWalletInTx(client, {
      userId,
      amount: totalRent,
      txType: "property_rent",
      referenceId: `${updates.length}_properties:${idempotencyKey}`,
      idempotencyKey,
      enforceDailyActiveCap: false,
      now,
    });

    if (creditRes.status === "duplicate") return { status: "duplicate" };
    if (creditRes.status !== "ok") return { status: "nothing_to_collect" };

    for (const u of updates) {
      await client.query(
        `UPDATE user_properties
         SET last_rent_collected_at = $1,
             total_rent_earned = total_rent_earned + $2
         WHERE id = $3`,
        [now, u.rent, u.id]
      );
    }

    return {
      status: "ok",
      totalRent: creditRes.credited,
      propertyCount: updates.length,
      newBalance: creditRes.newBalance,
    };
  });
}

export async function upgradePropertyTx(
  userId: number,
  propertyId: number,
  idempotencyKey: string,
  now: number = Math.floor(Date.now() / 1000)
): Promise<
  | {
      status: "ok";
      name: string;
      newLevel: number;
      upgradeCost: number;
      settledPriorRent: number;
      newBalance: number;
    }
  | { status: "not_found" }
  | { status: "max_level" }
  | { status: "insufficient_balance"; balance: number; required: number }
  | { status: "duplicate" }
> {
  return withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, userId, null, now);

    const propRes = await client.query(
      `SELECT id, property_type, level, last_rent_collected_at
       FROM user_properties
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [propertyId, userId]
    );
    if (propRes.rows.length === 0) return { status: "not_found" };

    const row = propRes.rows[0];
    const currentLevel = Number(row.level);
    const catalog = PROPERTY_CATALOG.find((p) => p.id === String(row.property_type));
    if (!catalog) return { status: "not_found" };

    if (currentLevel >= catalog.maxLevel) return { status: "max_level" };

    const upgradeCost = calculateUpgradeCost(catalog.purchasePrice, currentLevel);
    const debitRes = await debitWalletInTx(client, {
      userId,
      amount: upgradeCost,
      txType: "property_upgrade",
      referenceId: `${catalog.id}:lv${currentLevel + 1}:${idempotencyKey}`,
      idempotencyKey,
      now,
    });

    if (debitRes.status === "duplicate") return { status: "duplicate" };
    if (debitRes.status === "insufficient_balance") {
      return {
        status: "insufficient_balance",
        balance: debitRes.balance,
        required: upgradeCost,
      };
    }

    const priorAccrual = calculatePropertyAccrual(
      catalog,
      currentLevel,
      Number(row.last_rent_collected_at),
      now
    );

    let finalBalance = debitRes.newBalance;
    if (priorAccrual.accruedRent > 0) {
      const settleRes = await creditWalletInTx(client, {
        userId,
        amount: priorAccrual.accruedRent,
        txType: "property_rent",
        referenceId: `${catalog.id}:${propertyId}:pre_upgrade:${idempotencyKey}`,
        enforceDailyActiveCap: false,
        now,
      });
      if (settleRes.status === "ok") {
        finalBalance = settleRes.newBalance;
      }
    }

    const nextLevel = currentLevel + 1;
    await client.query(
      `UPDATE user_properties
       SET level = $1,
           last_rent_collected_at = $2,
           total_rent_earned = total_rent_earned + $3
       WHERE id = $4`,
      [nextLevel, now, priorAccrual.accruedRent, propertyId]
    );

    return {
      status: "ok",
      name: catalog.name,
      newLevel: nextLevel,
      upgradeCost,
      settledPriorRent: priorAccrual.accruedRent,
      newBalance: finalBalance,
    };
  });
}

// ==========================================
// 🏦 VIRTUAL BANK REPOSITORY
// ==========================================

export interface BankAccountState {
  walletBalance: number;
  savingsBalance: number;
  lastInterestAt: number;
  totalInterestEarned: number;
  availableInterest: number;
  eligiblePrincipal: number;
}

export async function getBankAccountState(
  userId: number,
  now: number = Math.floor(Date.now() / 1000)
): Promise<BankAccountState> {
  return withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, userId, null, now);
    await client.query(
      `INSERT INTO bank_accounts (user_id, balance, last_interest_at, total_interest_earned, updated_at)
       VALUES ($1, 0, $2, 0, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, now]
    );

    const [userRes, bankRes] = await Promise.all([
      client.query("SELECT balance FROM users WHERE user_id = $1", [userId]),
      client.query(
        "SELECT balance, last_interest_at, total_interest_earned FROM bank_accounts WHERE user_id = $1",
        [userId]
      ),
    ]);

    const walletBalance = Number(userRes.rows[0]?.balance ?? 0);
    const savingsBalance = Number(bankRes.rows[0]?.balance ?? 0);
    const lastInterestAt = Number(bankRes.rows[0]?.last_interest_at ?? now);
    const totalInterestEarned = Number(bankRes.rows[0]?.total_interest_earned ?? 0);

    const calc = calculateBankAccruedInterest(savingsBalance, lastInterestAt, now);

    return {
      walletBalance,
      savingsBalance,
      lastInterestAt,
      totalInterestEarned,
      availableInterest: calc.accruedInterest,
      eligiblePrincipal: calc.eligiblePrincipal,
    };
  });
}

export async function bankDepositTx(
  userId: number,
  amount: number,
  idempotencyKey?: string,
  now: number = Math.floor(Date.now() / 1000)
): Promise<
  | { status: "ok"; deposited: number; walletBalance: number; savingsBalance: number }
  | { status: "insufficient_balance"; walletBalance: number }
  | { status: "invalid_amount" }
  | { status: "duplicate" }
> {
  const depositAmt = Math.floor(amount);
  if (!Number.isSafeInteger(depositAmt) || depositAmt <= 0) {
    return { status: "invalid_amount" };
  }

  return withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, userId, null, now);
    await client.query(
      `INSERT INTO bank_accounts (user_id, balance, last_interest_at, total_interest_earned, updated_at)
       VALUES ($1, 0, $2, 0, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, now]
    );

    const bankLock = await client.query(
      "SELECT balance, last_interest_at FROM bank_accounts WHERE user_id = $1 FOR UPDATE",
      [userId]
    );

    const debitRes = await debitWalletInTx(client, {
      userId,
      amount: depositAmt,
      txType: "bank_deposit",
      idempotencyKey,
      now,
    });

    if (debitRes.status === "duplicate") return { status: "duplicate" };
    if (debitRes.status === "insufficient_balance") {
      return { status: "insufficient_balance", walletBalance: debitRes.balance };
    }

    const oldSavings = Number(bankLock.rows[0]?.balance ?? 0);
    // Reset interest clock if savings was 0 so interest starts accruing from deposit time
    const nextInterestClock =
      oldSavings === 0 ? now : Number(bankLock.rows[0]?.last_interest_at ?? now);

    const bankUpd = await client.query(
      `UPDATE bank_accounts
       SET balance = balance + $1,
           last_interest_at = $2,
           updated_at = $3
       WHERE user_id = $4
       RETURNING balance`,
      [depositAmt, nextInterestClock, now, userId]
    );

    return {
      status: "ok",
      deposited: depositAmt,
      walletBalance: debitRes.newBalance,
      savingsBalance: Number(bankUpd.rows[0].balance),
    };
  });
}

export async function bankWithdrawTx(
  userId: number,
  amount: number,
  idempotencyKey?: string,
  now: number = Math.floor(Date.now() / 1000)
): Promise<
  | { status: "ok"; withdrawn: number; walletBalance: number; savingsBalance: number }
  | { status: "insufficient_savings"; savingsBalance: number }
  | { status: "invalid_amount" }
  | { status: "duplicate" }
> {
  const withdrawAmt = Math.floor(amount);
  if (!Number.isSafeInteger(withdrawAmt) || withdrawAmt <= 0) {
    return { status: "invalid_amount" };
  }

  return withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, userId, null, now);
    await client.query(
      `INSERT INTO bank_accounts (user_id, balance, last_interest_at, total_interest_earned, updated_at)
       VALUES ($1, 0, $2, 0, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, now]
    );

    const bankLock = await client.query(
      "SELECT balance FROM bank_accounts WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    const currentSavings = Number(bankLock.rows[0]?.balance ?? 0);

    if (currentSavings < withdrawAmt) {
      return { status: "insufficient_savings", savingsBalance: currentSavings };
    }

    const creditRes = await creditWalletInTx(client, {
      userId,
      amount: withdrawAmt,
      txType: "bank_withdraw",
      idempotencyKey,
      enforceDailyActiveCap: false,
      now,
    });

    if (creditRes.status === "duplicate") return { status: "duplicate" };
    if (creditRes.status !== "ok") {
      return { status: "insufficient_savings", savingsBalance: currentSavings };
    }

    const bankUpd = await client.query(
      `UPDATE bank_accounts
       SET balance = balance - $1,
           updated_at = $2
       WHERE user_id = $3
       RETURNING balance`,
      [withdrawAmt, now, userId]
    );

    return {
      status: "ok",
      withdrawn: withdrawAmt,
      walletBalance: creditRes.newBalance,
      savingsBalance: Number(bankUpd.rows[0].balance),
    };
  });
}

export async function claimBankInterestTx(
  userId: number,
  idempotencyKey: string,
  now: number = Math.floor(Date.now() / 1000)
): Promise<
  | { status: "ok"; interestEarned: number; savingsBalance: number; walletBalance: number }
  | { status: "no_interest_yet" }
  | { status: "duplicate" }
> {
  return withCoreTransaction(async (client) => {
    await ensureUserRowInTx(client, userId, null, now);
    await client.query(
      `INSERT INTO bank_accounts (user_id, balance, last_interest_at, total_interest_earned, updated_at)
       VALUES ($1, 0, $2, 0, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, now]
    );

    const bankLock = await client.query(
      "SELECT balance, last_interest_at FROM bank_accounts WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    const savingsBalance = Number(bankLock.rows[0]?.balance ?? 0);
    const lastInterestAt = Number(bankLock.rows[0]?.last_interest_at ?? now);

    const calc = calculateBankAccruedInterest(savingsBalance, lastInterestAt, now);
    if (calc.accruedInterest <= 0) {
      return { status: "no_interest_yet" };
    }

    const creditRes = await creditWalletInTx(client, {
      userId,
      amount: calc.accruedInterest,
      txType: "bank_interest",
      referenceId: `principal_${calc.eligiblePrincipal}:${idempotencyKey}`,
      idempotencyKey,
      enforceDailyActiveCap: false,
      now,
    });

    if (creditRes.status === "duplicate") return { status: "duplicate" };
    if (creditRes.status !== "ok") return { status: "no_interest_yet" };

    await client.query(
      `UPDATE bank_accounts
       SET last_interest_at = $1,
           total_interest_earned = total_interest_earned + $2,
           updated_at = $1
       WHERE user_id = $3`,
      [now, calc.accruedInterest, userId]
    );

    return {
      status: "ok",
      interestEarned: calc.accruedInterest,
      savingsBalance,
      walletBalance: creditRes.newBalance,
    };
  });
}

export async function getBankTransactionHistory(
  userId: number,
  limit: number = 8
): Promise<Array<{ tx_type: string; amount: number; created_at: number }>> {
  const res = await getCoreDb().query(
    `SELECT tx_type, amount, created_at
     FROM economy_transactions
     WHERE user_id = $1 AND tx_type IN ('bank_deposit', 'bank_withdraw', 'bank_interest')
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [userId, limit]
  );
  return res.rows.map((r) => ({
    tx_type: String(r.tx_type),
    amount: Number(r.amount),
    created_at: Number(r.created_at),
  }));
}

// ==========================================
// 📊 NET WORTH & WEALTH RANKING
// ==========================================

export interface PlayerNetWorthBreakdown {
  wallet: number;
  bankSavings: number;
  businessValue: number;
  propertyValue: number;
  inventoryValue: number;
  netWorth: number;
  dailyBusinessNet: number;
  dailyRentalIncome: number;
  rank: WealthRankTier;
}

export async function getPlayerNetWorth(
  userId: number,
  now: number = Math.floor(Date.now() / 1000)
): Promise<PlayerNetWorthBreakdown> {
  const db = getCoreDb();
  const [userRes, bankRes, businesses, properties, invRes] = await Promise.all([
    db.query("SELECT balance FROM users WHERE user_id = $1", [userId]),
    db.query("SELECT balance FROM bank_accounts WHERE user_id = $1", [userId]),
    getUserBusinesses(userId),
    getUserProperties(userId),
    db.query("SELECT item_name, quantity FROM inventory WHERE user_id = $1 AND quantity > 0", [
      userId,
    ]),
  ]);

  const wallet = Number(userRes.rows[0]?.balance ?? 0);
  const bankSavings = Number(bankRes.rows[0]?.balance ?? 0);

  let businessValue = 0;
  let dailyBusinessNet = 0;
  for (const b of businesses) {
    businessValue += calculateAssetValuation(b.catalog.purchasePrice, b.level);
    const accrual = calculateBusinessAccrual(b.catalog, b.level, b.last_collected_at, now);
    dailyBusinessNet += accrual.dailyNet;
  }

  let propertyValue = 0;
  let dailyRentalIncome = 0;
  for (const p of properties) {
    propertyValue += calculateAssetValuation(p.catalog.purchasePrice, p.level);
    const accrual = calculatePropertyAccrual(p.catalog, p.level, p.last_rent_collected_at, now);
    dailyRentalIncome += accrual.dailyRent;
  }

  let inventoryValue = 0;
  for (const row of invRes.rows) {
    const qty = Number(row.quantity ?? 0);
    if (qty <= 0) continue;
    const key = String(row.item_name);
    const shopItem = getShopItemById(key);
    if (shopItem) {
      inventoryValue += shopItem.price_amount * qty;
      continue;
    }
    const legacyItem = MARKET_ITEMS[key.toLowerCase()];
    if (legacyItem) {
      inventoryValue += legacyItem.base_price * qty;
    }
  }

  const netWorth = wallet + bankSavings + businessValue + propertyValue + inventoryValue;

  return {
    wallet,
    bankSavings,
    businessValue,
    propertyValue,
    inventoryValue,
    netWorth,
    dailyBusinessNet,
    dailyRentalIncome,
    rank: getWealthRank(netWorth),
  };
}

export async function getTopWealthLeaderboard(
  limit: number = 10
): Promise<Array<{ user_id: number; first_name: string | null; net_worth: number }>> {
  const db = getCoreDb();
  const candidatesRes = await db.query(
    `SELECT u.user_id, u.first_name, (u.balance + COALESCE(b.balance, 0)) AS liquid
     FROM users u
     LEFT JOIN bank_accounts b ON b.user_id = u.user_id
     ORDER BY liquid DESC
     LIMIT 30`
  );

  const scored: Array<{ user_id: number; first_name: string | null; net_worth: number }> = [];
  for (const row of candidatesRes.rows) {
    const uid = Number(row.user_id);
    const nw = await getPlayerNetWorth(uid);
    scored.push({
      user_id: uid,
      first_name: row.first_name ? String(row.first_name) : null,
      net_worth: nw.netWorth,
    });
  }

  scored.sort((a, b) => b.net_worth - a.net_worth);
  return scored.slice(0, limit);
}

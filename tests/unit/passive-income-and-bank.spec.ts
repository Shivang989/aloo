import { describe, it, expect, vi, beforeEach } from "vitest";
import { BUSINESS_CATALOG, PROPERTY_CATALOG } from "../../src/settings/economy-config";
import {
  calculateBusinessAccrual,
  calculatePropertyAccrual,
  calculateBankAccruedInterest,
  getAllowedBusinessSlots,
} from "../../src/database/investments-and-bank";
import { handleBusinessCallback } from "../../src/features/money/business";
import { handleBankCallback } from "../../src/features/money/bank";
import * as invBankDb from "../../src/database/investments-and-bank";
import * as usersDb from "../../src/database/users";
import * as messagesApi from "../../src/telegram/messages";
import { RuntimeEnv } from "../../src/types/environment";

const MOCK_ENV: RuntimeEnv = {
  BOT_TOKEN: "123456:TEST_TOKEN",
  OWNER_ID: 8210345021,
  CORE_DATABASE_URL: "postgres://localhost:5432/aloo_core",
  OPS_DATABASE_URL: "postgres://localhost:5432/aloo_ops",
  HEALTH_PORT: 3000,
};

describe("Phase 3 & 4 — Passive Income, Property Rent, Bank & Net Worth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calculates business gross, 15% expenses, net profit, and 48-hour cap accurately", () => {
    const restaurant = BUSINESS_CATALOG.find((b) => b.id === "restaurant")!;
    const t0 = 1_700_000_000;

    // 24 hours elapsed at level 1
    const day1 = calculateBusinessAccrual(restaurant, 1, t0, t0 + 86400);
    expect(day1.accruedGross).toBe(250_000);
    expect(day1.accruedExpenses).toBe(37_500);
    expect(day1.accruedNet).toBe(212_500);

    // 96 hours elapsed -> capped at 48 hours (2 days)
    const day4 = calculateBusinessAccrual(restaurant, 1, t0, t0 + 4 * 86400);
    expect(day4.cappedElapsedSec).toBe(48 * 3600);
    expect(day4.accruedGross).toBe(500_000);
    expect(day4.accruedNet).toBe(425_000);
  });

  it("calculates property rent and 48-hour cap accurately", () => {
    const villa = PROPERTY_CATALOG.find((p) => p.id === "luxury_villa")!;
    const t0 = 1_700_000_000;

    const day1 = calculatePropertyAccrual(villa, 1, t0, t0 + 86400);
    expect(day1.accruedRent).toBe(300_000);

    const day5 = calculatePropertyAccrual(villa, 1, t0, t0 + 5 * 86400);
    expect(day5.accruedRent).toBe(600_000);
  });

  it("calculates bank interest at 0.03%/day and enforces the ₹10 Crore principal cap", () => {
    const t0 = 1_700_000_000;

    // ₹12,00,000 for 1 day -> ₹360
    const res1 = calculateBankAccruedInterest(1_200_000, t0, t0 + 86400);
    expect(res1.accruedInterest).toBe(360);

    // ₹25 Crore savings -> capped at ₹10 Crore principal -> ₹30,000/day
    const resCapped = calculateBankAccruedInterest(250_000_000, t0, t0 + 86400);
    expect(resCapped.eligiblePrincipal).toBe(100_000_000);
    expect(resCapped.accruedInterest).toBe(30_000);
  });

  it("unlocks business slots progressively by net worth", () => {
    expect(getAllowedBusinessSlots(500_000)).toBe(1);
    expect(getAllowedBusinessSlots(2_000_000)).toBe(2);
    expect(getAllowedBusinessSlots(15_000_000)).toBe(3);
  });

  it("enforces session ownership and prevents duplicate interest claims on /bank and /business", async () => {
    vi.spyOn(usersDb, "ensureUserExists").mockResolvedValue();
    vi.spyOn(usersDb, "getUser").mockResolvedValue({
      user_id: 1001,
      balance: 50000,
      ammo: 0,
      kills: 0,
      is_alive: 1,
      protected_until: 0,
      last_daily: 0,
    });
    const answerSpy = vi
      .spyOn(messagesApi, "answerCallbackQuery")
      .mockResolvedValue({ ok: true, result: true });
    vi.spyOn(messagesApi, "editMessageText").mockResolvedValue({ ok: true });

    // Intruder rejected on business
    await handleBusinessCallback(MOCK_ENV, {
      id: "cq_biz_intruder",
      from: { id: 8888, first_name: "Intruder" },
      message: { message_id: 20, chat: { id: -1001, type: "supergroup" } },
      data: "biz:1001:collect:1",
    });
    expect(answerSpy).toHaveBeenCalledWith(
      MOCK_ENV.BOT_TOKEN,
      "cq_biz_intruder",
      "⚠️ This business dashboard belongs to another player. Send /business to open yours!",
      true
    );

    // Duplicate interest claim handled safely
    vi.spyOn(invBankDb, "claimBankInterestTx").mockResolvedValue({
      status: "no_interest_yet",
    });
    vi.spyOn(invBankDb, "getBankAccountState").mockResolvedValue({
      walletBalance: 50000,
      savingsBalance: 1200000,
      lastInterestAt: 1700000000,
      totalInterestEarned: 360,
      availableInterest: 0,
      eligiblePrincipal: 1200000,
    });

    await handleBankCallback(MOCK_ENV, {
      id: "cq_bnk_int_dup",
      from: { id: 1001, first_name: "Shivang" },
      message: { message_id: 21, chat: { id: 1001, type: "private" } },
      data: "bnk:1001:interest",
    });
    expect(answerSpy).toHaveBeenLastCalledWith(
      MOCK_ENV.BOT_TOKEN,
      "cq_bnk_int_dup",
      "⏳ No interest accrued yet. Deposit savings and check back later!",
      true
    );
  });
});

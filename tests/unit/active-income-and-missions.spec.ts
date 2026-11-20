import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateBalancedShiftPay, handleWorkCallback } from "../../src/features/money/work";
import { handleDeliveryCallback } from "../../src/features/money/delivery";
import { handleFreelanceCallback } from "../../src/features/money/freelance";
import { handleMissionCallback } from "../../src/features/money/missions";
import * as activeDb from "../../src/database/active-income";
import * as usersDb from "../../src/database/users";
import * as invDb from "../../src/database/inventory";
import * as messagesApi from "../../src/telegram/messages";
import { RuntimeEnv } from "../../src/types/environment";

const MOCK_ENV: RuntimeEnv = {
  BOT_TOKEN: "123456:TEST_TOKEN",
  OWNER_ID: 8210345021,
  CORE_DATABASE_URL: "postgres://localhost:5432/aloo_core",
  OPS_DATABASE_URL: "postgres://localhost:5432/aloo_ops",
  HEALTH_PORT: 3000,
};

describe("Phase 2 — Active Income & Missions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("computes balanced shift salaries strictly within the profession band", () => {
    for (let i = 0; i < 40; i++) {
      const pay = calculateBalancedShiftPay(12000, 20000);
      expect(pay).toBeGreaterThanOrEqual(12000);
      expect(pay).toBeLessThanOrEqual(20000);
      expect(pay % 100).toBe(0);
    }
  });

  it("enforces session ownership and cooldowns on /work callbacks", async () => {
    const answerSpy = vi
      .spyOn(messagesApi, "answerCallbackQuery")
      .mockResolvedValue({ ok: true, result: true });

    // Intruder click rejected
    await handleWorkCallback(MOCK_ENV, {
      id: "cq_wrk_intruder",
      from: { id: 9999, first_name: "Intruder" },
      message: { message_id: 10, chat: { id: -1001, type: "supergroup" } },
      data: "wrk:1001:shift",
    });
    expect(answerSpy).toHaveBeenCalledWith(
      MOCK_ENV.BOT_TOKEN,
      "cq_wrk_intruder",
      "⚠️ This Work Centre belongs to another player. Send /work to open yours!",
      true
    );

    // Owner shift completion
    vi.spyOn(usersDb, "ensureUserExists").mockResolvedValue();
    vi.spyOn(activeDb, "getUserWorkState").mockResolvedValue({
      balance: 1000,
      profession: "engineer",
      lastWorkAt: 0,
      lastJobChangeAt: 0,
      dailyActiveEarned: 0,
      totalShifts: 0,
    });
    vi.spyOn(activeDb, "completeWorkShiftTx").mockResolvedValueOnce({
      status: "ok",
      professionId: "engineer",
      earned: 16500,
      newBalance: 17500,
    });
    const editSpy = vi
      .spyOn(messagesApi, "editMessageText")
      .mockResolvedValue({ ok: true });

    await handleWorkCallback(MOCK_ENV, {
      id: "cq_wrk_ok",
      from: { id: 1001, first_name: "Shivang" },
      message: { message_id: 10, chat: { id: -1001, type: "supergroup" } },
      data: "wrk:1001:shift",
    });

    expect(editSpy.mock.calls[0][3]).toContain("SHIFT COMPLETED");
    expect(editSpy.mock.calls[0][3]).toContain("Engineer");
    expect(editSpy.mock.calls[0][3]).toContain("₹16,500");
  });

  it("handles delivery acceptance, completion, and expired orders safely", async () => {
    vi.spyOn(usersDb, "ensureUserExists").mockResolvedValue();
    vi.spyOn(invDb, "getInventory").mockResolvedValue([
      { user_id: 1001, item_name: "ktm", quantity: 1 },
    ]);
    const answerSpy = vi
      .spyOn(messagesApi, "answerCallbackQuery")
      .mockResolvedValue({ ok: true, result: true });
    const editSpy = vi
      .spyOn(messagesApi, "editMessageText")
      .mockResolvedValue({ ok: true });

    vi.spyOn(activeDb, "completeDeliveryOrderTx")
      .mockResolvedValueOnce({
        status: "ok",
        title: "Premium Delivery",
        destination: "Luxury Apartments",
        earned: 18400,
        vehicleBonus: 2400,
        newBalance: 19400,
      })
      .mockResolvedValueOnce({ status: "expired_or_invalid" });

    await handleDeliveryCallback(MOCK_ENV, {
      id: "cq_del_1",
      from: { id: 1001, first_name: "Shivang" },
      message: { message_id: 11, chat: { id: 1001, type: "private" } },
      data: "del:1001:done:ord_abc123",
    });
    expect(editSpy.mock.calls[0][3]).toContain("DELIVERY COMPLETED");
    expect(editSpy.mock.calls[0][3]).toContain("+₹2,400");

    await handleDeliveryCallback(MOCK_ENV, {
      id: "cq_del_exp",
      from: { id: 1001, first_name: "Shivang" },
      message: { message_id: 11, chat: { id: 1001, type: "private" } },
      data: "del:1001:done:ord_expired",
    });
    expect(answerSpy).toHaveBeenLastCalledWith(
      MOCK_ENV.BOT_TOKEN,
      "cq_del_exp",
      "⚠️ Order expired or not accepted yet.",
      true
    );
  });

  it("prevents duplicate freelance task claims and uncompleted mission claims", async () => {
    vi.spyOn(usersDb, "ensureUserExists").mockResolvedValue();
    const answerSpy = vi
      .spyOn(messagesApi, "answerCallbackQuery")
      .mockResolvedValue({ ok: true, result: true });

    vi.spyOn(activeDb, "completeFreelanceTaskTx").mockResolvedValue({
      status: "already_completed",
    });

    await handleFreelanceCallback(MOCK_ENV, {
      id: "cq_frl_dup",
      from: { id: 1001, first_name: "Shivang" },
      message: { message_id: 12, chat: { id: 1001, type: "private" } },
      data: "frl:1001:done:frl_task1",
    });
    expect(answerSpy).toHaveBeenLastCalledWith(
      MOCK_ENV.BOT_TOKEN,
      "cq_frl_dup",
      "✅ Contract already completed."
    );

    vi.spyOn(activeDb, "claimMissionRewardTx").mockResolvedValue({
      status: "not_completed",
      progress: 1,
      target: 3,
    });

    await handleMissionCallback(MOCK_ENV, {
      id: "cq_msn_incomplete",
      from: { id: 1001, first_name: "Shivang" },
      message: { message_id: 13, chat: { id: 1001, type: "private" } },
      data: "msn:1001:claim:daily_work_3",
    });
    expect(answerSpy).toHaveBeenLastCalledWith(
      MOCK_ENV.BOT_TOKEN,
      "cq_msn_incomplete",
      "⏳ Progress: 1/3 — complete the objective first!",
      true
    );
  });
});

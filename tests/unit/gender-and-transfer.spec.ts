import { describe, it, expect, vi, beforeEach } from "vitest";
import { COMMAND_REGISTRY } from "../../src/bot/command-list";
import { genderHandlers, handleGenderCallback } from "../../src/features/money/gender";
import { adminTransferHandlers } from "../../src/features/money/admin-transfer";
import { profileHandlers } from "../../src/features/money/profile";
import { HELP_DIRECTORY_TEXT } from "../../src/features/help/help-text";
import * as profileAdminDb from "../../src/database/profile-admin";
import * as economyDb from "../../src/database/economy";
import * as usersDb from "../../src/database/users";
import * as invBankDb from "../../src/database/investments-and-bank";
import * as messagesApi from "../../src/telegram/messages";
import { BotContext } from "../../src/types/bot";
import { RuntimeEnv } from "../../src/types/environment";

const MOCK_ENV: RuntimeEnv = {
  BOT_TOKEN: "123456:TEST_TOKEN",
  OWNER_ID: 8210345021,
  CORE_DATABASE_URL: "postgres://localhost:5432/aloo_core",
  OPS_DATABASE_URL: "postgres://localhost:5432/aloo_ops",
  HEALTH_PORT: 3000,
};

function makeCtx(overrides: Partial<BotContext>): BotContext {
  return {
    env: MOCK_ENV,
    update: { update_id: 9001 },
    message: {
      message_id: 100,
      from: { id: 1001, first_name: "PlayerOne" },
      chat: { id: -100123456, type: "supergroup" },
      text: "/gender",
    },
    chatId: -100123456,
    userId: 1001,
    text: "/gender",
    command: "/gender",
    args: [],
    ...overrides,
  };
}

describe("Phase 5, 6 & 7 — Gender, Owner /transfer, Profile & Regression", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("allows voluntary one-time gender selection and locks repeat changes", async () => {
    vi.spyOn(usersDb, "ensureUserExists").mockResolvedValue();
    vi.spyOn(messagesApi, "answerCallbackQuery").mockResolvedValue({ ok: true, result: true });
    const editSpy = vi
      .spyOn(messagesApi, "editMessageText")
      .mockResolvedValue({ ok: true });

    const setOnceSpy = vi
      .spyOn(profileAdminDb, "setPlayerGenderOnceTx")
      .mockResolvedValueOnce({ status: "ok", gender: "male" })
      .mockResolvedValueOnce({ status: "already_set", existingGender: "male" });

    // First selection succeeds
    await handleGenderCallback(MOCK_ENV, {
      id: "cq_gdr_1",
      from: { id: 1001, first_name: "Shivang" },
      message: { message_id: 50, chat: { id: 1001, type: "private" } },
      data: "gdr:1001:set:male",
    });

    expect(setOnceSpy).toHaveBeenCalledWith(1001, "male");
    expect(editSpy.mock.calls[0][3]).toContain("GENDER SAVED");
    expect(editSpy.mock.calls[0][3]).toContain("Male");

    // Second attempt is locked
    await handleGenderCallback(MOCK_ENV, {
      id: "cq_gdr_2",
      from: { id: 1001, first_name: "Shivang" },
      message: { message_id: 50, chat: { id: 1001, type: "private" } },
      data: "gdr:1001:set:female",
    });

    expect(editSpy.mock.calls[1][3]).toContain("can only be changed by the bot owner");
  });

  it("displays gender in /profile only when set and hides it when unselected", async () => {
    vi.spyOn(usersDb, "ensureUserExists").mockResolvedValue();
    vi.spyOn(invBankDb, "getPlayerNetWorth").mockResolvedValue({
      wallet: 1000,
      bankSavings: 0,
      businessValue: 0,
      propertyValue: 0,
      inventoryValue: 0,
      netWorth: 1000,
      dailyBusinessNet: 0,
      dailyRentalIncome: 0,
      rank: { name: "Beginner", emoji: "🌱", minNetWorth: 0 },
    });

    const getUserSpy = vi
      .spyOn(usersDb, "getUser")
      .mockResolvedValueOnce({
        user_id: 1001,
        first_name: "Shivang",
        balance: 1000,
        ammo: 5,
        kills: 2,
        is_alive: 1,
        protected_until: 0,
        last_daily: 0,
        gender: null,
      })
      .mockResolvedValueOnce({
        user_id: 1001,
        first_name: "Shivang",
        balance: 1000,
        ammo: 5,
        kills: 2,
        is_alive: 1,
        protected_until: 0,
        last_daily: 0,
        gender: "male",
      });

    const sendSpy = vi
      .spyOn(messagesApi, "sendMessage")
      .mockResolvedValue({ ok: true, result: { message_id: 60 } });

    // Unselected -> no Gender line
    await profileHandlers["/profile"](makeCtx({ command: "/profile", text: "/profile" }));
    expect(sendSpy.mock.calls[0][2]).toContain("Name: <b>PlayerOne</b>");
    expect(sendSpy.mock.calls[0][2]).not.toContain("Gender:");

    // Selected -> shows Gender: Male
    await profileHandlers["/profile"](makeCtx({ command: "/profile", text: "/profile" }));
    expect(getUserSpy).toHaveBeenCalledTimes(2);
    expect(sendSpy.mock.calls[1][2]).toContain("Gender: <b>Male</b>");
  });

  it("enforces owner authorization and audit logging on /setgender", async () => {
    const sendSpy = vi
      .spyOn(messagesApi, "sendMessage")
      .mockResolvedValue({ ok: true, result: { message_id: 70 } });
    const ownerSetSpy = vi
      .spyOn(profileAdminDb, "ownerSetPlayerGenderTx")
      .mockResolvedValue({ status: "ok", previousGender: "male", newGender: null });

    // Non-owner rejected
    await genderHandlers["/setgender"](
      makeCtx({
        userId: 1001,
        command: "/setgender",
        args: ["female"],
        reply: {
          message_id: 99,
          from: { id: 2002, first_name: "Target" },
          chat: { id: -100123456, type: "supergroup" },
        },
      })
    );
    expect(ownerSetSpy).not.toHaveBeenCalled();
    expect(sendSpy.mock.calls[0][2]).toContain("Access Denied");

    // Owner updates target to 'none'
    await genderHandlers["/setgender"](
      makeCtx({
        userId: MOCK_ENV.OWNER_ID,
        update: { update_id: 9100 },
        command: "/setgender",
        args: ["none"],
        reply: {
          message_id: 99,
          from: { id: 2002, first_name: "Target" },
          chat: { id: -100123456, type: "supergroup" },
        },
      })
    );
    expect(ownerSetSpy).toHaveBeenCalledWith({
      ownerId: MOCK_ENV.OWNER_ID,
      targetUserId: 2002,
      targetFirstName: "Target",
      newGender: null,
      idempotencyKey: "setgender_upd_9100",
    });
    expect(sendSpy.mock.calls[1][2]).toContain("PROFILE GENDER UPDATED");
  });

  it("enforces owner-only reply validation, credit/debit, self-reply, and non-negative balance on /transfer", async () => {
    const sendSpy = vi
      .spyOn(messagesApi, "sendMessage")
      .mockResolvedValue({ ok: true, result: { message_id: 80 } });
    const adjustSpy = vi
      .spyOn(economyDb, "adminAdjustWalletTx")
      .mockResolvedValueOnce({
        status: "ok",
        oldBalance: 100000,
        newBalance: 600000,
        adjustedAmount: 500000,
      })
      .mockResolvedValueOnce({
        status: "ok",
        oldBalance: 600000,
        newBalance: 400000,
        adjustedAmount: -200000,
      })
      .mockResolvedValueOnce({
        status: "insufficient_balance",
        balance: 50000,
      });

    // Non-owner rejected
    await adminTransferHandlers["/transfer"](
      makeCtx({
        userId: 1001,
        command: "/transfer",
        args: ["500000"],
        reply: {
          message_id: 99,
          from: { id: 2002, first_name: "Player" },
          chat: { id: -100123456, type: "supergroup" },
        },
      })
    );
    expect(sendSpy.mock.calls[0][2]).toContain("Access Denied");

    // Owner without reply rejected
    await adminTransferHandlers["/transfer"](
      makeCtx({
        userId: MOCK_ENV.OWNER_ID,
        command: "/transfer",
        args: ["500000"],
        reply: undefined,
      })
    );
    expect(sendSpy.mock.calls[1][2]).toContain("Reply Required");

    // Malformed / zero / decimal amounts rejected
    await adminTransferHandlers["/transfer"](
      makeCtx({
        userId: MOCK_ENV.OWNER_ID,
        command: "/transfer",
        args: ["12.34"],
        reply: {
          message_id: 99,
          from: { id: 2002, first_name: "Player" },
          chat: { id: -100123456, type: "supergroup" },
        },
      })
    );
    expect(sendSpy.mock.calls[2][2]).toContain("Invalid amount");
    expect(adjustSpy).not.toHaveBeenCalled();

    // Owner credits +500000 (replying to self)
    await adminTransferHandlers["/transfer"](
      makeCtx({
        userId: MOCK_ENV.OWNER_ID,
        update: { update_id: 9201 },
        command: "/transfer",
        args: ["+500000"],
        reply: {
          message_id: 99,
          from: { id: MOCK_ENV.OWNER_ID, first_name: "Shivang" },
          chat: { id: -100123456, type: "supergroup" },
        },
      })
    );
    expect(sendSpy.mock.calls[3][2]).toContain("WALLET CREDITED");
    expect(sendSpy.mock.calls[3][2]).toContain("+₹5,00,000");

    // Owner debits -200000
    await adminTransferHandlers["/transfer"](
      makeCtx({
        userId: MOCK_ENV.OWNER_ID,
        update: { update_id: 9202 },
        command: "/transfer",
        args: ["-200000"],
        reply: {
          message_id: 99,
          from: { id: 2002, first_name: "Player" },
          chat: { id: -100123456, type: "supergroup" },
        },
      })
    );
    expect(sendSpy.mock.calls[4][2]).toContain("WALLET DEBITED");
    expect(sendSpy.mock.calls[4][2]).toContain("-₹2,00,000");

    // Debit exceeding balance rejected cleanly
    await adminTransferHandlers["/transfer"](
      makeCtx({
        userId: MOCK_ENV.OWNER_ID,
        update: { update_id: 9203 },
        command: "/transfer",
        args: ["-900000"],
        reply: {
          message_id: 99,
          from: { id: 2002, first_name: "Player" },
          chat: { id: -100123456, type: "supergroup" },
        },
      })
    );
    expect(sendSpy.mock.calls[5][2]).toContain("Debit Rejected");
  });

  it("keeps all legacy and hybrid economy commands registered and hides owner commands from public /help", () => {
    const requiredCommands = [
      "/start", "/ping", "/id", "/top", "/leaderboard",
      "/bal", "/balance", "/me", "/profile", "/buy", "/daily",
      "/rob", "/pay", "/give", "/safe", "/inv", "/inventory",
      "/market", "/sell", "/gift",
      "/economy", "/work", "/delivery", "/freelance", "/mission", "/weekly",
      "/business", "/property", "/rent", "/bank", "/networth",
      "/gender", "/setgender", "/transfer",
      "/fire", "/shoot", "/defend", "/shield", "/revive",
      "/dice", "/flip", "/rps", "/8ball",
      "/promote", "/demote", "/title", "/admins",
      "/dmui", "/broadcast", "/broadcaststop", "/broadcaststart",
      "/add", "/approved", "/empty", "/help",
    ];

    for (const cmd of requiredCommands) {
      expect(typeof COMMAND_REGISTRY[cmd]).toBe("function");
    }

    expect(HELP_DIRECTORY_TEXT).not.toContain("/transfer");
    expect(HELP_DIRECTORY_TEXT).not.toContain("/setgender");
  });
});

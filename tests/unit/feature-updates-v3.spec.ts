import { describe, it, expect, vi, beforeEach } from "vitest";
import { COMMAND_REGISTRY } from "../../src/bot/command-list";
import { HELP_DIRECTORY_TEXT } from "../../src/features/help/help-text";
import { dmMenuHandlers } from "../../src/features/dm-menu/menu-command";
import { handleDMUICallback } from "../../src/features/dm-menu/callbacks";
import { handleDMUIMediaInput } from "../../src/features/dm-menu/media-input";
import { shootingHandlers } from "../../src/features/battle/shooting";
import { reviveHandlers } from "../../src/features/battle/revive";
import { robberyHandlers } from "../../src/features/money/robbery";
import { balanceHandlers } from "../../src/features/money/balance";
import * as savedSettings from "../../src/database/saved-settings";
import * as usersDb from "../../src/database/users";
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
    update: { update_id: 50001 },
    message: {
      message_id: 100,
      from: { id: 1001, first_name: "Gaurantee" },
      chat: { id: -100123456, type: "supergroup" },
      text: "/bal",
    },
    chatId: -100123456,
    userId: 1001,
    text: "/bal",
    command: "/bal",
    args: [],
    ...overrides,
  };
}

describe("Feature Updates: /dmui, /dice removal, /fire, /revive, /rob & /bal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. /dmui removes Button option and supports Photo, Video, and GIF animation", async () => {
    vi.spyOn(savedSettings, "setSetting").mockResolvedValue();
    vi.spyOn(savedSettings, "getSetting").mockImplementation(async (key: string) => (key === "dmui_owner_state" ? ("AWAIT_MEDIA" as any) : ({} as any)));
    const sendSpy = vi
      .spyOn(messagesApi, "sendMessage")
      .mockResolvedValue({ ok: true, result: { message_id: 10 } });

    await dmMenuHandlers["/dmui"](
      makeCtx({ userId: MOCK_ENV.OWNER_ID, command: "/dmui", text: "/dmui" })
    );

    const kb = sendSpy.mock.calls[0][3]?.inline_keyboard;
    const allButtons = kb.flat();
    expect(allButtons.some((b: any) => b.text.includes("Text"))).toBe(true);
    expect(allButtons.some((b: any) => b.text.includes("Media"))).toBe(true);
    expect(allButtons.some((b: any) => b.text.includes("Button"))).toBe(false);

    // GIF upload saved as animation
    const gifSaved = await handleDMUIMediaInput(
      makeCtx({
        userId: MOCK_ENV.OWNER_ID,
        message: {
          message_id: 11,
          from: { id: MOCK_ENV.OWNER_ID, first_name: "Owner" },
          chat: { id: MOCK_ENV.OWNER_ID, type: "private" },
          animation: { file_id: "CgACAgQAAxkBAAIB_gif_file_id" },
        } as any,
      })
    );
    expect(gifSaved).toBe(true);
    expect(savedSettings.setSetting).toHaveBeenCalledWith(
      "dmui_live_config",
      expect.objectContaining({
        mediaType: "animation",
        mediaFileId: "CgACAgQAAxkBAAIB_gif_file_id",
      })
    );

    // Preview renders saved GIF using sendAnimation
    vi.spyOn(messagesApi, "answerCallbackQuery").mockResolvedValue({ ok: true, result: true });
    vi.spyOn(savedSettings, "getSetting").mockResolvedValue({
      customText: "Welcome {first_name}",
      mediaType: "animation",
      mediaFileId: "CgACAgQAAxkBAAIB_gif_file_id",
    });
    const animSpy = vi
      .spyOn(messagesApi, "sendAnimation")
      .mockResolvedValue({ ok: true, result: { message_id: 12 } });

    await handleDMUICallback(MOCK_ENV, {
      id: "cq_preview_gif",
      from: { id: MOCK_ENV.OWNER_ID, first_name: "Owner" },
      message: { message_id: 10, chat: { id: MOCK_ENV.OWNER_ID, type: "private" } },
      data: "dmui:preview",
    });
    expect(animSpy).toHaveBeenCalledWith(
      MOCK_ENV.BOT_TOKEN,
      MOCK_ENV.OWNER_ID,
      "CgACAgQAAxkBAAIB_gif_file_id",
      "Welcome Owner",
      expect.any(Object)
    );
  });

  it("2. /dice is completely removed while /flip, /rps, and /8ball remain active", () => {
    expect(COMMAND_REGISTRY["/dice"]).toBeUndefined();
    expect(HELP_DIRECTORY_TEXT).not.toContain("/dice");
    expect(typeof COMMAND_REGISTRY["/flip"]).toBe("function");
    expect(typeof COMMAND_REGISTRY["/rps"]).toBe("function");
    expect(typeof COMMAND_REGISTRY["/8ball"]).toBe("function");
  });

  it("3. /fire uses the exact new kill format, ₹200-300 reward, and exact already-dead response", async () => {
    const sendSpy = vi
      .spyOn(messagesApi, "sendMessage")
      .mockResolvedValue({ ok: true, result: { message_id: 20 } });

    const fireSpy = vi
      .spyOn(usersDb, "fireAtTargetTx")
      .mockResolvedValueOnce({ status: "eliminated", reward: 205, remainingBullets: 106 })
      .mockResolvedValueOnce({ status: "target_dead" });

    // Successful elimination (works even if shooter is dead)
    await shootingHandlers["/fire"](
      makeCtx({
        update: { update_id: 60001 },
        command: "/fire",
        reply: {
          message_id: 99,
          from: { id: 2002, first_name: "Pʀɪɴᴄᴇ 🎋" },
          chat: { id: -100123456, type: "supergroup" },
        },
      })
    );

    expect(fireSpy).toHaveBeenNthCalledWith(1, 1001, 2002, "fire_upd_60001");
    expect(sendSpy.mock.calls[0][2]).toBe(
      `ㅤ▄︻̷ ┻ ═━ㅤㅤᴰᵉᵃᵈ\n` +
        `🎯 Gaurantee ➜ Pʀɪɴᴄᴇ 🎋 😭\n` +
        `💰 +₹205 • 🔫 106 Ammo Left`
    );

    // Already-dead target response
    await shootingHandlers["/fire"](
      makeCtx({
        update: { update_id: 60002 },
        command: "/fire",
        reply: {
          message_id: 99,
          from: { id: 2002, first_name: "Pʀɪɴᴄᴇ 🎋" },
          chat: { id: -100123456, type: "supergroup" },
        },
      })
    );

    expect(sendSpy.mock.calls[1][2]).toBe(
      `💔 <a href="tg://user?id=2002">Pʀɪɴᴄᴇ 🎋</a> , already Dead.`
    );
  });

  it("4. /revive supports self-revive and reply-based revive for ₹200, and /rob blocks dead players", async () => {
    vi.spyOn(usersDb, "ensureUserExists").mockResolvedValue();
    const sendSpy = vi
      .spyOn(messagesApi, "sendMessage")
      .mockResolvedValue({ ok: true, result: { message_id: 30 } });

    const reviveSpy = vi
      .spyOn(usersDb, "revivePlayerTx")
      .mockResolvedValueOnce({ status: "ok", payerNewBalance: 800 })
      .mockResolvedValueOnce({ status: "ok", payerNewBalance: 600 })
      .mockResolvedValueOnce({ status: "already_alive" })
      .mockResolvedValueOnce({ status: "insufficient_balance", payerBalance: 50 });

    // Self-revive
    await reviveHandlers["/revive"](
      makeCtx({ update: { update_id: 70001 }, command: "/revive", reply: undefined })
    );
    expect(reviveSpy).toHaveBeenNthCalledWith(1, 1001, 200, 1001, "revive_upd_70001");
    expect(sendSpy.mock.calls[0][2]).toContain("REVIVAL SUCCESSFUL");
    expect(sendSpy.mock.calls[0][2]).toContain("₹200");

    // Reply-based revive (sender pays for target)
    await reviveHandlers["/revive"](
      makeCtx({
        update: { update_id: 70002 },
        command: "/revive",
        reply: {
          message_id: 99,
          from: { id: 2002, first_name: "Friend" },
          chat: { id: -100123456, type: "supergroup" },
        },
      })
    );
    expect(reviveSpy).toHaveBeenNthCalledWith(2, 1001, 200, 2002, "revive_upd_70002");
    expect(sendSpy.mock.calls[1][2]).toContain("PLAYER REVIVED");
    expect(sendSpy.mock.calls[1][2]).toContain("Friend");

    // Already alive target
    await reviveHandlers["/revive"](
      makeCtx({
        update: { update_id: 70003 },
        command: "/revive",
        reply: {
          message_id: 99,
          from: { id: 2002, first_name: "Friend" },
          chat: { id: -100123456, type: "supergroup" },
        },
      })
    );
    expect(sendSpy.mock.calls[2][2]).toContain("already alive");

    // Insufficient balance
    await reviveHandlers["/revive"](
      makeCtx({ update: { update_id: 70004 }, command: "/revive", reply: undefined })
    );
    expect(sendSpy.mock.calls[3][2]).toContain("Insufficient Balance");

    // Dead player blocked from /rob
    vi.spyOn(usersDb, "robPlayerTx").mockResolvedValue({ status: "attacker_dead" });
    await robberyHandlers["/rob"](
      makeCtx({
        command: "/rob",
        reply: {
          message_id: 99,
          from: { id: 2002, first_name: "Target" },
          chat: { id: -100123456, type: "supergroup" },
        },
      })
    );
    expect(sendSpy.mock.calls[4][2]).toContain("must be alive to rob");
  });

  it("5. /bal displays the exact redesigned format with unbolded values and gun footer", async () => {
    vi.spyOn(usersDb, "ensureUserExists").mockResolvedValue();
    vi.spyOn(usersDb, "getUser").mockResolvedValue({
      user_id: 1001,
      first_name: "Gaurantee",
      balance: 51642,
      ammo: 106,
      kills: 4,
      is_alive: 1,
      protected_until: 0,
      last_daily: 0,
    });

    const sendSpy = vi
      .spyOn(messagesApi, "sendMessage")
      .mockResolvedValue({ ok: true, result: { message_id: 40 } });

    await balanceHandlers["/bal"](makeCtx({ command: "/bal" }));

    expect(sendSpy.mock.calls[0][2]).toBe(
      `🥰 <a href="tg://user?id=1001">Gaurantee</a> (𝗔𝗹𝗶𝘃𝗲)\n` +
        `💸 𝐁αᥣα𐓣𝖼𝖾: ₹51642\n` +
        `☠️ 𝐊𝗂ᥣᥣ𝗌: 4\n` +
        `🔫 𝐀ꭑꭑⱺ: 106\n` +
        `||▄︻ ┻ ═━=||`
    );
  });
});

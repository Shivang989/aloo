import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatIndianLeaderboardWealth,
  formatFixedWidthName,
  leaderboardHandlers,
  handleLeaderboardCallback,
} from "../../src/features/stats/leaderboard";
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

function makeCtx(command: string): BotContext {
  return {
    env: MOCK_ENV,
    update: { update_id: 88001 },
    message: {
      message_id: 10,
      from: { id: 1001, first_name: "Gaurantee" },
      chat: { id: -100123456, type: "supergroup" },
      text: command,
    },
    chatId: -100123456,
    userId: 1001,
    text: command,
    command,
    args: [],
  };
}

describe("World Top Richest (/top) & Net Worth (/net) Leaderboards", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("formats Indian currency units starting at ₹1 Lakh and keeps <₹1 Lakh exact", () => {
    expect(formatIndianLeaderboardWealth(900)).toBe("₹900");
    expect(formatIndianLeaderboardWealth(12500)).toBe("₹12500");
    expect(formatIndianLeaderboardWealth(85400)).toBe("₹85400");
    expect(formatIndianLeaderboardWealth(150_000)).toBe("₹1.5 Lakh");
    expect(formatIndianLeaderboardWealth(2_500_000)).toBe("₹25 Lakh");
    expect(formatIndianLeaderboardWealth(15_000_000)).toBe("₹1.5 Crore");
    expect(formatIndianLeaderboardWealth(250_000_000)).toBe("₹25 Crore");
    expect(formatIndianLeaderboardWealth(1_500_000_000)).toBe("₹1.5 Arab");
    expect(formatIndianLeaderboardWealth(100_000_000_000)).toBe("₹1 Kharab");
  });

  it("truncates long usernames to 15 display columns with '...' and aligns compactly", () => {
    const short = formatFixedWidthName("HP+", 15);
    expect(short).toBe("HP+            ");
    expect(short).toHaveLength(15);

    const long = formatFixedWidthName("VeryLongUsernameExceedingLimit", 15);
    expect(long).toHaveLength(15);
    expect(long.endsWith("...")).toBe(true);
  });

  it("renders /top and /net with clickable player mentions (no nested <code> inside <a>) and toggle button", async () => {
    vi.spyOn(usersDb, "getTopPlayers").mockResolvedValue([
      { user_id: 1, first_name: "Gaurantee", balance: 150_000, ammo: 0, kills: 0, is_alive: 1, protected_until: 0, last_daily: 0 },
      { user_id: 2, first_name: "SecondHeroPlayerWithLongName", balance: 107_579, ammo: 0, kills: 0, is_alive: 1, protected_until: 0, last_daily: 0 },
      { user_id: 3, first_name: "Player Three", balance: 85400, ammo: 0, kills: 0, is_alive: 1, protected_until: 0, last_daily: 0 },
      { user_id: 4, first_name: "HP+", balance: 10000, ammo: 0, kills: 0, is_alive: 1, protected_until: 0, last_daily: 0 },
      { user_id: 5, first_name: "SUNNY", balance: 8500, ammo: 0, kills: 0, is_alive: 1, protected_until: 0, last_daily: 0 },
    ]);

    vi.spyOn(invBankDb, "getTopWealthLeaderboard").mockResolvedValue([
      { user_id: 1, first_name: "Gaurantee", net_worth: 25_000_000 },
      { user_id: 2, first_name: "InvestorTwo", net_worth: 15_000_000 },
    ]);

    const sendSpy = vi
      .spyOn(messagesApi, "sendMessage")
      .mockResolvedValue({ ok: true, result: { message_id: 77 } });
    const editSpy = vi
      .spyOn(messagesApi, "editMessageText")
      .mockResolvedValue({ ok: true });
    vi.spyOn(messagesApi, "answerCallbackQuery").mockResolvedValue({ ok: true, result: true });

    await leaderboardHandlers["/top"](makeCtx("/top"));

    const topText = sendSpy.mock.calls[0][2];
    const topKb = sendSpy.mock.calls[0][3];

    expect(topText.startsWith("🏆𝐖ⱺ𝗋ᥣᑯ 𝐓ⱺρ 𝐑𝗂𝖼ɦ𝖾𝗌𝗍 :")).toBe(true);
    expect(topText).toContain("★━━══━━── • ──━━══━━★");
    expect(topText.match(/╰────────────────/g)).toHaveLength(2);
    expect(topText).toContain(
      `<code>④ </code><a href="tg://user?id=4">HP+</a><code>             ➤ ₹10000</code>`
    );
    expect(topText).not.toContain("</a><code></code>");
    expect(topText).not.toContain('"><code>');
    expect(topKb.inline_keyboard[0][0]).toEqual({
      text: "🌍 World Top Net Worth",
      callback_data: "lb:net",
    });

    await handleLeaderboardCallback(MOCK_ENV, {
      id: "cq_lb_net",
      from: { id: 1001, first_name: "Gaurantee" },
      message: { message_id: 77, chat: { id: -100123456, type: "supergroup" } },
      data: "lb:net",
    });

    const netText = editSpy.mock.calls[0][3];
    const netKb = editSpy.mock.calls[0][4];
    expect(netText.startsWith("🌍𝐖ⱺ𝗋ᥣᑯ 𝐓ⱺρ 𝐍𝖾𝗍 𝐖ⱺ𝗋𝗍ɦ :")).toBe(true);
    expect(netText).toContain(
      `<a href="tg://user?id=1">Gaurantee</a><code>       ➤ ₹2.5 Crore</code>`
    );
    expect(netKb.inline_keyboard[0][0]).toEqual({
      text: "🏆 World Top Richest",
      callback_data: "lb:rich",
    });

    await handleLeaderboardCallback(MOCK_ENV, {
      id: "cq_lb_rich",
      from: { id: 1001, first_name: "Gaurantee" },
      message: { message_id: 77, chat: { id: -100123456, type: "supergroup" } },
      data: "lb:rich",
    });

    expect(editSpy.mock.calls[1][3].startsWith("🏆𝐖ⱺ𝗋ᥣᑯ 𝐓ⱺρ 𝐑𝗂𝖼ɦ𝖾𝗌𝗍 :")).toBe(true);
  });
});

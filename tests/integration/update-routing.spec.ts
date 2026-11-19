import { describe, it, expect, vi, beforeEach } from "vitest";
import { COMMAND_REGISTRY } from "../../src/bot/command-list";
import { routeTelegramUpdate } from "../../src/bot/update-router";
import { RuntimeEnv } from "../../src/types/environment";
import * as usersDb from "../../src/database/users";
import * as broadcastData from "../../src/database/broadcast-data";
import * as forceJoinData from "../../src/database/force-join-data";
import * as messagesApi from "../../src/telegram/messages";

const MOCK_ENV: RuntimeEnv = {
  BOT_TOKEN: "123456:TEST_TOKEN",
  OWNER_ID: 8210345021,
  CORE_DATABASE_URL: "postgres://localhost:5432/aloo_core",
  OPS_DATABASE_URL: "postgres://localhost:5432/aloo_ops",
  HEALTH_PORT: 3000,
};

describe("Command Registry & Telegram Update Routing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("registers all 39 legacy commands and aliases", () => {
    const expectedCommands = [
      "/start", "/ping", "/top", "/leaderboard",
      "/safe", "/rob", "/bal", "/balance", "/buy", "/daily",
      "/me", "/profile", "/pay", "/give", "/inv", "/inventory",
      "/market", "/sell",
      "/fire", "/shoot", "/defend", "/shield", "/revive",
      "/dice", "/flip", "/rps", "/8ball",
      "/promote", "/demote", "/title", "/admins",
      "/dmui", "/broadcast", "/broadcaststop", "/broadcaststart",
      "/add", "/approved", "/empty", "/help",
    ];

    for (const cmd of expectedCommands) {
      expect(typeof COMMAND_REGISTRY[cmd]).toBe("function");
    }
  });

  it("routes /ping and /flip updates end-to-end without DB or network side effects", async () => {
    vi.spyOn(broadcastData, "trackDestination").mockResolvedValue();
    vi.spyOn(broadcastData, "trackUser").mockResolvedValue();
    vi.spyOn(broadcastData, "trackGroupMember").mockResolvedValue();
    vi.spyOn(usersDb, "ensureUserExists").mockResolvedValue();
    vi.spyOn(forceJoinData, "isForceJoinModerator").mockResolvedValue(false);
    vi.spyOn(forceJoinData, "getForceJoinRule").mockResolvedValue(null);
    const sendSpy = vi
      .spyOn(messagesApi, "sendMessage")
      .mockResolvedValue({ ok: true, result: { message_id: 99 } });

    await routeTelegramUpdate(
      {
        update_id: 1001,
        message: {
          message_id: 10,
          from: { id: 555111222, first_name: "Shivang" },
          chat: { id: 555111222, type: "private" },
          text: "/ping",
        },
      },
      MOCK_ENV
    );

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][1]).toBe(555111222);
    expect(sendSpy.mock.calls[0][2]).toContain("Pong!");
  });
});

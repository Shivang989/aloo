import { describe, it, expect, vi, beforeEach } from "vitest";
import { adminListHandlers } from "../../src/features/group-admin/admin-list";
import { idHandlers } from "../../src/features/stats/id-command";
import * as chatsApi from "../../src/telegram/chats";
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
    update: { update_id: 1 },
    message: {
      message_id: 10,
      from: { id: 1001, first_name: "Sender" },
      chat: { id: -100123456789, type: "supergroup", title: "Test Group" },
      text: "/admins",
    },
    chatId: -100123456789,
    userId: 1001,
    text: "/admins",
    command: "/admins",
    args: [],
    ...overrides,
  };
}

describe("Live /admins Directory & /id Command", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders /admins with exact Unicode headings and clickable mentions for all owners and admins", async () => {
    vi.spyOn(chatsApi, "getChatAdministrators").mockResolvedValue({
      ok: true,
      administrators: [
        {
          status: "administrator",
          user: { id: 201, first_name: "AdminOne", username: "AdminOne" },
        },
        {
          status: "creator",
          user: { id: 101, first_name: "Owner", username: "im_hatee" },
        },
        {
          status: "administrator",
          user: { id: 201, first_name: "AdminOne", username: "AdminOne" },
        },
        {
          status: "administrator",
          user: { id: 202, first_name: "Gaurantee" },
        },
        {
          status: "administrator",
          is_anonymous: true,
          custom_title: "Shadow Mod",
        },
      ],
    });

    const sendSpy = vi
      .spyOn(messagesApi, "sendMessage")
      .mockResolvedValue({ ok: true, result: { message_id: 50 } });

    await adminListHandlers["/admins"](makeCtx({}));

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const output = sendSpy.mock.calls[0][2];

    expect(output).toBe(
      `👑 <b>𝐆𝗋ⱺυρ 𝐎ω𐓣𝖾𝗋</b>\n` +
        `──────────\n` +
        `1. @im_hatee\n\n` +
        `🤝 <b>𝐂υ𝗍𝖾 𝐀ᑯꭑ𝗂𐓣𝗌</b>🫶\n` +
        `──────────\n` +
        `1. @AdminOne\n` +
        `2. <a href="tg://user?id=202">Gaurantee</a>\n` +
        `3. Shadow Mod`
    );
  });

  it("handles private DMs and Telegram API failures gracefully in /admins", async () => {
    const sendSpy = vi
      .spyOn(messagesApi, "sendMessage")
      .mockResolvedValue({ ok: true, result: { message_id: 51 } });

    await adminListHandlers["/admins"](
      makeCtx({
        chatId: 1001,
        message: {
          message_id: 11,
          from: { id: 1001, first_name: "Sender" },
          chat: { id: 1001, type: "private" },
          text: "/admins",
        },
      })
    );
    expect(sendSpy.mock.calls[0][2]).toContain("only be used inside groups");

    vi.spyOn(chatsApi, "getChatAdministrators").mockResolvedValue({
      ok: false,
      error: "Forbidden: bot was kicked",
    });

    await adminListHandlers["/admins"](makeCtx({}));
    expect(sendSpy.mock.calls[1][2]).toContain("Unable to fetch group administrators");
    expect(sendSpy.mock.calls[1][2]).toContain("Forbidden: bot was kicked");
  });

  it("returns sender ID when /id is used standalone and replied user ID when used as reply", async () => {
    const sendSpy = vi
      .spyOn(messagesApi, "sendMessage")
      .mockResolvedValue({ ok: true, result: { message_id: 60 } });

    await idHandlers["/id"](
      makeCtx({
        command: "/id",
        text: "/id",
        message: {
          message_id: 20,
          from: { id: 555666777, first_name: "Shivang & Co" },
          chat: { id: 555666777, type: "private" },
          text: "/id",
        },
        chatId: 555666777,
        userId: 555666777,
      })
    );

    expect(sendSpy.mock.calls[0][2]).toBe(
      "👤 Name: Shivang &amp; Co\n🆔 ID: <code>555666777</code>"
    );

    await idHandlers["/id"](
      makeCtx({
        command: "/id",
        text: "/id",
        userId: 555666777,
        reply: {
          message_id: 19,
          from: { id: 999888777, first_name: "Target <Player>" },
          chat: { id: -100123456789, type: "supergroup" },
          text: "hello",
        },
      })
    );

    expect(sendSpy.mock.calls[1][2]).toBe(
      "👤 Name: Target &lt;Player&gt;\n🆔 ID: <code>999888777</code>"
    );
    expect(sendSpy.mock.calls[1][2]).not.toContain("555666777");
  });
});

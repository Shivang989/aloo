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

  it("displays owner separately at top and numbers group administrators cleanly", async () => {
    vi.spyOn(chatsApi, "getChatAdministrators").mockResolvedValue({
      ok: true,
      administrators: [
        {
          status: "administrator",
          user: { id: 201, first_name: "AdminOne", username: "AdminOne" },
        },
        {
          status: "creator",
          user: { id: 101, first_name: "Owner", username: "OwnerUsername" },
        },
        // Duplicate admin should be deduplicated
        {
          status: "administrator",
          user: { id: 201, first_name: "AdminOne", username: "AdminOne" },
        },
        // Admin without username -> clickable first-name mention
        {
          status: "administrator",
          user: { id: 202, first_name: "NoUser <Admin>" },
        },
        // Anonymous admin without user object -> safe fallback
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

    expect(output).toContain("👑 <b>Group Owner</b>\n\n1. @OwnerUsername");
    expect(output).toContain("🤝 <b>Cute Admins</b>🫶");
    expect(output).toContain("1. @AdminOne");
    expect(output).toContain('2. <a href="tg://user?id=202">NoUser &lt;Admin&gt;</a>');
    expect(output).toContain("3. Shadow Mod");
    // Ensure duplicate admin was not repeated
    expect(output.match(/@AdminOne/g)).toHaveLength(1);
    // Ensure old DB error text is never returned
    expect(output).not.toContain("No custom admins registered");
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

    // Standalone /id
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

    // Reply /id
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

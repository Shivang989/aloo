import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveMarketItem } from "../../src/features/money/market-pricing";
import { giftHandlers } from "../../src/features/money/gift";
import * as invDb from "../../src/database/inventory";
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

function makeGiftCtx(overrides: Partial<BotContext>): BotContext {
  return {
    env: MOCK_ENV,
    update: { update_id: 5001 },
    message: {
      message_id: 80,
      from: { id: 1001, first_name: "Sender", username: "UserA" },
      chat: { id: -100123456, type: "supergroup" },
      text: "/gift rose",
    },
    chatId: -100123456,
    userId: 1001,
    text: "/gift rose",
    command: "/gift",
    args: ["rose"],
    reply: {
      message_id: 79,
      from: { id: 2002, first_name: "Recipient", username: "UserB" },
      chat: { id: -100123456, type: "supergroup" },
      text: "hi",
    },
    ...overrides,
  };
}

describe("Reply-Only /gift Command & Item Resolver", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves exact models, unique aliases, and flags ambiguous brand names", () => {
    const rose = resolveMarketItem("rose");
    expect(rose.status).toBe("exact");
    if (rose.status === "exact") expect(rose.item.id).toBe("rose");

    const thar = resolveMarketItem("Mahindra Thar");
    expect(thar.status).toBe("exact");
    if (thar.status === "exact") expect(thar.item.id).toBe("mahindra_thar_og_axt");

    const x5 = resolveMarketItem("bmw x5");
    expect(x5.status).toBe("exact");
    if (x5.status === "exact") expect(x5.item.id).toBe("bmw_x5_xdrive40i");

    const ambiguousBmw = resolveMarketItem("BMW");
    expect(ambiguousBmw.status).toBe("ambiguous");
    if (ambiguousBmw.status === "ambiguous") {
      expect(ambiguousBmw.matches.length).toBeGreaterThan(5);
    }
  });

  it("rejects /gift without a reply, empty item name, self-gifting, and bot recipients", async () => {
    const sendSpy = vi
      .spyOn(messagesApi, "sendMessage")
      .mockResolvedValue({ ok: true, result: { message_id: 90 } });
    const giftTxSpy = vi.spyOn(invDb, "giftMarketItemTx");

    // 1. No reply
    await giftHandlers["/gift"](makeGiftCtx({ reply: undefined }));
    expect(sendSpy.mock.calls[0][2]).toContain("reply-only command");

    // 2. Empty item name
    await giftHandlers["/gift"](makeGiftCtx({ args: [] }));
    expect(sendSpy.mock.calls[1][2]).toContain("Usage:");

    // 3. Self-gifting
    await giftHandlers["/gift"](
      makeGiftCtx({
        reply: {
          message_id: 79,
          from: { id: 1001, first_name: "Sender" },
          chat: { id: -100123456, type: "supergroup" },
        },
      })
    );
    expect(sendSpy.mock.calls[2][2]).toContain("cannot gift an item to yourself");

    // 4. Bot recipient
    await giftHandlers["/gift"](
      makeGiftCtx({
        reply: {
          message_id: 79,
          from: { id: 3003, first_name: "AlooBot", is_bot: true },
          chat: { id: -100123456, type: "supergroup" },
        },
      })
    );
    expect(sendSpy.mock.calls[3][2]).toContain("cannot gift items to a bot");

    expect(giftTxSpy).not.toHaveBeenCalled();
  });

  it("rejects ambiguous names without charging anyone", async () => {
    const sendSpy = vi
      .spyOn(messagesApi, "sendMessage")
      .mockResolvedValue({ ok: true, result: { message_id: 91 } });
    const giftTxSpy = vi.spyOn(invDb, "giftMarketItemTx");

    await giftHandlers["/gift"](makeGiftCtx({ args: ["BMW"] }));

    expect(giftTxSpy).not.toHaveBeenCalled();
    expect(sendSpy.mock.calls[0][2]).toContain("Multiple Models Matched");
    expect(sendSpy.mock.calls[0][2]).toContain("BMW X5 xDrive40i");
  });

  it("transfers standard gifts and luxury vehicles atomically with update_id idempotency", async () => {
    const sendSpy = vi
      .spyOn(messagesApi, "sendMessage")
      .mockResolvedValue({ ok: true, result: { message_id: 92 } });
    const giftTxSpy = vi
      .spyOn(invDb, "giftMarketItemTx")
      .mockResolvedValueOnce({ status: "ok", senderNewBalance: 850, recipientNewQuantity: 1 })
      .mockResolvedValueOnce({
        status: "ok",
        senderNewBalance: 2310000,
        recipientNewQuantity: 1,
      })
      .mockResolvedValueOnce({ status: "insufficient_balance", balance: 100 });

    // 1. Gift Rose
    await giftHandlers["/gift"](makeGiftCtx({ update: { update_id: 7001 }, args: ["rose"] }));
    expect(giftTxSpy).toHaveBeenNthCalledWith(
      1,
      1001,
      2002,
      "Recipient",
      "rose",
      150,
      "gift_upd_7001"
    );
    expect(sendSpy.mock.calls[0][2]).toContain("GIFT SENT SUCCESSFULLY");
    expect(sendSpy.mock.calls[0][2]).toContain("@UserA gifted 🌹 <b>Rose</b> to @UserB.");

    // 2. Gift Luxury Car
    await giftHandlers["/gift"](
      makeGiftCtx({
        update: { update_id: 7002 },
        args: ["BMW", "X5", "xDrive40i"],
      })
    );
    expect(giftTxSpy).toHaveBeenNthCalledWith(
      2,
      1001,
      2002,
      "Recipient",
      "bmw_x5_xdrive40i",
      9690000,
      "gift_upd_7002"
    );
    expect(sendSpy.mock.calls[1][2]).toContain("LUXURY GIFT SENT");
    expect(sendSpy.mock.calls[1][2]).toContain("BMW X5 xDrive40i");
    expect(sendSpy.mock.calls[1][2]).toContain("₹96,90,000");

    // 3. Insufficient Balance
    await giftHandlers["/gift"](makeGiftCtx({ update: { update_id: 7003 }, args: ["burger"] }));
    expect(sendSpy.mock.calls[2][2]).toContain("Insufficient Balance");
  });
});

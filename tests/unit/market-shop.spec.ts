import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SHOP_CATEGORIES,
  getShopItemsByCategory,
  getShopItemById,
} from "../../src/features/money/market-pricing";
import {
  buildMainMarketView,
  buildCategoryView,
  handleMarketCallback,
  marketHandlers,
} from "../../src/features/money/market";
import { getFlowerBloomGifBuffer } from "../../src/features/money/flower-animation";
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

describe("Category-Based /market Shop", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("displays all four category buttons on /market", async () => {
    const sendSpy = vi
      .spyOn(messagesApi, "sendMessage")
      .mockResolvedValue({ ok: true, result: { message_id: 101 } });

    await marketHandlers["/market"]({
      env: MOCK_ENV,
      update: { update_id: 1 },
      message: {
        message_id: 50,
        from: { id: 1001, first_name: "Shivang" },
        chat: { id: -100999, type: "supergroup" },
        text: "/market",
      },
      chatId: -100999,
      userId: 1001,
      text: "/market",
      command: "/market",
      args: [],
    });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][2]).toContain("ALOO MARKET");
    const kb = sendSpy.mock.calls[0][3]?.inline_keyboard;
    expect(kb[0][0].text).toBe(SHOP_CATEGORIES.cars.buttonText);
    expect(kb[0][1].text).toBe(SHOP_CATEGORIES.flowers.buttonText);
    expect(kb[1][0].text).toBe(SHOP_CATEGORIES.bikes.buttonText);
    expect(kb[1][1].text).toBe(SHOP_CATEGORIES.food.buttonText);
  });

  it("orders Cars strictly from highest to lowest price and includes starter items", () => {
    const cars = getShopItemsByCategory("cars");
    expect(cars.length).toBeGreaterThanOrEqual(3);
    const names = cars.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["Bugatti", "BMW", "Tata Nano"]));

    for (let i = 1; i < cars.length; i++) {
      expect(cars[i - 1].price).toBeGreaterThanOrEqual(cars[i].price);
    }
  });

  it("includes all starter items for Flowers, Bikes, and Food with pagination and Back button", () => {
    const flowers = getShopItemsByCategory("flowers").map((f) => f.name);
    expect(flowers).toEqual(
      expect.arrayContaining(["Rose", "Lily", "Tulip", "Sunflower", "Lotus", "Orchid", "Jasmine"])
    );

    const bikes = getShopItemsByCategory("bikes").map((b) => b.name);
    expect(bikes).toEqual(expect.arrayContaining(["Splendor", "KTM", "Suzuki"]));

    const food = getShopItemsByCategory("food").map((f) => f.name);
    expect(food).toEqual(expect.arrayContaining(["Pizza", "Burger", "Samosa"]));

    const page0 = buildCategoryView("flowers", 0);
    expect(page0.text).toContain("Page 1 of 2");
    const flatButtons0 = page0.replyMarkup.inline_keyboard.flat();
    expect(flatButtons0.some((b) => b.callback_data === "mkt:cat:flowers:1")).toBe(true);
    expect(flatButtons0.some((b) => b.callback_data === "mkt:main")).toBe(true);
  });

  it("generates a valid multi-frame GIF89a animation buffer for Flowers", () => {
    const gif = getFlowerBloomGifBuffer();
    expect(gif.subarray(0, 6).toString("ascii")).toBe("GIF89a");
    expect(gif[gif.length - 1]).toBe(0x3b);
    // Verify NETSCAPE2.0 looping block and multiple frames
    expect(gif.includes(Buffer.from("NETSCAPE2.0", "ascii"))).toBe(true);
    expect(gif.length).toBeGreaterThan(200);
  });

  it("completes purchase atomically and handles insufficient balance safely", async () => {
    vi.spyOn(usersDb, "ensureUserExists").mockResolvedValue();
    vi.spyOn(messagesApi, "answerCallbackQuery").mockResolvedValue({ ok: true, result: true });
    const sendSpy = vi
      .spyOn(messagesApi, "sendMessage")
      .mockResolvedValue({ ok: true, result: { message_id: 202 } });

    const rose = getShopItemById("rose")!;
    const buySpy = vi
      .spyOn(invDb, "buyMarketItemTx")
      .mockResolvedValueOnce({ status: "ok", newBalance: 850, newQuantity: 1 })
      .mockResolvedValueOnce({ status: "insufficient_balance", balance: 100 });

    // Successful purchase by User A
    const handled1 = await handleMarketCallback(MOCK_ENV, {
      id: "cq_ok_1",
      from: { id: 2001, first_name: "Alice" },
      message: {
        message_id: 50,
        chat: { id: -100999, type: "supergroup" },
      },
      data: "mkt:buy:rose",
    });

    expect(handled1).toBe(true);
    expect(buySpy).toHaveBeenCalledWith(2001, "rose", rose.price, "mkt_cq_cq_ok_1");
    expect(sendSpy.mock.calls[0][2]).toContain("Purchase Successful");
    expect(sendSpy.mock.calls[0][2]).toContain("Rose");
    expect(sendSpy.mock.calls[0][2]).toContain("₹850");

    // Insufficient balance by User B on the same market menu
    const handled2 = await handleMarketCallback(MOCK_ENV, {
      id: "cq_fail_2",
      from: { id: 2002, first_name: "Bob" },
      message: {
        message_id: 50,
        chat: { id: -100999, type: "supergroup" },
      },
      data: "mkt:buy:rose",
    });

    expect(handled2).toBe(true);
    expect(sendSpy.mock.calls[1][2]).toContain("Insufficient Balance");
  });

  it("navigates back to main market menu cleanly and rejects invalid callback data", async () => {
    const answerSpy = vi
      .spyOn(messagesApi, "answerCallbackQuery")
      .mockResolvedValue({ ok: true, result: true });
    const editSpy = vi
      .spyOn(messagesApi, "editMessageText")
      .mockResolvedValue({ ok: true });

    await handleMarketCallback(MOCK_ENV, {
      id: "cq_back_1",
      from: { id: 2001, first_name: "Alice" },
      message: {
        message_id: 50,
        chat: { id: 2001, type: "private" },
      },
      data: "mkt:main",
    });

    expect(editSpy).toHaveBeenCalledTimes(1);
    expect(editSpy.mock.calls[0][3]).toBe(buildMainMarketView().text);

    await handleMarketCallback(MOCK_ENV, {
      id: "cq_bad_1",
      from: { id: 2001, first_name: "Alice" },
      message: {
        message_id: 50,
        chat: { id: 2001, type: "private" },
      },
      data: "mkt:unknown:xyz",
    });

    expect(answerSpy).toHaveBeenLastCalledWith(
      MOCK_ENV.BOT_TOKEN,
      "cq_bad_1",
      "⚠️ Invalid or expired market action.",
      true
    );
  });
});

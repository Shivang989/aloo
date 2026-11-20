import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SHOP_CATEGORIES,
  getShopItemsByCategory,
  getShopItemById,
  formatRupees,
} from "../../src/features/money/market-pricing";
import {
  buildMainMarketView,
  buildCategoryView,
  buildProductDetailView,
  buildPurchaseConfirmationView,
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

describe("Redesigned Category-Based /market Shop", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("displays the live-balance dashboard and 2x2 categories on /market", async () => {
    vi.spyOn(usersDb, "ensureUserExists").mockResolvedValue();
    vi.spyOn(usersDb, "getUser").mockResolvedValue({
      user_id: 1001,
      balance: 2500000,
      ammo: 0,
      kills: 0,
      is_alive: 1,
      protected_until: 0,
      last_daily: 0,
    });

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
    const dashboardText = sendSpy.mock.calls[0][2];
    expect(dashboardText).toContain("ALOO MARKET");
    expect(dashboardText).toContain("Wallet: <b>₹25,00,000</b>");

    const kb = sendSpy.mock.calls[0][3]?.inline_keyboard;
    expect(kb[0][0]).toEqual({
      text: SHOP_CATEGORIES.cars.buttonText,
      callback_data: "mkt:1001:cat:cars:0",
    });
    expect(kb[0][1]).toEqual({
      text: SHOP_CATEGORIES.flowers.buttonText,
      callback_data: "mkt:1001:cat:flowers:0",
    });
    expect(kb[1][0]).toEqual({
      text: SHOP_CATEGORIES.bikes.buttonText,
      callback_data: "mkt:1001:cat:bikes:0",
    });
    expect(kb[1][1]).toEqual({
      text: SHOP_CATEGORIES.food.buttonText,
      callback_data: "mkt:1001:cat:food:0",
    });
  });

  it("verifies all 21 researched cars, descending price order, and special price qualifications", () => {
    const cars = getShopItemsByCategory("cars");
    expect(cars).toHaveLength(21);

    // Strictly descending order
    for (let i = 1; i < cars.length; i++) {
      expect(cars[i - 1].price_amount).toBeGreaterThanOrEqual(cars[i].price_amount);
    }

    // Check top & bottom cars and key researched prices
    expect(cars[0].name).toBe("Bugatti Tourbillon");
    expect(cars[0].price_amount).toBe(1220000000);
    expect(cars[0].price_type).toBe("Estimated India Import Price");
    expect(cars[0].technical_specs.engine).toContain("8.3L");

    const maybach = getShopItemById("mercedes_maybach_s_class")!;
    expect(maybach.price_amount).toBe(32000000);

    const m8 = getShopItemById("bmw_m8_competition_coupe")!;
    expect(m8.name).toBe("BMW M8 Competition Coupé");
    expect(m8.price_amount).toBe(23840000);

    const x5 = getShopItemById("bmw_x5_xdrive40i")!;
    expect(x5.price_amount).toBe(9690000);

    const thar = getShopItemById("mahindra_thar_og_axt")!;
    expect(thar.name).toBe("Mahindra Thar OG AXT D117 CRDe Diesel RWD MT");
    expect(thar.price_amount).toBe(1032000);
    expect(thar.availability_status).toContain("30 Nov 2026");

    const nano = getShopItemById("tata_nano_xe")!;
    expect(nano.name).toBe("Tata Nano XE");
    expect(nano.price_amount).toBe(236000);
    expect(nano.price_type).toBe("Discontinued — Historical Price");
  });

  it("includes Flowers, Bikes, and Food starter items, pagination, and valid GIF89a animation", () => {
    const flowers = getShopItemsByCategory("flowers").map((f) => f.name);
    expect(flowers).toEqual(
      expect.arrayContaining(["Rose", "Lily", "Tulip", "Sunflower", "Lotus", "Orchid", "Jasmine"])
    );

    const bikes = getShopItemsByCategory("bikes").map((b) => b.name);
    expect(bikes).toEqual(expect.arrayContaining(["Splendor", "KTM", "Suzuki"]));

    const food = getShopItemsByCategory("food").map((f) => f.name);
    expect(food).toEqual(expect.arrayContaining(["Pizza", "Burger", "Samosa"]));

    const page0 = buildCategoryView(1001, "cars", 0);
    expect(page0.text).toContain("21 vehicles available");
    expect(page0.text).toContain("Sorting: Highest price first");
    const flatButtons = page0.replyMarkup.inline_keyboard.flat();
    expect(flatButtons.some((b) => b.callback_data === "mkt:1001:cat:cars:1")).toBe(true);
    expect(flatButtons.some((b) => b.callback_data === "mkt:1001:main")).toBe(true);

    const gif = getFlowerBloomGifBuffer();
    expect(gif.subarray(0, 6).toString("ascii")).toBe("GIF89a");
    expect(gif[gif.length - 1]).toBe(0x3b);
  });

  it("prevents another user from interacting with a user's personal market menu", async () => {
    const answerSpy = vi
      .spyOn(messagesApi, "answerCallbackQuery")
      .mockResolvedValue({ ok: true, result: true });

    const handled = await handleMarketCallback(MOCK_ENV, {
      id: "cq_intruder",
      from: { id: 9999, first_name: "Intruder" },
      message: {
        message_id: 50,
        chat: { id: -100999, type: "supergroup" },
      },
      data: "mkt:1001:cat:cars:0",
    });

    expect(handled).toBe(true);
    expect(answerSpy).toHaveBeenCalledWith(
      MOCK_ENV.BOT_TOKEN,
      "cq_intruder",
      "⚠️ This market menu belongs to another player. Send /market to open your own!",
      true
    );
  });

  it("walks through Product Detail -> Purchase Confirmation -> Atomic Purchase Receipt", async () => {
    const x5 = getShopItemById("bmw_x5_xdrive40i")!;

    // Verify Product Detail view
    const detailView = buildProductDetailView(2001, x5, 12000000);
    expect(detailView.text).toContain("BMW X5 xDrive40i");
    expect(detailView.text).toContain("Manufacturer: BMW");
    expect(detailView.text).toContain("Variant: xDrive40i");
    expect(detailView.text).toContain("₹96,90,000");

    // Verify Confirmation view
    const confirmView = buildPurchaseConfirmationView(2001, x5, 12000000);
    expect(confirmView.text).toContain("PURCHASE CONFIRMATION");
    expect(confirmView.text).toContain("Price: <b>₹96,90,000</b>");
    expect(confirmView.text).toContain("Your balance: <b>₹1,20,00,000</b>");
    expect(confirmView.text).toContain("After purchase: <b>₹23,10,000</b>");

    // Execute confirmed purchase
    vi.spyOn(usersDb, "ensureUserExists").mockResolvedValue();
    vi.spyOn(messagesApi, "answerCallbackQuery").mockResolvedValue({ ok: true, result: true });
    const editSpy = vi
      .spyOn(messagesApi, "editMessageText")
      .mockResolvedValue({ ok: true });

    const buySpy = vi
      .spyOn(invDb, "buyMarketItemTx")
      .mockResolvedValueOnce({ status: "ok", newBalance: 2310000, newQuantity: 1 })
      .mockResolvedValueOnce({ status: "insufficient_balance", balance: 500000 });

    await handleMarketCallback(MOCK_ENV, {
      id: "cq_buy_x5",
      from: { id: 2001, first_name: "Alice" },
      message: {
        message_id: 77,
        chat: { id: 2001, type: "private" },
      },
      data: "mkt:2001:buy:bmw_x5_xdrive40i",
    });

    expect(buySpy).toHaveBeenCalledWith(2001, "bmw_x5_xdrive40i", 9690000, "mkt_cq_cq_buy_x5");
    expect(editSpy.mock.calls[0][3]).toContain("PURCHASE SUCCESSFUL");
    expect(editSpy.mock.calls[0][3]).toContain("BMW X5 xDrive40i");
    expect(editSpy.mock.calls[0][3]).toContain(formatRupees(9690000));
    expect(editSpy.mock.calls[0][3]).toContain(formatRupees(2310000));

    // Insufficient balance check
    await handleMarketCallback(MOCK_ENV, {
      id: "cq_buy_x5_poor",
      from: { id: 2001, first_name: "Alice" },
      message: {
        message_id: 77,
        chat: { id: 2001, type: "private" },
      },
      data: "mkt:2001:buy:bmw_x5_xdrive40i",
    });

    expect(editSpy.mock.calls[1][3]).toContain("INSUFFICIENT BALANCE");
  });

  it("navigates back to main dashboard cleanly", async () => {
    vi.spyOn(usersDb, "ensureUserExists").mockResolvedValue();
    vi.spyOn(usersDb, "getUser").mockResolvedValue({
      user_id: 2001,
      balance: 5000,
      ammo: 0,
      kills: 0,
      is_alive: 1,
      protected_until: 0,
      last_daily: 0,
    });
    vi.spyOn(messagesApi, "answerCallbackQuery").mockResolvedValue({ ok: true, result: true });
    const editSpy = vi
      .spyOn(messagesApi, "editMessageText")
      .mockResolvedValue({ ok: true });

    await handleMarketCallback(MOCK_ENV, {
      id: "cq_back",
      from: { id: 2001, first_name: "Alice" },
      message: {
        message_id: 77,
        chat: { id: 2001, type: "private" },
      },
      data: "mkt:2001:main",
    });

    expect(editSpy.mock.calls[0][3]).toBe(buildMainMarketView(2001, 5000).text);
  });
});

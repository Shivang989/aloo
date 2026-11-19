import { describe, it, expect } from "vitest";
import { calculateMarketPrice } from "../../src/features/money/market-pricing";
import { simulateMarket } from "../../src/features/money/investment-calculation";
import { formatRemainingTime, SAFE_CONFIG } from "../../src/features/money/protection";
import { rollBossDamage } from "../../src/features/battle/boss-damage";

describe("Economy & Battle Calculations", () => {
  it("calculates dynamic market price and respects the 10% floor", () => {
    const price = calculateMarketPrice(1000, 0.95, 300 * 4.71238898); // sin ~ -1
    expect(price).toBeGreaterThanOrEqual(100);
    expect(Number.isInteger(price)).toBe(true);
  });

  it("simulates market investment outcomes with valid multipliers", () => {
    for (let i = 0; i < 25; i++) {
      const res = simulateMarket(1000);
      expect([0, 0.5, 1.5, 3, 10]).toContain(res.multiplier);
      expect(res.payout).toBe(Math.floor(1000 * res.multiplier));
      expect(res.event.length).toBeGreaterThan(0);
    }
  });

  it("rolls boss damage proportional to player level", () => {
    const res = rollBossDamage(4);
    expect(res.damage).toBeGreaterThanOrEqual(60);
    expect(res.damage).toBeLessThanOrEqual(420);
    expect(typeof res.is_crit).toBe("boolean");
  });

  it("formats remaining durations and preserves safe plans", () => {
    expect(formatRemainingTime(0)).toBe("0s");
    expect(formatRemainingTime(90060)).toBe("1d 1h 1m");
    expect(SAFE_CONFIG[1]).toEqual({ durationSec: 86400, price: 300, label: "1 day" });
    expect(SAFE_CONFIG[2]).toEqual({ durationSec: 172800, price: 400, label: "2 days" });
    expect(SAFE_CONFIG[3]).toEqual({ durationSec: 259200, price: 600, label: "3 days" });
  });
});

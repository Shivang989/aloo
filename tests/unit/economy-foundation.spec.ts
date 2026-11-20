import { describe, it, expect } from "vitest";
import {
  ECONOMY_LIMITS,
  PROFESSIONS,
  BUSINESS_CATALOG,
  PROPERTY_CATALOG,
  getWealthRank,
} from "../../src/settings/economy-config";
import { getIstDateKey, getIstWeekKey } from "../../src/database/economy";

describe("Hybrid Economy Foundation & Balance Sheet", () => {
  it("computes consistent IST daily and weekly reset keys", () => {
    // 2026-11-20 18:00:00 UTC is 2026-11-20 23:30:00 IST
    const beforeMidnightIst = Math.floor(Date.UTC(2026, 10, 20, 18, 0, 0) / 1000);
    // 2026-11-20 19:00:00 UTC is 2026-11-21 00:30:00 IST
    const afterMidnightIst = Math.floor(Date.UTC(2026, 10, 20, 19, 0, 0) / 1000);

    expect(getIstDateKey(beforeMidnightIst)).toBe("2026-11-20");
    expect(getIstDateKey(afterMidnightIst)).toBe("2026-11-21");
    expect(getIstWeekKey(beforeMidnightIst)).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("validates profession salary bands, businesses, properties, and wealth ranks", () => {
    expect(PROFESSIONS.length).toBeGreaterThanOrEqual(6);
    for (const p of PROFESSIONS) {
      expect(p.minPay).toBeGreaterThan(0);
      expect(p.maxPay).toBeGreaterThanOrEqual(p.minPay);
      expect(p.maxPay).toBeLessThanOrEqual(ECONOMY_LIMITS.DAILY_ACTIVE_INCOME_CAP);
    }

    expect(BUSINESS_CATALOG.length).toBe(5);
    expect(PROPERTY_CATALOG.length).toBe(4);

    expect(getWealthRank(500_000).name).toBe("Beginner");
    expect(getWealthRank(2_500_000).name).toBe("Entrepreneur");
    expect(getWealthRank(25_000_000).name).toBe("Business Owner");
    expect(getWealthRank(250_000_000).name).toBe("Millionaire Elite");
    expect(getWealthRank(1_500_000_000).name).toBe("Billionaire");
  });
});

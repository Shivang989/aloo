export interface MarketSimulationResult {
  payout: number;
  multiplier: number;
  event: string;
  emoji: string;
}

export function simulateMarket(investment: number): MarketSimulationResult {
  const roll = Math.floor(Math.random() * 100) + 1;
  let multiplier = 0.0;
  let eventName = "";
  let emoji = "";

  if (roll <= 40) {
    multiplier = 0.5;
    eventName = "BEAR MARKET";
    emoji = "📉";
  } else if (roll <= 70) {
    multiplier = 1.5;
    eventName = "BULL MARKET";
    emoji = "📈";
  } else if (roll <= 85) {
    multiplier = 0.0;
    eventName = "MARKET CRASH";
    emoji = "💥";
  } else if (roll <= 98) {
    multiplier = 3.0;
    eventName = "INSIDER TRADING";
    emoji = "🕵️‍♂️";
  } else {
    multiplier = 10.0;
    eventName = "TO THE MOON";
    emoji = "🚀";
  }

  const payout = Math.floor(investment * multiplier);
  return { payout, multiplier, event: eventName, emoji };
}

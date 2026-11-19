export function calculateMarketPrice(
  basePrice: number,
  volatility: number,
  currentTimestamp: number
): number {
  const timeFactor = currentTimestamp / 300.0;
  const fluctuation = Math.sin(timeFactor);
  let finalPrice = basePrice + basePrice * volatility * fluctuation;

  if (finalPrice < basePrice * 0.1) {
    finalPrice = basePrice * 0.1;
  }
  return Math.floor(finalPrice);
}

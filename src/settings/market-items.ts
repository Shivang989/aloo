import { MarketItem } from "../types/player";

export const MARKET_ITEMS: Record<string, MarketItem> = {
  cheap_watch: { base_price: 100, volatility: 0.3, emoji: "⌚", name: "Cheap Watch" },
  stolen_phone: { base_price: 500, volatility: 0.4, emoji: "📱", name: "Stolen Phone" },
  gold_chain: { base_price: 1000, volatility: 0.5, emoji: "⛓️", name: "Gold Chain" },
  crypto_wallet: { base_price: 5000, volatility: 0.8, emoji: "💻", name: "Crypto Wallet" },
  classified_documents: {
    base_price: 10000,
    volatility: 0.9,
    emoji: "📁",
    name: "Classified Docs",
  },
};

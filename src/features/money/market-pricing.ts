export type ShopCategoryKey = "cars" | "flowers" | "bikes" | "food";

export interface ShopCategoryMeta {
  key: ShopCategoryKey;
  label: string;
  emoji: string;
  buttonText: string;
}

export interface ShopItem {
  id: string;
  name: string;
  category: ShopCategoryKey;
  emoji: string;
  price: number;
}

export const SHOP_CATEGORIES: Record<ShopCategoryKey, ShopCategoryMeta> = {
  cars: {
    key: "cars",
    label: "Cars",
    emoji: "🚗",
    buttonText: "🚗 Cars",
  },
  flowers: {
    key: "flowers",
    label: "Flowers",
    emoji: "🌸",
    buttonText: "🌸 Flowers",
  },
  bikes: {
    key: "bikes",
    label: "Bikes",
    emoji: "🏍️",
    buttonText: "🏍️ Bikes",
  },
  food: {
    key: "food",
    label: "Food",
    emoji: "🍔",
    buttonText: "🍔 Food",
  },
};

export const SHOP_CATALOG: readonly ShopItem[] = [
  // 🚗 Cars (ordered descending from highest to lowest price)
  { id: "bugatti", name: "Bugatti", category: "cars", emoji: "🏎️", price: 50000 },
  { id: "lamborghini", name: "Lamborghini", category: "cars", emoji: "🚘", price: 35000 },
  { id: "bmw", name: "BMW", category: "cars", emoji: "🚙", price: 15000 },
  { id: "audi", name: "Audi", category: "cars", emoji: "🚗", price: 12000 },
  { id: "thar", name: "Mahindra Thar", category: "cars", emoji: "🛻", price: 6500 },
  { id: "tata_nano", name: "Tata Nano", category: "cars", emoji: "🚕", price: 2500 },

  // 🌸 Flowers
  { id: "rose", name: "Rose", category: "flowers", emoji: "🌹", price: 150 },
  { id: "lily", name: "Lily", category: "flowers", emoji: "⚜️", price: 200 },
  { id: "tulip", name: "Tulip", category: "flowers", emoji: "🌷", price: 250 },
  { id: "sunflower", name: "Sunflower", category: "flowers", emoji: "🌻", price: 300 },
  { id: "lotus", name: "Lotus", category: "flowers", emoji: "🪷", price: 450 },
  { id: "orchid", name: "Orchid", category: "flowers", emoji: "🌺", price: 600 },
  { id: "jasmine", name: "Jasmine", category: "flowers", emoji: "🌼", price: 350 },

  // 🏍️ Bikes
  { id: "kawasaki_ninja", name: "Kawasaki Ninja", category: "bikes", emoji: "🏍️", price: 18000 },
  { id: "ktm", name: "KTM", category: "bikes", emoji: "🧡", price: 8500 },
  { id: "royal_enfield", name: "Royal Enfield", category: "bikes", emoji: "🛵", price: 6000 },
  { id: "suzuki", name: "Suzuki", category: "bikes", emoji: "🏁", price: 4500 },
  { id: "yamaha_r15", name: "Yamaha R15", category: "bikes", emoji: "⚡", price: 3800 },
  { id: "splendor", name: "Splendor", category: "bikes", emoji: "🚲", price: 1500 },

  // 🍔 Food
  { id: "pizza", name: "Pizza", category: "food", emoji: "🍕", price: 250 },
  { id: "burger", name: "Burger", category: "food", emoji: "🍔", price: 150 },
  { id: "biryani", name: "Biryani", category: "food", emoji: "🍛", price: 200 },
  { id: "momos", name: "Momos", category: "food", emoji: "🥟", price: 100 },
  { id: "tacos", name: "Tacos", category: "food", emoji: "🌮", price: 180 },
  { id: "samosa", name: "Samosa", category: "food", emoji: "🥟", price: 50 },
] as const;

const SHOP_ITEM_MAP = new Map<string, ShopItem>(
  SHOP_CATALOG.map((item) => [item.id, item])
);

export function isValidShopCategory(raw: string): raw is ShopCategoryKey {
  return raw === "cars" || raw === "flowers" || raw === "bikes" || raw === "food";
}

export function getShopItemsByCategory(category: ShopCategoryKey): ShopItem[] {
  const items = SHOP_CATALOG.filter((item) => item.category === category);
  if (category === "cars") {
    return [...items].sort((a, b) => b.price - a.price);
  }
  return items;
}

export function getShopItemById(itemId: string): ShopItem | undefined {
  return SHOP_ITEM_MAP.get(itemId.toLowerCase().trim());
}

export function formatRupees(amount: number): string {
  return `₹${Math.floor(amount).toLocaleString("en-IN")}`;
}

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

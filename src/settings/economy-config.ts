export interface ProfessionConfig {
  id: string;
  name: string;
  emoji: string;
  minPay: number;
  maxPay: number;
  description: string;
}

export interface DeliveryTierConfig {
  id: string;
  title: string;
  emoji: string;
  destinations: string[];
  baseReward: number;
  requiresVehicle: boolean;
}

export interface FreelanceTemplate {
  category: string;
  title: string;
  minReward: number;
  maxReward: number;
}

export interface MissionDefinition {
  id: string;
  period: "daily" | "weekly";
  title: string;
  metric:
    | "work_shifts"
    | "deliveries"
    | "market_purchases"
    | "gifts_sent"
    | "freelance_tasks"
    | "daily_missions_completed"
    | "businesses_owned"
    | "eligible_activities";
  target: number;
  reward: number;
}

export interface BusinessCatalogItem {
  id: string;
  name: string;
  emoji: string;
  purchasePrice: number;
  dailyGrossIncome: number;
  maxLevel: number;
}

export interface PropertyCatalogItem {
  id: string;
  name: string;
  emoji: string;
  purchasePrice: number;
  dailyBaseRent: number;
  maxLevel: number;
}

export interface WealthRankTier {
  name: string;
  emoji: string;
  minNetWorth: number;
}

export const ECONOMY_LIMITS = {
  TIMEZONE: "Asia/Kolkata",
  WORK_COOLDOWN_SEC: 3600, // 1 hour
  JOB_SWITCH_COOLDOWN_SEC: 21600, // 6 hours
  DELIVERY_COOLDOWN_SEC: 1800, // 30 minutes
  DELIVERY_EXPIRY_SEC: 900, // 15 minutes
  DELIVERY_VEHICLE_BONUS_RATE: 0.15, // +15% bonus if player owns a bike or car
  FREELANCE_COOLDOWN_SEC: 7200, // 2 hours
  FREELANCE_EXPIRY_SEC: 1800, // 30 minutes
  DAILY_ACTIVE_INCOME_CAP: 350_000, // ₹3,50,000 max active earnings per IST day
  BUSINESS_EXPENSE_RATE: 0.15, // 15% operating expense
  PASSIVE_ACCRUAL_CAP_SEC: 48 * 3600, // 48 hours max uncollected accrual
  UPGRADE_MULTIPLIER_PER_LEVEL: 0.15, // +15% gross output per upgrade level
  UPGRADE_COST_FACTOR: 0.5, // Upgrade cost = 50% of base price * current level
  MAX_OWNED_BUSINESSES: 3,
  MAX_OWNED_PROPERTIES: 4,
  BANK_DAILY_INTEREST_RATE: 0.0003, // 0.03% per day
  BANK_MAX_INTEREST_PRINCIPAL: 100_000_000, // ₹10 Crore cap
  MAX_SAFE_ADJUSTMENT: 10_000_000_000, // ₹1,000 Crore ceiling per single owner adjustment
} as const;

export const PROFESSIONS: readonly ProfessionConfig[] = [
  {
    id: "delivery_worker",
    name: "Delivery Worker",
    emoji: "🛵",
    minPay: 5000,
    maxPay: 8000,
    description: "Fast-paced city parcel & food fulfillment.",
  },
  {
    id: "chef",
    name: "Chef",
    emoji: "👨‍🍳",
    minPay: 8000,
    maxPay: 12000,
    description: "Culinary shifts at high-volume kitchens.",
  },
  {
    id: "driver",
    name: "Driver",
    emoji: "🚘",
    minPay: 8000,
    maxPay: 14000,
    description: "Executive chauffeur & intercity transport.",
  },
  {
    id: "teacher",
    name: "Teacher",
    emoji: "📚",
    minPay: 10000,
    maxPay: 15000,
    description: "Academic instruction & student mentorship.",
  },
  {
    id: "engineer",
    name: "Engineer",
    emoji: "💻",
    minPay: 12000,
    maxPay: 20000,
    description: "Systems architecture & infrastructure operations.",
  },
  {
    id: "doctor",
    name: "Doctor",
    emoji: "🩺",
    minPay: 15000,
    maxPay: 25000,
    description: "Clinical consultations & emergency hospital shifts.",
  },
] as const;

export const DELIVERY_TIERS: readonly DeliveryTierConfig[] = [
  {
    id: "food_delivery",
    title: "Food Delivery",
    emoji: "🍔",
    destinations: ["Greenwood Residency", "Central Metro Plaza", "Tech Park Phase 2"],
    baseReward: 6000,
    requiresVehicle: false,
  },
  {
    id: "parcel_delivery",
    title: "Parcel Delivery",
    emoji: "📦",
    destinations: ["Sunrise Apartments", "Old Market Square", "Harbor Logistics Hub"],
    baseReward: 8500,
    requiresVehicle: false,
  },
  {
    id: "express_delivery",
    title: "Express Delivery",
    emoji: "⚡",
    destinations: ["Financial District Tower", "Airport Cargo Terminal", "Emerald Enclave"],
    baseReward: 12000,
    requiresVehicle: true,
  },
  {
    id: "premium_delivery",
    title: "Premium Delivery",
    emoji: "💎",
    destinations: ["Luxury Apartments", "Royal Heritage Villas", "Skyline Penthouse"],
    baseReward: 16000,
    requiresVehicle: true,
  },
] as const;

export const FREELANCE_TEMPLATES: readonly FreelanceTemplate[] = [
  {
    category: "Data Entry",
    title: "Audit and digitize quarterly merchant invoices",
    minReward: 8000,
    maxReward: 13000,
  },
  {
    category: "Technical Writing",
    title: "Write a market research & financial briefing report",
    minReward: 11000,
    maxReward: 17000,
  },
  {
    category: "Brand Design",
    title: "Design a minimalist brand identity and logo kit",
    minReward: 13000,
    maxReward: 20000,
  },
  {
    category: "IT Support",
    title: "Diagnose and resolve a production server bottleneck",
    minReward: 16000,
    maxReward: 24000,
  },
  {
    category: "Software Engineering",
    title: "Build and test an automated payment webhook module",
    minReward: 20000,
    maxReward: 30000,
  },
] as const;

export const DAILY_MISSIONS: readonly MissionDefinition[] = [
  {
    id: "daily_work_3",
    period: "daily",
    title: "Complete 3 work shifts",
    metric: "work_shifts",
    target: 3,
    reward: 25000,
  },
  {
    id: "daily_delivery_2",
    period: "daily",
    title: "Complete 2 deliveries",
    metric: "deliveries",
    target: 2,
    reward: 20000,
  },
  {
    id: "daily_market_1",
    period: "daily",
    title: "Purchase 1 item from Market",
    metric: "market_purchases",
    target: 1,
    reward: 15000,
  },
  {
    id: "daily_gift_1",
    period: "daily",
    title: "Send 1 gift to another player",
    metric: "gifts_sent",
    target: 1,
    reward: 20000,
  },
  {
    id: "daily_active_5",
    period: "daily",
    title: "Complete 5 eligible activities",
    metric: "eligible_activities",
    target: 5,
    reward: 50000,
  },
] as const;

export const WEEKLY_CHALLENGES: readonly MissionDefinition[] = [
  {
    id: "weekly_work_20",
    period: "weekly",
    title: "Complete 20 work shifts",
    metric: "work_shifts",
    target: 20,
    reward: 250000,
  },
  {
    id: "weekly_delivery_15",
    period: "weekly",
    title: "Complete 15 deliveries",
    metric: "deliveries",
    target: 15,
    reward: 200000,
  },
  {
    id: "weekly_freelance_6",
    period: "weekly",
    title: "Complete 6 freelance tasks",
    metric: "freelance_tasks",
    target: 6,
    reward: 220000,
  },
  {
    id: "weekly_missions_10",
    period: "weekly",
    title: "Claim 10 daily missions",
    metric: "daily_missions_completed",
    target: 10,
    reward: 350000,
  },
  {
    id: "weekly_business_1",
    period: "weekly",
    title: "Own or operate a business",
    metric: "businesses_owned",
    target: 1,
    reward: 500000,
  },
] as const;

export const BUSINESS_CATALOG: readonly BusinessCatalogItem[] = [
  {
    id: "tea_stall",
    name: "Tea Stall",
    emoji: "☕",
    purchasePrice: 500_000, // ₹5 Lakh
    dailyGrossIncome: 10_000, // ₹10,000/day
    maxLevel: 5,
  },
  {
    id: "grocery_store",
    name: "Grocery Store",
    emoji: "🏪",
    purchasePrice: 2_500_000, // ₹25 Lakh
    dailyGrossIncome: 50_000, // ₹50,000/day
    maxLevel: 5,
  },
  {
    id: "restaurant",
    name: "Restaurant",
    emoji: "🍽️",
    purchasePrice: 15_000_000, // ₹1.5 Crore
    dailyGrossIncome: 250_000, // ₹2.5 Lakh/day
    maxLevel: 5,
  },
  {
    id: "car_showroom",
    name: "Car Showroom",
    emoji: "🚘",
    purchasePrice: 50_000_000, // ₹5 Crore
    dailyGrossIncome: 700_000, // ₹7 Lakh/day
    maxLevel: 5,
  },
  {
    id: "luxury_hotel",
    name: "Luxury Hotel",
    emoji: "🏨",
    purchasePrice: 150_000_000, // ₹15 Crore
    dailyGrossIncome: 1_800_000, // ₹18 Lakh/day
    maxLevel: 5,
  },
] as const;

export const PROPERTY_CATALOG: readonly PropertyCatalogItem[] = [
  {
    id: "small_house",
    name: "Small House",
    emoji: "🏡",
    purchasePrice: 5_000_000, // ₹50 Lakh
    dailyBaseRent: 20_000, // ₹20,000/day
    maxLevel: 5,
  },
  {
    id: "apartment",
    name: "Apartment",
    emoji: "🏢",
    purchasePrice: 20_000_000, // ₹2 Crore
    dailyBaseRent: 75_000, // ₹75,000/day
    maxLevel: 5,
  },
  {
    id: "luxury_villa",
    name: "Luxury Villa",
    emoji: "🏰",
    purchasePrice: 80_000_000, // ₹8 Crore
    dailyBaseRent: 300_000, // ₹3 Lakh/day
    maxLevel: 5,
  },
  {
    id: "commercial_tower",
    name: "Commercial Tower",
    emoji: "🏙️",
    purchasePrice: 250_000_000, // ₹25 Crore
    dailyBaseRent: 800_000, // ₹8 Lakh/day
    maxLevel: 5,
  },
] as const;

export const WEALTH_RANKS: readonly WealthRankTier[] = [
  { name: "Billionaire", emoji: "👑", minNetWorth: 1_000_000_000 }, // ₹100 Crore+
  { name: "Millionaire Elite", emoji: "💎", minNetWorth: 100_000_000 }, // ₹10–100 Crore
  { name: "Business Owner", emoji: "🏢", minNetWorth: 10_000_000 }, // ₹1–10 Crore
  { name: "Entrepreneur", emoji: "📈", minNetWorth: 1_000_000 }, // ₹10 Lakh–₹1 Crore
  { name: "Beginner", emoji: "🌱", minNetWorth: 0 }, // Below ₹10 Lakh
] as const;

export function getWealthRank(netWorth: number): WealthRankTier {
  for (const tier of WEALTH_RANKS) {
    if (netWorth >= tier.minNetWorth) {
      return tier;
    }
  }
  return WEALTH_RANKS[WEALTH_RANKS.length - 1];
}

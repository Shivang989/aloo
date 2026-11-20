export interface UserData {
  user_id: number;
  first_name?: string | null;
  balance: number;
  ammo: number;
  kills: number;
  is_alive: number;
  protected_until: number;
  last_daily: number;
  gender?: string | null;
  created_at?: number;
  updated_at?: number;
}

export interface InventoryItem {
  user_id: number;
  item_name: string;
  quantity: number;
}

export interface AdminRecord {
  chat_id: number;
  user_id: number;
  level: number;
  title: string;
}

export interface MarketItem {
  id?: string;
  name: string;
  base_price: number;
  volatility?: number;
  emoji?: string;
  price?: number;
  description?: string;
}

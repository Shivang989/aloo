import { getCoreDb, withCoreTransaction } from "./index";
import { InventoryItem } from "../types/player";
import { BOT_SETTINGS } from "../settings/bot-settings";

export async function getInventory(userId: number): Promise<InventoryItem[]> {
  const res = await getCoreDb().query(
    "SELECT user_id, item_name, quantity FROM inventory WHERE user_id = $1 AND quantity > 0 ORDER BY item_name ASC",
    [userId]
  );
  return res.rows.map((r) => ({
    user_id: Number(r.user_id),
    item_name: String(r.item_name),
    quantity: Number(r.quantity),
  }));
}

export async function buyMarketItemTx(
  userId: number,
  itemKey: string,
  price: number,
  idempotencyKey?: string
): Promise<
  | { status: "ok"; newBalance: number; newQuantity: number }
  | { status: "insufficient_balance"; balance: number }
  | { status: "duplicate" }
> {
  return withCoreTransaction(async (client) => {
    const now = Math.floor(Date.now() / 1000);

    if (idempotencyKey) {
      const idemRes = await client.query(
        `INSERT INTO idempotency_keys (key, operation, status, created_at)
         VALUES ($1, 'market_purchase', 'completed', $2)
         ON CONFLICT (key) DO NOTHING
         RETURNING key`,
        [idempotencyKey, now]
      );
      if (idemRes.rows.length === 0) {
        return { status: "duplicate" };
      }
    }

    await client.query(
      `INSERT INTO users (user_id, balance, ammo, kills, is_alive, protected_until, last_daily, created_at, updated_at)
       VALUES ($1, $2, 0, 0, 1, 0, 0, $3, $3)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, BOT_SETTINGS.STARTING_BALANCE, now]
    );

    const userRes = await client.query(
      "SELECT balance FROM users WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    const currentBalance = Number(userRes.rows[0]?.balance ?? 0);

    if (currentBalance < price) {
      return { status: "insufficient_balance", balance: currentBalance };
    }

    const balUpd = await client.query(
      "UPDATE users SET balance = balance - $1, updated_at = $2 WHERE user_id = $3 RETURNING balance",
      [price, now, userId]
    );
    const newBalance = Number(balUpd.rows[0].balance);

    const invUpd = await client.query(
      `INSERT INTO inventory (user_id, item_name, quantity)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, item_name)
       DO UPDATE SET quantity = inventory.quantity + 1
       RETURNING quantity`,
      [userId, itemKey]
    );
    const newQuantity = Number(invUpd.rows[0].quantity);

    await client.query(
      `INSERT INTO economy_transactions (user_id, tx_type, amount, balance_before, balance_after, reference_id, created_at)
       VALUES ($1, 'market_purchase', $2, $3, $4, $5, $6)`,
      [userId, -price, currentBalance, newBalance, idempotencyKey || null, now]
    );

    return { status: "ok", newBalance, newQuantity };
  });
}

export async function sellInventoryItemTx(
  userId: number,
  itemKey: string,
  sellPrice: number
): Promise<
  | { status: "ok"; newBalance: number }
  | { status: "user_not_found" }
  | { status: "item_not_owned" }
> {
  return withCoreTransaction(async (client) => {
    const now = Math.floor(Date.now() / 1000);
    const userRes = await client.query(
      "SELECT balance FROM users WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    if (userRes.rows.length === 0) return { status: "user_not_found" };

    const invRes = await client.query(
      "SELECT item_name, quantity FROM inventory WHERE user_id = $1 AND LOWER(item_name) = LOWER($2) FOR UPDATE",
      [userId, itemKey]
    );
    if (invRes.rows.length === 0 || Number(invRes.rows[0].quantity) <= 0) {
      return { status: "item_not_owned" };
    }

    const exactItemName = String(invRes.rows[0].item_name);
    const oldBalance = Number(userRes.rows[0].balance ?? 0);

    await client.query(
      "UPDATE inventory SET quantity = quantity - 1 WHERE user_id = $1 AND item_name = $2",
      [userId, exactItemName]
    );

    const balUpd = await client.query(
      "UPDATE users SET balance = balance + $1, updated_at = $2 WHERE user_id = $3 RETURNING balance",
      [sellPrice, now, userId]
    );
    const newBalance = Number(balUpd.rows[0].balance);

    await client.query(
      `INSERT INTO economy_transactions (user_id, tx_type, amount, balance_before, balance_after, created_at)
       VALUES ($1, 'market_sell', $2, $3, $4, $5)`,
      [userId, sellPrice, oldBalance, newBalance, now]
    );

    return { status: "ok", newBalance };
  });
}

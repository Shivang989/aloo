import { getCoreDb, withCoreTransaction } from "./index";
import { InventoryItem } from "../types/player";

export async function getInventory(userId: number): Promise<InventoryItem[]> {
  const res = await getCoreDb().query(
    "SELECT user_id, item_name, quantity FROM inventory WHERE user_id = $1 AND quantity > 0",
    [userId]
  );
  return res.rows.map((r) => ({
    user_id: Number(r.user_id),
    item_name: String(r.item_name),
    quantity: Number(r.quantity),
  }));
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

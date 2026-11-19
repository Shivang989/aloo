import { BotContext, CommandHandler } from "../../types/bot";
import { purchaseBulletsTx } from "../../database/users";
import { sendMessage } from "../../telegram/messages";

const BULLET_PRICE = 1;
const MAX_BULLET_PURCHASE = 1000000;

export async function purchaseBullets(
  userId: number,
  quantity: number
): Promise<{ ok: boolean; message: string }> {
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_BULLET_PURCHASE) {
    return {
      ok: false,
      message:
        `💰 <b>Buy Bullets</b>\n\n` +
        `1 Bullet = ₹1\n\n` +
        `Use "/buy &lt;amount&gt;" to purchase bullets.\n\n` +
        `Example: "/buy 100" — Buy 100 bullets for ₹100.`,
    };
  }

  const cost = quantity * BULLET_PRICE;
  const result = await purchaseBulletsTx(userId, quantity, BULLET_PRICE);

  if (result.status === "insufficient_balance") {
    return {
      ok: false,
      message:
        `❌ <b>Insufficient Balance</b>\n\n` +
        `Required: ₹${cost}\n` +
        `Your balance: ₹${result.balance}\n\n` +
        `No bullets purchased.`,
    };
  }

  return {
    ok: true,
    message:
      `💰 <b>Purchase Successful</b>\n\n` +
      `Bullets purchased: ${quantity}\n` +
      `Amount paid: ₹${cost}\n` +
      `Total bullets: ${result.newBullets}\n` +
      `Remaining balance: ₹${result.newBalance}`,
  };
}

export const bulletPurchaseHandlers: Record<string, CommandHandler> = {
  "/buy": async (ctx: BotContext) => {
    try {
      const guideText =
        `💰 <b>Buy Bullets</b>\n\n` +
        `1 Bullet = ₹1\n\n` +
        `Use "/buy &lt;amount&gt;" to purchase bullets.\n\n` +
        `Example: "/buy 100" — Buy 100 bullets for ₹100.`;

      if (ctx.args.length === 0) {
        await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, guideText, undefined, ctx.message?.message_id);
        return;
      }

      if (ctx.args.length > 1 || !/^\d+$/.test(ctx.args[0].trim())) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          '❌ Invalid amount. Use "/buy <amount>" with a positive whole number.',
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      const quantity = parseInt(ctx.args[0].trim(), 10);
      if (isNaN(quantity) || quantity <= 0 || quantity > MAX_BULLET_PURCHASE) {
        await sendMessage(
          ctx.env.BOT_TOKEN,
          ctx.chatId,
          '❌ Invalid amount. Use "/buy <amount>" with a positive whole number.',
          undefined,
          ctx.message?.message_id
        );
        return;
      }

      const res = await purchaseBullets(ctx.userId, quantity);
      await sendMessage(ctx.env.BOT_TOKEN, ctx.chatId, res.message, undefined, ctx.message?.message_id);
    } catch (err: any) {
      console.error("Error executing /buy:", err);
      await sendMessage(
        ctx.env.BOT_TOKEN,
        ctx.chatId,
        `⚠️ <code>${err?.message || "Execution error"}</code>`,
        undefined,
        ctx.message?.message_id
      );
    }
  },
};

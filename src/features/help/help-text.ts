export const HELP_DIRECTORY_TEXT = `📖 <b>ALOO BOT — COMMAND DIRECTORY</b>

💰 <b>Economy & Banking</b>
• <code>/economy</code> — Interactive economy hub
• <code>/bal</code> | <code>/balance</code> — Check wallet balance
• <code>/bank</code> — Savings account & 0.03%/day interest
• <code>/networth</code> — Total wealth & rank breakdown
• <code>/daily</code> — Claim daily reward
• <code>/pay &lt;amt&gt;</code> | <code>/give &lt;amt&gt;</code> — Transfer money (reply)

💼 <b>Work, Missions & Investments</b>
• <code>/work</code> — Choose profession & complete shifts
• <code>/delivery</code> — Accept & complete delivery routes
• <code>/freelance</code> — Complete freelance contracts
• <code>/mission</code> | <code>/weekly</code> — Daily & weekly challenges
• <code>/business</code> — Buy, upgrade & collect business profits
• <code>/property</code> | <code>/rent</code> — Buy real estate & collect rent

🛍️ <b>Market, Gifts & Inventory</b>
• <code>/market</code> — Browse Cars, Flowers, Bikes & Food
• <code>/gift &lt;item&gt;</code> — Gift a market item to a player (reply)
• <code>/inv</code> | <code>/inventory</code> — View your stash
• <code>/sell &lt;item&gt;</code> — Sell eligible items
• <code>/buy &lt;qty&gt;</code> — Purchase bullets

⚔️ <b>Combat & Protection</b>
• <code>/fire</code> | <code>/shoot</code> — Attack a player (reply)
• <code>/defend</code> | <code>/shield</code> — Activate combat shield
• <code>/safe</code> — Buy robbery protection
• <code>/rob</code> — Rob another player (reply)
• <code>/revive</code> — Revive when eliminated

👤 <b>Profile, Stats & Arcade</b>
• <code>/me</code> | <code>/profile</code> — View player profile
• <code>/gender</code> — Set your optional profile gender
• <code>/id</code> — View Telegram ID (or replied user ID)
• <code>/top</code> | <code>/leaderboard</code> — Global leaderboard
• <code>/flip</code>, <code>/rps</code>, <code>/8ball</code> — Mini-games
• <code>/admins</code> — Live Telegram group administrators
• <code>/ping</code> — Check bot latency`;

export function buildHelpMessage(..._args: unknown[]): {
  body: string;
  inlineKeyboard?: Record<string, any>;
} {
  return {
    body: HELP_DIRECTORY_TEXT,
    inlineKeyboard: undefined,
  };
}

import { CommandHandler } from "../types/bot";
import { startHandlers } from "../features/start/start-command";
import { pingHandlers } from "../features/stats/ping-command";
import { idHandlers } from "../features/stats/id-command";
import { leaderboardHandlers } from "../features/stats/leaderboard";
import { protectionHandlers } from "../features/money/protection";
import { balanceHandlers } from "../features/money/balance";
import { profileHandlers } from "../features/money/profile";
import { robberyHandlers } from "../features/money/robbery";
import { bulletPurchaseHandlers } from "../features/money/bullet-purchase";
import { dailyRewardHandlers } from "../features/money/daily-reward";
import { paymentHandlers } from "../features/money/payments";
import { inventoryHandlers } from "../features/money/inventory";
import { marketHandlers } from "../features/money/market";
import { shootingHandlers } from "../features/battle/shooting";
import { defenseHandlers } from "../features/battle/defense";
import { reviveHandlers } from "../features/battle/revive";
import { diceHandlers } from "../features/games/dice";
import { coinFlipHandlers } from "../features/games/coin-flip";
import { rpsHandlers } from "../features/games/rock-paper-scissors";
import { eightBallHandlers } from "../features/games/eight-ball";
import { promoteHandlers } from "../features/group-admin/promote";
import { demoteHandlers } from "../features/group-admin/demote";
import { adminTitleHandlers } from "../features/group-admin/admin-title";
import { adminListHandlers } from "../features/group-admin/admin-list";
import { dmMenuHandlers } from "../features/dm-menu/menu-command";
import { broadcastHandlers } from "../features/broadcast/commands";
import { forceJoinHandlers } from "../features/force-join/commands";
import { helpHandlers } from "../features/help/help-command";

export const COMMAND_REGISTRY: Record<string, CommandHandler> = {
  ...startHandlers,
  ...pingHandlers,
  ...idHandlers,
  ...leaderboardHandlers,
  ...protectionHandlers,
  ...balanceHandlers,
  ...profileHandlers,
  ...robberyHandlers,
  ...bulletPurchaseHandlers,
  ...dailyRewardHandlers,
  ...paymentHandlers,
  ...inventoryHandlers,
  ...marketHandlers,
  ...shootingHandlers,
  ...defenseHandlers,
  ...reviveHandlers,
  ...diceHandlers,
  ...coinFlipHandlers,
  ...rpsHandlers,
  ...eightBallHandlers,
  ...promoteHandlers,
  ...demoteHandlers,
  ...adminTitleHandlers,
  ...adminListHandlers,
  ...dmMenuHandlers,
  ...broadcastHandlers,
  ...forceJoinHandlers,
  ...helpHandlers,
};

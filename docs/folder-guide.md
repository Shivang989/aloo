# Aloo Bot — Folder & Dependency Guide

- `src/index.ts` — Node.js entrypoint, Telegram long-polling loop, `/health` HTTP server, and graceful shutdown.
- `src/bot/` — Update dispatcher (`update-router.ts`) and command registry (`command-list.ts`).
- `src/settings/` — Static configuration (`bot-settings.ts`, `market-items.ts`, `appearance.ts`).
- `src/telegram/` — Consolidated Telegram Bot API HTTP client (`client.ts`, `messages.ts`, `chats.ts`, `types.ts`).
- `src/database/` — Dual-PostgreSQL pools (`clients/core-postgres.ts`, `clients/ops-postgres.ts`) and domain repositories (`users.ts`, `inventory.ts`, `admins.ts`, `saved-settings.ts`, `broadcast-data.ts`, `force-join-data.ts`).
- `src/features/` — Self-contained feature slices (`start`, `stats`, `money`, `battle`, `games`, `group-admin`, `dm-menu`, `broadcast`, `force-join`, `help`).
- `src/workers/` — Isolated background broadcast delivery worker (`broadcast-worker.ts`).
- `src/ui/` — Custom typography and Telegram blockquote status cards (`fancy-text.ts`, `status-card.ts`).
- `src/types/` — Shared runtime environment, bot context, and player definitions.

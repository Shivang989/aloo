# Aloo Bot — Multi-Database Ownership (`aloo_core`, `aloo_ops`, & `aloo_cache`)

1. **`aloo_core` (`CORE_DATABASE_URL`):** Authoritative transactional PostgreSQL database for `users` (wallet, ammo, kills, shield, profession, gender), `inventory`, `delivery_orders`, `freelance_tasks`, `mission_progress`, `user_businesses`, `user_properties`, `bank_accounts`, `admins`, `saved_settings`, `economy_transactions`, `idempotency_keys`, `owner_audit_logs`, and `outbox_events`.
2. **`aloo_ops` (`OPS_DATABASE_URL`):** Operational PostgreSQL database isolating bulk broadcast delivery (`broadcast_*` tables) and force-join verification (`force_sub*` tables) from gameplay latency.
3. **`aloo_cache` (`REDIS_URL`):** Shared Upstash Redis layer for rate limiting, worker leases, force-join verification cache, and read-through settings cache.

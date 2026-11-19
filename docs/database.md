# Aloo Bot — Multi-Database Ownership (`aloo_core` & `aloo_ops`)

1. **`aloo_core` (`CORE_DATABASE_URL`):** Authoritative transactional PostgreSQL database for `users`, `inventory`, `admins`, `saved_settings`, `economy_transactions`, `idempotency_keys`, and `outbox_events`.
2. **`aloo_ops` (`OPS_DATABASE_URL`):** Operational PostgreSQL database isolating bulk broadcast delivery (`broadcast_*` tables) and force-join verification (`force_sub*` tables) from gameplay latency.

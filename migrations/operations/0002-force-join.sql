CREATE TABLE IF NOT EXISTS force_sub (
  group_id BIGINT PRIMARY KEY,
  button_name TEXT NOT NULL,
  link TEXT NOT NULL,
  target_chat TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS force_sub_authorized (
  group_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS force_sub_requests (
  user_id BIGINT NOT NULL,
  target_chat TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, target_chat)
);

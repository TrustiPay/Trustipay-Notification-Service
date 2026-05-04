CREATE TABLE notification_templates (
  template_key TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  default_locale TEXT NOT NULL DEFAULT 'en',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  active_version_id TEXT,
  provider_dlt_template_id TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE notification_template_versions (
  version_id TEXT PRIMARY KEY,
  template_key TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  body TEXT NOT NULL,
  variables_json TEXT NOT NULL,
  max_length INTEGER,
  checksum TEXT NOT NULL,
  render_engine TEXT NOT NULL DEFAULT 'MUSTACHE',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_by TEXT,
  approved_by TEXT,
  created_at TEXT NOT NULL,
  approved_at TEXT,
  FOREIGN KEY (template_key) REFERENCES notification_templates(template_key),
  UNIQUE(template_key, version_number, locale)
);

CREATE TABLE sms_messages (
  message_id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  recipient_hash TEXT NOT NULL,
  recipient_masked TEXT NOT NULL,
  recipient_encrypted TEXT,
  sender_id TEXT NOT NULL,
  template_key TEXT,
  template_version_id TEXT,
  rendered_message_hash TEXT NOT NULL,
  rendered_message_encrypted TEXT,
  status TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  provider TEXT NOT NULL DEFAULT 'TEXTLK',
  provider_uid TEXT,
  provider_status TEXT,
  provider_cost TEXT,
  provider_sms_count INTEGER,
  scheduled_at TEXT,
  sent_at TEXT,
  delivered_at TEXT,
  failed_at TEXT,
  failure_code TEXT,
  failure_message TEXT,
  user_id TEXT,
  device_id TEXT,
  correlation_id TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(idempotency_key)
);

CREATE TABLE sms_provider_attempts (
  attempt_id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_endpoint TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  request_body_redacted TEXT,
  response_status_code INTEGER,
  response_body_redacted TEXT,
  provider_uid TEXT,
  provider_status TEXT,
  duration_ms INTEGER,
  success INTEGER NOT NULL DEFAULT 0,
  error_type TEXT,
  error_message TEXT,
  attempted_at TEXT NOT NULL,
  FOREIGN KEY (message_id) REFERENCES sms_messages(message_id)
);

CREATE TABLE otp_challenges (
  challenge_id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  phone_hash TEXT NOT NULL,
  phone_masked TEXT NOT NULL,
  phone_encrypted TEXT,
  user_id TEXT,
  device_id TEXT,
  otp_hash TEXT NOT NULL,
  otp_hash_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  consumed_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  resend_count INTEGER NOT NULL DEFAULT 0,
  max_resends INTEGER NOT NULL DEFAULT 3,
  next_resend_at TEXT,
  last_sms_message_id TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(idempotency_key)
);

CREATE TABLE otp_attempts (
  attempt_id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  ip_hash TEXT,
  device_id TEXT,
  attempted_at TEXT NOT NULL,
  FOREIGN KEY (challenge_id) REFERENCES otp_challenges(challenge_id)
);

CREATE TABLE idempotency_records (
  idempotency_key TEXT PRIMARY KEY,
  route TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE outbox_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_sms_messages_created_at ON sms_messages(created_at);
CREATE INDEX idx_sms_messages_status ON sms_messages(status);
CREATE INDEX idx_sms_messages_recipient_hash ON sms_messages(recipient_hash);
CREATE INDEX idx_sms_messages_provider_uid ON sms_messages(provider_uid);
CREATE INDEX idx_sms_messages_correlation_id ON sms_messages(correlation_id);

CREATE INDEX idx_otp_challenges_phone_hash ON otp_challenges(phone_hash);
CREATE INDEX idx_otp_challenges_status ON otp_challenges(status);
CREATE INDEX idx_otp_challenges_expires_at ON otp_challenges(expires_at);

CREATE INDEX idx_provider_attempts_message_id ON sms_provider_attempts(message_id);
CREATE INDEX idx_outbox_events_status ON outbox_events(status);

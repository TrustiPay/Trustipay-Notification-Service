# TrustiPay SMS Notification Service — API Guide

Internal service for sending SMS messages and OTP challenges. Runs behind the API Gateway and is not directly exposed to end users.

**Production base URL:** `https://notify.trustipay.online`

---

## Running the Service

```bash
npm install

# Development (hot reload)
npm run start:dev

# Production
npm run build && npm start
```

Migrations and seed templates run automatically on every startup — no manual step needed.

Default port: **3000** (controlled by `PORT` env var).

---

## Docker Deployment

### Build and run

```bash
# Build the image
docker build -t trustipay-sms-notification-service .

# Run with a persistent data volume
docker run -d \
  --name sms-service \
  -p 3000:3000 \
  -v sms-data:/app/data \
  --env-file .env \
  trustipay-sms-notification-service
```

The container:
- Runs migrations and seeds templates on startup automatically
- Stores the SQLite database in `/app/data` — mount a named volume so data survives restarts
- Exposes port **3000**
- Has a built-in healthcheck on `GET /health/live` (30 s interval, 3 retries)

### Environment file for production

Create a `.env` on the host (never baked into the image):

```env
NODE_ENV=production
PORT=3000

DATABASE_URL=file:./data/trustipay_sms.sqlite

SMS_PROVIDER_MODE=textlk
SMS_LIVE_SENDING_ENABLED=true
SMS_DEFAULT_SENDER_ID=TrustiPay

TEXTLK_API_KEY=<your-textlk-api-key>

OTP_LENGTH=6
OTP_TTL_SECONDS=300
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_MAX_RESENDS=3
OTP_HASH_SECRET=<strong-random-secret-min-32-chars>
OTP_RETURN_CODE_IN_NON_PROD=false

LOG_LEVEL=info
PII_LOGGING_ENABLED=false
```

### Reverse proxy (nginx example)

```nginx
server {
    listen 443 ssl;
    server_name notify.trustipay.online;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `production`, or `test` |
| `PORT` | `3000` | HTTP port |
| `DATABASE_URL` | `file:./data/trustipay_sms.sqlite` | SQLite file path |
| `SQLITE_WAL_ENABLED` | `true` | Enable WAL mode for concurrent reads |
| `SQLITE_BUSY_TIMEOUT_MS` | `5000` | Lock wait timeout |
| `SMS_PROVIDER_MODE` | `mock` | `mock` (no real SMS) or `textlk` (live) |
| `SMS_LIVE_SENDING_ENABLED` | `false` | Must be `true` to actually send via textlk |
| `SMS_DEFAULT_SENDER_ID` | `TrustiPay` | Sender name shown on device |
| `SMS_ALLOWED_TEST_RECIPIENTS` | — | Comma-separated numbers allowed in non-prod |
| `TEXTLK_BASE_URL` | `https://app.text.lk` | textlk API base |
| `TEXTLK_API_KEY` | `replace-me` | textlk API key |
| `TEXTLK_TIMEOUT_MS` | `10000` | Per-request timeout |
| `TEXTLK_MAX_RETRIES` | `3` | Retry attempts on transient failure |
| `TEXTLK_RETRY_BASE_MS` | `1000` | Base delay for exponential backoff |
| `OTP_LENGTH` | `6` | Number of digits in generated OTPs |
| `OTP_TTL_SECONDS` | `300` | OTP validity window (5 minutes) |
| `OTP_MAX_ATTEMPTS` | `5` | Wrong guesses before challenge locks |
| `OTP_RESEND_COOLDOWN_SECONDS` | `60` | Minimum gap between resend requests |
| `OTP_MAX_RESENDS` | `3` | Maximum resends per challenge |
| `OTP_HASH_SECRET` | `replace-with-strong-random-secret` | HMAC secret for hashing OTPs and phone numbers at rest |
| `OTP_TEST_CODE` | — | Fixed OTP used in non-prod (overrides generation) |
| `OTP_RETURN_CODE_IN_NON_PROD` | `true` | Return plain OTP in response body on non-prod |
| `LOG_LEVEL` | `info` | `fatal` `error` `warn` `info` `debug` `trace` |
| `PII_LOGGING_ENABLED` | `false` | Log raw phone numbers — disable in production |

---

## Endpoints

### Health

#### `GET /health/live`

Liveness probe. Returns 200 as long as the process is running.

```json
{ "status": "ok", "timestamp": "2026-05-06T10:00:00.000Z" }
```

#### `GET /health/ready`

Readiness probe. Returns 200 when the service is ready to accept traffic.

```json
{ "status": "ready", "timestamp": "2026-05-06T10:00:00.000Z" }
```

---

### SMS

#### `POST /internal/v1/sms/send`

Send an SMS using any seeded template. Use this for transactional and security notifications that are not OTP flows.

**Request body**

```json
{
  "recipient": "0711234567",
  "templateKey": "PAYMENT_RECEIVED",
  "variables": {
    "amount": "LKR 5,000.00",
    "transactionId": "TXN-9821"
  },
  "purpose": "TRANSACTIONAL",
  "correlationId": "req-abc123",
  "idempotencyKey": "pay-recv-TXN-9821",
  "priority": "NORMAL"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `recipient` | string | yes | Sri Lankan mobile number (any format — see Phone Number Format) |
| `templateKey` | string | yes | Key of an active template |
| `variables` | object | no | Values for template placeholders |
| `locale` | string | no | Language code, defaults to `en` |
| `purpose` | string | yes | Free-form label stored on the message record |
| `correlationId` | string | no | Trace ID for linking to the originating request |
| `idempotencyKey` | string | no | If provided, duplicate requests return the original response |
| `priority` | `NORMAL` \| `HIGH` | no | Defaults to `NORMAL` |

**Response `202`**

```json
{
  "messageId": "msg_3f9a1b2c4d5e6f7a8b9c0d1e",
  "status": "SENT",
  "recipientMasked": "9471****567",
  "providerUid": "textlk-uid-12345"
}
```

**Response `202` — failed delivery**

```json
{
  "messageId": "msg_3f9a1b2c4d5e6f7a8b9c0d1e",
  "status": "FAILED",
  "recipientMasked": "9471****567",
  "errorType": "PROVIDER_ERROR",
  "errorMessage": "Invalid API key"
}
```

**Response `400`** — validation error (bad phone, unknown template, missing variable)

```json
{ "error": "Invalid phone number format" }
```

---

### OTP

#### How `challengeId` works

The `challengeId` is **generated by the service** — callers never create one. The typical flow is:

```
1. Caller → POST /internal/v1/otp/send   { phone, purpose, ... }
2. Service generates challengeId internally:
       "otp_" + 12 random bytes as hex  →  e.g. "otp_1a2b3c4d5e6f7a8b9c0d1e2f"
3. Service responds with { challengeId, expiresAt, ... }
4. Caller stores the challengeId in the user's session
5. User submits the code they received by SMS
6. Caller → POST /internal/v1/otp/verify { challengeId, code }
```

The `challengeId` is opaque — treat it as a session token. Store it server-side (e.g. in the gateway session or JWT claim) and never expose it in client-facing URLs or responses.

---

#### `POST /internal/v1/otp/send`

Generate an OTP and send it via SMS. Returns a `challengeId` that must be passed to `/otp/verify`.

**Supported purposes**

| `purpose` | Template used | Extra required field |
|---|---|---|
| `LOGIN` | `OTP_LOGIN` | — |
| `PHONE_VERIFICATION` | `OTP_PHONE_VERIFICATION` | — |
| `PAYMENT_APPROVAL` | `OTP_PAYMENT_APPROVAL` | `amount` |

**Request body**

```json
{
  "phone": "0711234567",
  "purpose": "LOGIN",
  "userId": "usr_abc123",
  "deviceId": "dev_xyz789",
  "idempotencyKey": "login-attempt-session-42",
  "correlationId": "req-def456"
}
```

For `PAYMENT_APPROVAL`, include the `amount` field:

```json
{
  "phone": "0711234567",
  "purpose": "PAYMENT_APPROVAL",
  "amount": "LKR 12,500.00",
  "userId": "usr_abc123"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `phone` | string | yes | Sri Lankan mobile number |
| `purpose` | string | yes | `LOGIN`, `PHONE_VERIFICATION`, or `PAYMENT_APPROVAL` |
| `amount` | string | `PAYMENT_APPROVAL` only | Payment amount shown in the SMS |
| `userId` | string | no | Stored on the challenge record for audit |
| `deviceId` | string | no | Stored on the challenge record for audit |
| `idempotencyKey` | string | no | Prevents duplicate challenges for the same flow |
| `correlationId` | string | no | Trace ID |

**Response `202`**

```json
{
  "challengeId": "otp_1a2b3c4d5e6f7a8b9c0d1e2f",
  "phoneMasked": "9471****567",
  "expiresAt": "2026-05-06T10:05:00.000Z",
  "expiresInSeconds": 300,
  "maxAttempts": 5
}
```

In non-production with `OTP_RETURN_CODE_IN_NON_PROD=true`, the response also includes:

```json
{
  "challengeId": "otp_1a2b3c4d5e6f7a8b9c0d1e2f",
  "phoneMasked": "9471****567",
  "expiresAt": "2026-05-06T10:05:00.000Z",
  "expiresInSeconds": 300,
  "maxAttempts": 5,
  "devCode": "482916"
}
```

**Response `400`** — bad phone, unknown purpose, missing amount

```json
{ "error": "amount is required for PAYMENT_APPROVAL OTP" }
```

---

#### `POST /internal/v1/otp/verify`

Verify the OTP code entered by the user.

**Request body**

```json
{
  "challengeId": "otp_1a2b3c4d5e6f7a8b9c0d1e2f",
  "code": "482916"
}
```

**Response `200` — success**

```json
{ "success": true }
```

**Response `200` — wrong code**

```json
{
  "success": false,
  "attemptsRemaining": 3
}
```

**Response `400`** — expired, locked, or too many attempts

```json
{ "error": "OTP has expired" }
```

```json
{ "error": "Too many failed attempts. Challenge is now locked" }
```

**Response `404`** — challenge not found

```json
{ "error": "Challenge not found" }
```

**Challenge status transitions**

```
PENDING → VERIFIED   (correct code)
PENDING → LOCKED     (attempt_count reaches max_attempts)
PENDING → EXPIRED    (TTL elapsed, checked on next verify/resend call)
```

---

#### `POST /internal/v1/otp/resend`

Resend the OTP to the same number. Issues a new code — the old code is invalidated immediately.

The caller must provide the phone number again. The service verifies it matches the original challenge before sending.

**Request body**

```json
{
  "challengeId": "otp_1a2b3c4d5e6f7a8b9c0d1e2f",
  "phone": "0711234567",
  "correlationId": "req-ghi789"
}
```

**Response `202`**

```json
{
  "challengeId": "otp_1a2b3c4d5e6f7a8b9c0d1e2f",
  "phoneMasked": "9471****567",
  "resendsRemaining": 2,
  "expiresAt": "2026-05-06T10:05:00.000Z"
}
```

**Response `400`** — cooldown active

```json
{ "error": "Resend cooldown active. Try again in 47 seconds" }
```

**Response `400`** — limit reached

```json
{ "error": "Maximum resend limit reached" }
```

---

### Templates (preview)

#### `POST /internal/v1/templates/render-preview`

Render a template with variables without sending an SMS. Useful for testing template output.

```json
{
  "templateKey": "OTP_PAYMENT_APPROVAL",
  "variables": {
    "code": "991234",
    "amount": "LKR 5,000.00",
    "ttlMinutes": "5"
  }
}
```

**Response `200`**

```json
{
  "status": "success",
  "renderedMessage": "Use OTP 991234 to approve your TrustiPay payment of LKR 5,000.00. Expires in 5 minutes.",
  "versionId": "tv_3a9f12b4e7c80d51"
}
```

---

## Seeded Templates

| Template Key | Category | Variables |
|---|---|---|
| `TEST_SMS` | `ADMIN_TEST` | `name` |
| `OTP_LOGIN` | `OTP` | `code`, `ttlMinutes` |
| `OTP_PHONE_VERIFICATION` | `OTP` | `code`, `ttlMinutes` |
| `OTP_PAYMENT_APPROVAL` | `OTP` | `code`, `amount`, `ttlMinutes` |
| `DEVICE_LINKED` | `SECURITY` | `date` |
| `PAYMENT_SETTLED` | `TRANSACTIONAL` | `amount`, `transactionId` |
| `PAYMENT_RECEIVED` | `TRANSACTIONAL` | `amount`, `transactionId` |
| `OFFLINE_PAYMENT_PENDING_SYNC` | `TRANSACTIONAL` | `transactionId` |
| `OFFLINE_PAYMENT_REJECTED` | `TRANSACTIONAL` | `transactionId`, `reason` |
| `SECURITY_ALERT` | `SECURITY` | `message` |

---

## Phone Number Format

All phone numbers are Sri Lankan mobile numbers. The service accepts and normalises the following formats:

| Input | Normalised |
|---|---|
| `+94711234567` | `94711234567` |
| `0711234567` | `94711234567` |
| `711234567` | `94711234567` |
| `94 71 123 4567` | `94711234567` |

Numbers that cannot be normalised to `94XXXXXXXXX` (11 digits) are rejected with a `400`.

---

## SMS Provider Modes

**Mock** (`SMS_PROVIDER_MODE=mock`): No real SMS is sent. Every send returns a fake `providerUid` and `Delivered` status. Default for development and CI.

**textlk** (`SMS_PROVIDER_MODE=textlk`): Requires `SMS_LIVE_SENDING_ENABLED=true` and a valid `TEXTLK_API_KEY`. In non-production, only numbers in `SMS_ALLOWED_TEST_RECIPIENTS` receive real messages.

---

## Quick Reference

```bash
# Health check
curl https://notify.trustipay.online/health/live

# Send a transactional SMS
curl -X POST https://notify.trustipay.online/internal/v1/sms/send \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "0711234567",
    "templateKey": "PAYMENT_RECEIVED",
    "variables": { "amount": "LKR 5,000.00", "transactionId": "TXN-9821" },
    "purpose": "TRANSACTIONAL"
  }'

# Send a login OTP
curl -X POST https://notify.trustipay.online/internal/v1/otp/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0711234567",
    "purpose": "LOGIN",
    "userId": "usr_abc123"
  }'

# Verify an OTP
curl -X POST https://notify.trustipay.online/internal/v1/otp/verify \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "otp_1a2b3c4d5e6f7a8b9c0d1e2f",
    "code": "482916"
  }'

# Resend an OTP
curl -X POST https://notify.trustipay.online/internal/v1/otp/resend \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "otp_1a2b3c4d5e6f7a8b9c0d1e2f",
    "phone": "0711234567"
  }'
```

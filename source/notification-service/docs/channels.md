# Notification Channels

The notification service supports 6 delivery channels. Each channel implements the
`NotificationChannel` interface and is registered at startup via `initializeChannels()`.

---

## Channel Registry

### Registration (`channels/index.ts`)

Channels are stored in an in-memory `Map<string, NotificationChannel>`. On startup,
`initializeChannels()` conditionally registers each channel based on whether its
required environment variables are present:

```
in_app    — always registered (no external dependency)
discord   — always registered (user provides webhook URL per config)
telegram  — registered when TELEGRAM_BOT_TOKEN is set
sms       — registered when TWILIO_ACCOUNT_SID is set
email     — registered when RESEND_API_KEY is set
push      — registered when both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set
```

Helper functions:

| Function | Purpose |
|----------|---------|
| `registerChannel(channel)` | Add a channel to the registry |
| `getChannel(name)` | Look up a channel by name |
| `getAllChannels()` | Return all registered channels |

### The `NotificationChannel` Interface (`channels/types.ts`)

```typescript
interface NotificationChannel {
  name: string;
  send(payload: NotificationPayload, config: ChannelConfig): Promise<SendResult>;
  sendDigest(
    payloads: NotificationPayload[],
    config: ChannelConfig,
    period: 'hourly' | 'daily' | 'weekly'
  ): Promise<SendResult>;
  verify(config: ChannelConfig): Promise<{ valid: boolean; error?: string }>;
  getRateLimit(): { maxPerMinute: number; maxPerHour: number; maxPerDay: number };
}
```

- **`send`** — deliver a single notification.
- **`sendDigest`** — deliver a batch of notifications as a digest summary.
- **`verify`** — validate channel configuration and, where applicable, initiate a
  verification flow (e.g. send an OTP code).
- **`getRateLimit`** — return per-user rate limits for this channel.

### Adding a New Channel

1. Create `src/channels/<name>.ts` with a class implementing `NotificationChannel`.
2. Register it in `initializeChannels()` in `src/channels/index.ts`, guarding on any
   required config values.
3. Add the corresponding env vars to the config module if needed.

---

## In-App (`in_app`)

**Source:** `src/channels/in-app.ts`

Always registered. No external service dependency.

### Behavior

- **send** — inserts a row into the `notifications` table via Supabase with
  `is_digest: false` and `read: false`.
- **sendDigest** — bulk-inserts all payloads into `notifications` with
  `is_digest: true`.
- **verify** — always returns `{ valid: true }`. No verification needed.

### Configuration

No `channel_config` fields required.

### Rate Limits

| /min | /hr | /day |
|------|-----|------|
| 100 | 1000 | 10000 |

---

## Email (`email`)

**Source:** `src/channels/email.ts`

Registered when `RESEND_API_KEY` is set. Uses the [Resend](https://resend.com) API
for delivery.

### Behavior

- **send** — renders an HTML email via `renderNotificationEmail()` and sends it
  through Resend. Subject line is the notification title. Sender is configured via
  `config.email.fromName` / `config.email.fromAddress`.
- **sendDigest** — renders a digest HTML email via `renderDigestEmail()` grouped by
  period. Subject format: `"{period} prehled -- {count} upozorneni"` (Czech labels:
  Hodinovy, Denni, Tydenni).
- **verify** — regex validation of the email address format
  (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`). No OTP or confirmation email is sent.

### Configuration

```json
{
  "email": "user@example.com"
}
```

### Rate Limits

| /min | /hr | /day |
|------|-----|------|
| 10 | 100 | 500 |

---

## Discord (`discord`)

**Source:** `src/channels/discord.ts`

Always registered. The user provides their own webhook URL in `channel_config`.

### Behavior

- **send** — posts a rich embed to the webhook. Embeds include:
  - Color-coded by event type (see table below)
  - Fields for price (with strikethrough for old price), area, bedrooms, location
  - Thumbnail from the first property image
  - Link to the source listing URL
  - Footer: "Landomo -- Real Estate Alerts"

- **sendDigest** — posts a summary embed with the period label in the title and
  fields showing counts per event type.

- **verify** — sends a test embed ("Landomo Connection Test") to the webhook URL.
  Also validates the URL matches the pattern
  `https://discord.com/api/webhooks/...`.

### Event Type Colors

| Event | Color | Hex |
|-------|-------|-----|
| `new_listing` | Green | `0x2ecc71` |
| `price_drop` | Red | `0xe74c3c` |
| `price_increase` | Orange | `0xf39c12` |
| `status_removed` | Gray | `0x95a5a6` |
| `reactivated` | Blue | `0x3498db` |
| *(default)* | Blue | `0x3498db` |

### Configuration

```json
{
  "webhook_url": "https://discord.com/api/webhooks/..."
}
```

### Rate Limits

| /min | /hr | /day |
|------|-----|------|
| 30 | 100 | 500 |

---

## Telegram (`telegram`)

**Source:** `src/channels/telegram.ts`, `src/channels/telegram-bot.ts`

Registered when `TELEGRAM_BOT_TOKEN` is set.

### Behavior

- **send** — sends an HTML-formatted message to the user's chat. When the property
  has images, sends a photo message (`sendPhoto`) with the first image and an HTML
  caption. Falls back to a text message (`sendMessage`) with
  `disable_web_page_preview: true` when no images are available. Messages include
  location, price (with strikethrough for price drops), property category, watchdog
  name, and a link to the listing.

- **sendDigest** — sends a single text message listing up to 20 items with title,
  city, price, and link. Items beyond 20 are summarized as "...and N more".

- **verify** — generates a 6-digit code, stores it in the `user_channels` table
  (setting `verified: false`), and sends it to the user via the bot. The user replies
  with the code to complete verification.

### Webhook Verification Flow

The Telegram bot webhook handler (`telegram-bot.ts`) is mounted at
`POST /webhooks/telegram` and handles:

1. **`/start` command** — replies with the user's chat ID and setup instructions.
2. **6-digit code** — looks up a matching `user_channels` row where
   `channel_type = 'telegram'`, `verification_code` matches, `verified = false`, and
   `config->>chat_id` matches the sender. On match, sets `verified: true` and clears
   the code.
3. **Anything else** — replies with usage instructions.

The webhook is authenticated via the `X-Telegram-Bot-Api-Secret-Token` header,
checked against `config.telegram.webhookSecret`.

### Configuration

```json
{
  "chat_id": "123456789"
}
```

### Rate Limits

| /min | /hr | /day |
|------|-----|------|
| 30 | 100 | 1000 |

---

## SMS (`sms`)

**Source:** `src/channels/sms.ts`

Registered when `TWILIO_ACCOUNT_SID` is set. Requires `TWILIO_AUTH_TOKEN` and
`TWILIO_PHONE_NUMBER` as well.

### Behavior

- **send** — sends a compact SMS via Twilio. Message format:
  `"Landomo: {price change info} {category} {city} {price} landomo.cz/p/{id}"`.
  Price drops/increases include a percentage change. Prices above 1M are formatted
  as e.g. "2.5M CZK".

- **sendDigest** — sends a single SMS summarizing the batch. Format:
  `"Landomo: {count} novych upozorneni. Nejvyznamnejsi: {top item summary}"`.
  Truncated to fit within ~160 characters.

- **verify** — validates E.164 phone number format (`/^\+[1-9]\d{6,14}$/`),
  generates a 6-digit OTP, stores it in `user_channels`, and sends it via Twilio:
  `"Landomo: Vas overovaci kod je {code}"`.

### Configuration

```json
{
  "phone_number": "+420774123456"
}
```

Phone number must be in E.164 format.

### Rate Limits

| /min | /hr | /day |
|------|-----|------|
| 1 | 10 | 20 |

SMS has the most restrictive limits because each message incurs a per-message cost
through Twilio.

---

## Web Push (`push`)

**Source:** `src/channels/web-push.ts`

Registered when both `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are set. Uses the
`web-push` library for delivery via the Web Push API.

### Behavior

- **send** — sends a push notification with a JSON payload containing:
  `title`, `message`, `event_type`, `property_id`, `url`, `image`, `price`, `city`.
  The URL defaults to the source listing URL, falling back to
  `https://landomo.cz/p/{property_id}`.

- **sendDigest** — sends a summary push notification with Czech period labels
  (Hodinovy/Denni/Tydenni), total count, per-event-type breakdown, and a link to
  `https://landomo.cz/notifications`.

- **verify** — validates that:
  1. `endpoint` is present and uses HTTPS
  2. `p256dh` key is present
  3. `auth` key is present

  No test notification is sent during verification.

### Error Handling

- **410 Gone** and **404 Not Found** responses are treated as expired subscriptions.
  The error is returned as `"subscription_expired"` so the caller can mark the
  channel for cleanup.
- All other errors are logged with the endpoint and status code.

### Configuration

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "p256dh": "BNcRd...",
  "auth": "tBHI..."
}
```

These values come from the browser's `PushSubscription` object.

### Rate Limits

| /min | /hr | /day |
|------|-----|------|
| 30 | 200 | 1000 |

---

## Rate Limits Summary

| Channel | /min | /hr | /day | Notes |
|---------|------|-----|------|-------|
| `in_app` | 100 | 1000 | 10000 | Highest limits; database writes only |
| `email` | 10 | 100 | 500 | Resend API |
| `discord` | 30 | 100 | 500 | Discord webhook |
| `telegram` | 30 | 100 | 1000 | Telegram Bot API |
| `sms` | 1 | 10 | 20 | Most restrictive; per-message cost |
| `push` | 30 | 200 | 1000 | Web Push API |

These are per-user limits enforced by the rate limiter. They represent the maximum
number of notifications a single user can receive through a given channel within each
time window.

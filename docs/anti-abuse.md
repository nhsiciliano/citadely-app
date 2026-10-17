# Public booking: abuse protection

Defence in depth for `POST /api/public-booking` (the only way to create a public booking; `create_public_booking`
is not executable by `anon`/`authenticated`).

| Layer | Where | What |
|---|---|---|
| 1. Edge rate limit | Vercel Firewall (manual, see below) | Drops floods before they reach a function |
| 2. Input validation | `app/api/public-booking/route.ts`, `lib/booking-protection.ts` | 8 KB body cap, UUID ids, name ≤ 120, email ≤ 254 and well formed, phone ≤ 40 with ≥ 6 digits, message ≤ 2000 |
| 3. Attempt limiter | `register_public_booking_attempt` + `public_booking_attempts` | Per IP: 8 / 10 min. Per email: 5 / 15 min. Per business: 60 / 10 min. Open `pending_payment` bookings: ≤ 3 per email, ≤ 5 per phone (any business). Fails closed (503) if the RPC errors. Only a keyed hash of the IP and a SHA-256 of the email are stored; rows are purged after 24 h |
| 4. Bot challenge (optional) | Cloudflare Turnstile | Enforced only when `TURNSTILE_SECRET_KEY` is set |

Limits are constants at the top of `register_public_booking_attempt`; change them with a new migration.

## Vercel Firewall rule (to be configured by the project owner)

Rate limiting is not part of the repo. Dashboard: Project → Firewall → Configure → New rule, or with the CLI
(`npx vercel firewall`, project linked; rules are staged as a draft until `publish`):

**Hobby plan** allows a single rate-limit rule per project (and 3 custom rules in total), so both endpoints go in one
rule with two OR groups:

```bash
npx vercel firewall rules add "Rate limit reserva publica y canje de promo" \
  --condition '{"type":"path","op":"eq","value":"/api/public-booking"}' \
  --condition '{"type":"method","op":"eq","value":"POST"}' \
  --or \
  --condition '{"type":"path","op":"eq","value":"/api/promo-codes/redeem"}' \
  --condition '{"type":"method","op":"eq","value":"POST"}' \
  --action rate_limit --rate-limit-algo fixed_window \
  --rate-limit-requests 10 --rate-limit-window 60 --rate-limit-keys ip \
  --rate-limit-action deny --duration 5m

npx vercel firewall diff      # review the draft
npx vercel firewall publish   # make it live
```

**Pro plan** variant, one rule per endpoint (independent counters and descriptions):

```bash
npx vercel firewall rules add "Rate limit public booking" \
  --condition '{"type":"path","op":"eq","value":"/api/public-booking"}' \
  --condition '{"type":"method","op":"eq","value":"POST"}' \
  --action rate_limit --rate-limit-algo fixed_window \
  --rate-limit-window 60 --rate-limit-requests 10 --rate-limit-keys ip \
  --rate-limit-action deny --duration 5m \
  --description "Max 10 booking attempts per minute per IP"

npx vercel firewall rules add "Rate limit promo redeem" \
  --condition '{"type":"path","op":"eq","value":"/api/promo-codes/redeem"}' \
  --condition '{"type":"method","op":"eq","value":"POST"}' \
  --action rate_limit --rate-limit-algo fixed_window \
  --rate-limit-window 60 --rate-limit-requests 10 --rate-limit-keys ip \
  --rate-limit-action deny --duration 5m \
  --description "Max 10 promo redemptions per minute per IP"

npx vercel firewall diff      # review the draft
npx vercel firewall publish   # make it live
```

If a flag name differs in your CLI version, `npx vercel firewall rules add --help` lists them. Equivalent in the
dashboard: condition *Request Path equals* `/api/public-booking` AND *Method equals* `POST`; action *Rate Limit*,
fixed window, 60 s, 10 requests, key *IP Address*, then *Deny* (429).

## Turnstile (optional)

1. Cloudflare dashboard → Turnstile → add a widget for `citadely.com.ar` (and the preview domain). Managed mode.
2. Set **both** variables in Vercel (Production and Preview): `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public) and
   `TURNSTILE_SECRET_KEY`. Setting only the secret blocks every booking because the form would not send a token;
   setting only the site key renders a widget the server ignores.
3. Redeploy. Cloudflare's test keys (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`) work for
   Preview.

Optional: `PUBLIC_BOOKING_HASH_SECRET` (random string) keys the IP hash; it falls back to `INSFORGE_API_KEY`.

## Release order

Apply `20261015151331_add-public-booking-attempts.sql` to the parent project **before** deploying this code:
the route fails closed, so without the function every public booking returns 503.

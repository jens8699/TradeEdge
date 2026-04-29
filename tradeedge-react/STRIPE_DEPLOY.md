# Stripe — go-live checklist

Everything code-side is wired. Before the next Cloudflare deploy can actually
charge a card, you need to do these three things in this order.

---

## 1. Run the Supabase migration

In Supabase → SQL Editor, paste and run `stripe_migration.sql`. It adds three
columns to `profiles` (`stripe_customer_id`, `stripe_subscription_id`,
`has_backtesting`) and is idempotent — safe to re-run.

If your `profiles` table doesn't already have a `plan` column, uncomment the
ALTER block at the bottom of the migration first.

---

## 2. Set environment variables in Cloudflare Pages

Cloudflare Dashboard → Pages → your project → **Settings → Environment variables**.
Add these to **Production** (and Preview if you want to test on PR builds):

| Name | Value | Where to find it |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` for now, swap to `sk_live_…` later | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | Stripe → Developers → Webhooks → your endpoint → Signing secret |
| `STRIPE_PRICE_PRO` | `price_1TRUm0EDcF7EO7wrffDxvYjJ` | (your Pro price ID) |
| `STRIPE_PRICE_BACKTEST` | `price_1TRUqWEDcF7EO7wrckNTWnrJ` | (your Backtesting price ID) |
| `SUPABASE_URL` | `https://<your-project>.supabase.co` | Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | the long anon JWT | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | the long service-role JWT (secret!) | Supabase → Settings → API |

After saving, **redeploy** (the env vars only become visible to functions on
the next deployment).

---

## 3. Register the webhook in Stripe

Stripe Dashboard → **Developers → Webhooks → Add endpoint**.

- **Endpoint URL:** `https://tradeedge.today/api/stripe-webhook`
  (use your real domain — for testing on a Cloudflare preview deploy, use that
  preview URL temporarily.)
- **Events to send:** add these four:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Click **Add endpoint**, then copy the **Signing secret** (starts with
  `whsec_`) into `STRIPE_WEBHOOK_SECRET` from step 2.

---

## 4. (One-time) Enable the Customer Portal

Stripe Dashboard → **Settings → Billing → Customer portal** → toggle it on.
Pick which features customers can self-serve (cancel, update payment, etc.).

Without this, the "Manage subscription" button in Settings will error out.

---

## How it flows

1. Free user clicks **Upgrade to Pro** → opens UpgradeModal.
2. Modal POSTs to `/api/stripe-checkout` with their Supabase JWT and the
   Backtesting toggle state.
3. Worker creates a Stripe Checkout Session, redirects browser to Stripe.
4. User pays → Stripe redirects back to `/?checkout=success`.
5. App.jsx detects the param, shows a toast, and re-fetches the profile
   (with retries — gives the webhook ~5s to land).
6. In parallel, Stripe POSTs `checkout.session.completed` to
   `/api/stripe-webhook`. The webhook verifies the signature, then updates
   `profiles.plan='pro'` + `has_backtesting` + Stripe IDs via service role.
7. Settings now shows "TradeEdge Pro Active" with a **Manage subscription**
   button that opens Stripe's portal.

---

## Test it before going live

With test keys + a webhook pointing at a preview deploy:

- Use card `4242 4242 4242 4242`, any future expiry, any CVC.
- Try with the Backtesting toggle on AND off — verify
  `profiles.has_backtesting` flips correctly.
- In Stripe Dashboard → cancel the subscription — verify `plan` flips back
  to `'free'` after `customer.subscription.deleted` fires.
- Hit "Manage subscription" — should open the Stripe Customer Portal.

---

## Switching from test → live

When you're ready:
1. In Stripe, toggle to **Live mode** (top-left of dashboard).
2. Re-create the two Products + Prices in live mode (price IDs differ).
3. Re-create the webhook endpoint in live mode (gets a new `whsec_…`).
4. In Cloudflare, swap `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BACKTEST` to the live values.
5. Redeploy.

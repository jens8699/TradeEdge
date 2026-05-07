# Email sequence — setup steps

The code for the 7-touch trial → paid email sequence is on
`feature/email-sequence`. To get it running you need to:

1. Set up Resend (~10 min)
2. Run the SQL migration (~30 sec)
3. Add 3 secrets to Cloudflare Pages
4. Add 1 secret to GitHub
5. Push + merge the branch
6. Manually trigger the cron once to verify

---

## 1. Resend

1. Go to https://resend.com → sign up with your real email (jensgmadsen1221@gmail.com is fine — this is just the Resend account)
2. **Domains tab** → "Add Domain" → enter `tradeedge.today`
3. Resend shows you 3 DNS records (SPF, DKIM, DMARC). Copy them.
4. Go to your DNS registrar (whoever you bought tradeedge.today from — Namecheap / Cloudflare / etc.) → DNS settings → add the 3 records exactly as shown
5. Back in Resend, click "Verify" — usually takes 5-10 min for DNS to propagate
6. Once verified, **API Keys tab** → "Create API Key" → name it `tradeedge-prod` → copy the `re_...` key (only shown once)

## 2. Run the SQL migration

In Supabase SQL Editor, paste and run:

```sql
-- contents of email_sequence_migration.sql
-- (in this folder)
```

Creates `email_sequence_log` table + adds `unsubscribed_at` to profiles.

## 3. Add secrets to Cloudflare Pages

Cloudflare Dashboard → Pages → tradeedge → Settings → Variables and Secrets

Add these as **Secrets** (encrypted) for **both Production AND Preview** environments:

- `RESEND_API_KEY` = the `re_...` key from Resend
- `EMAIL_CRON_SECRET` = generate a random string (e.g., run `openssl rand -hex 32` in terminal — or just use any 32+ char random string)
- `EMAIL_TOKEN_SECRET` = generate another random string (different from cron secret)

Save EMAIL_CRON_SECRET somewhere — you need it again in step 4.

## 4. Add GitHub repo secret

GitHub → jens8699/TradeEdge → Settings → Secrets and variables → Actions → "New repository secret"

- Name: `EMAIL_CRON_SECRET`
- Value: same value you used in step 3

## 5. Push + merge

From your terminal:

```bash
cd "/Users/jensmadsen/Documents/Claude/Projects/trading system" && \
git push origin feature/email-sequence
```

Then go to Cloudflare → wait ~60s for the preview deployment.
Test by sending yourself a Day 0 manually (see step 6).

When confident, merge:

```bash
git checkout main && \
git merge feature/email-sequence && \
git push origin main
```

## 6. Verify it works

**Manual test (recommended before going live):**

GitHub → Actions tab → "Email sequence cron" → "Run workflow"

Watch the run. It should hit the endpoint, return JSON. Check your inbox at the email you signed up with — you should get a Day 0 welcome email.

**If it works:** the hourly cron will start running automatically. You don't need to do anything.

**If it doesn't work:** check Cloudflare Pages → Functions → Logs for errors. Most common causes:
- DNS records not propagated yet (wait 30 min, retry)
- Secret missing in Cloudflare env (check Production AND Preview have it)
- Resend domain not verified
- GitHub secret name doesn't match (must be exactly `EMAIL_CRON_SECRET`)

## What runs automatically once set up

- **Every hour at :03 UTC** — GitHub Actions hits `/api/email-sequence-tick`, the function checks who's due for which email, sends via Resend, logs to Supabase
- **On Stripe trial-end** — Day 6 email fires when `trial_ends_at` is within 24h
- **On Stripe payment success** — Day 7 fires when user becomes Pro non-trial
- **One-click unsubscribe** — every email has the link, sets `profiles.unsubscribed_at`, future emails skip the user

## Cost

$0/month at current scale. Resend free tier = 3,000 emails/mo (~430 signups/mo). GitHub Actions free for public + private repos at our usage. Supabase already paid for.

When you cross ~400 signups/mo, Resend jumps to $20/mo. We'll cross that bridge later.

## To pause the whole sequence

GitHub → Actions → "Email sequence cron" → "..." → Disable workflow.
Re-enable when you want it back. No code changes needed.

## To pause one email (e.g., Day 6)

In `functions/api/_email_lib.js`, change the `STEP_ELIGIBILITY[step]` to return `false`. Push. Done.

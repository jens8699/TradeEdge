// Frontend helpers for talking to our Stripe-backed Cloudflare Workers.
// Both endpoints require a Supabase access token in the Authorization header.

import { sb } from './supabase';

async function getToken() {
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token || '';
}

/**
 * Start a Stripe Checkout flow. Redirects the browser to Stripe on success.
 * Throws on failure with a user-friendly message.
 *
 * @param {object} opts
 * @param {boolean} [opts.addBacktesting] include the +$10/mo Backtesting add-on
 */
export async function startCheckout({ addBacktesting = false } = {}) {
  const token = await getToken();
  if (!token) throw new Error('You need to be signed in to subscribe.');

  const resp = await fetch('/api/stripe-checkout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ addBacktesting }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.error || `Checkout failed (HTTP ${resp.status})`);
  }
  if (!data.url) throw new Error('Checkout did not return a redirect URL.');
  window.location.assign(data.url);
}

/**
 * Open the Stripe Customer Portal in the same tab so the user can update
 * their card or cancel.
 */
export async function openPortal() {
  const token = await getToken();
  if (!token) throw new Error('You need to be signed in.');

  const resp = await fetch('/api/stripe-portal', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.error || `Portal failed (HTTP ${resp.status})`);
  }
  if (!data.url) throw new Error('Portal did not return a URL.');
  window.location.assign(data.url);
}

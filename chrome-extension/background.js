// TradeEdge Logger — background service worker
// Handles offline queue sync when browser wakes up

const SUPABASE_URL  = 'https://ppjrfpuqfofgggtgmipd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwanJmcHVxZm9mZ2dndGdtaXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDg2MTIsImV4cCI6MjA5MTgyNDYxMn0.f4sRfK2-rrKbfsl-51wluoJb9gpm95MeEng1kjpg3TA';

async function sbFetch(path, opts = {}) {
  const { data: authData } = await chrome.storage.local.get('te_auth');
  const token = authData?.access_token || SUPABASE_ANON;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(opts.headers || {}),
    },
  });
  return res;
}

async function syncOfflineQueue() {
  const { te_offline_queue: queue = [] } = await chrome.storage.local.get('te_offline_queue');
  if (!queue.length) return;

  const remaining = [];
  for (const item of queue) {
    try {
      const res = await sbFetch('trades', {
        method: 'POST',
        body: JSON.stringify(item.data),
      });
      if (!res.ok) remaining.push(item);
    } catch {
      remaining.push(item);
    }
  }
  await chrome.storage.local.set({ te_offline_queue: remaining });
}

// Sync offline queue on startup and every 5 minutes
chrome.runtime.onStartup.addListener(syncOfflineQueue);
chrome.alarms.create('sync', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sync') syncOfflineQueue();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'sync_queue') {
    syncOfflineQueue().then(() => sendResponse({ ok: true }));
    return true; // async
  }
});

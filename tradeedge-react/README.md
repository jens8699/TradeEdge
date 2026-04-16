# TradeEdge — React App

This is the React + Vite version of the TradeEdge trading journal.

## How to deploy (Netlify — recommended)

### Option A: Connect GitHub (auto-deploys on every push)

1. Push this entire `tradeedge-react` folder to a new GitHub repository
2. Go to [app.netlify.com](https://app.netlify.com) and click "Add new site" → "Import an existing project"
3. Connect your GitHub repo
4. In build settings, Netlify will auto-detect the `netlify.toml` config:
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `dist`
5. Click **Deploy** — Netlify will install packages and build the app

### Option B: Drag & drop (quick test)

You can't drag-drop this directly since it needs to build first — use Option A for this React version.

---

## Local development (optional, needs Node.js)

```bash
cd tradeedge-react
npm install
npm run dev
```

Then open http://localhost:5173

---

## Supabase setup

The Supabase credentials are already in `src/lib/supabase.js`. Your existing database tables and storage bucket from the vanilla version work with this React version without any changes.

---

## Updating the app

Push new commits to your GitHub repo. Netlify auto-rebuilds and deploys in ~1 minute.

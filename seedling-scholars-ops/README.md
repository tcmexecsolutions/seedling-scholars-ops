# Seedling Scholars Ops

Internal compliance & operations app for TCM's Seedling Scholars house network — capacity monitor, credential tracker, daily safety checklist, and audit history, all scoped per house with Supabase Row Level Security.

## Local setup

```
npm install
cp .env.example .env
npm run dev
```

## Environment variables

Set these both locally (`.env`) and in Vercel's Project → Settings → Environment Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Values are in `.env.example` — this is the public/anon key, safe to expose in the browser; it's the Row Level Security policies on the database that actually enforce who can see what.

## Deploying

1. Push this folder to a new GitHub repository.
2. In Vercel, "Add New Project" → import that repository. Vercel auto-detects Vite.
3. Add the two environment variables above before the first deploy.
4. Deploy.

## Adding staff logins

New staff accounts are created in Supabase → Authentication → Users → Add User. A profile row is created automatically on signup (defaulting to role `teacher`, no site). An admin then assigns their role and house from the Supabase Table Editor on the `profiles` table (or a future admin screen in-app).

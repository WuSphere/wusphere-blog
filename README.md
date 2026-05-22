# WuSphere AI Growth Platform

Next.js + Supabase starter for a level-based personal platform.

## What is included

- Supabase Auth entry on landing page (Google / GitHub / Email Magic Link)
- Dashboard with level, EXP progress, role, and recent EXP logs
- Permission-driven posts page (locked/unlocked by min_level)
- SQL schema with RLS policies for users, posts, exp logs, comments

## Tech stack

- Next.js 16 (App Router, TypeScript)
- Tailwind CSS v4
- Supabase (Auth + Postgres + RLS)
- Framer Motion

## Setup

1. Install dependencies

```bash
npm install
```

2. Create local env file

```bash
cp .env.local.example .env.local
```

Required variables in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)

3. Run SQL in Supabase SQL Editor

- File: `supabase/schema.sql`

4. Enable auth providers in Supabase dashboard

- Google
- GitHub
- Email

5. Start dev server

```bash
npm run dev
```

## Core tables

- `users`: level, exp, role, avatar, bio
- `posts`: min_level, is_public, content
- `user_exp_logs`: growth history
- `comments`: user comments per post

## Next expansion ideas

- Add AI Tool pages and grant EXP when tool usage is completed
- Add admin panel for creating gated posts
- Add Stripe and map subscription to `role = vip`

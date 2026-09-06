# SkillSwap — clean auth + onboarding build

This is a fresh Next.js + Supabase implementation focused on one reliable rule:

**The Auth account is created only after the user completes both onboarding steps.**

## Flow

1. `/auth/sign-up` — email + password only. Nothing is created in Supabase Auth yet.
2. `/onboarding/profile` — full name, phone, date of birth, optional bio.
3. `/onboarding/skills` — add 1–10 skills you can teach.
4. The final button calls `supabase.auth.signUp()` exactly once.
5. The Supabase trigger reads the signup metadata and creates `profiles`, `profile_private`, `skills`, and `user_skills` atomically.
6. If email confirmation is enabled, the user sees the confirmation page and later lands in `/explore` after the callback.

## Setup

```bash
npm install
npm run dev
```

The included `.env.local` uses the publishable Supabase key supplied for this project. Keep `.env.local` local and do not commit it.

## Supabase

Run `supabase/schema.sql` in Supabase SQL Editor. The SQL is written for a fresh `public` schema and creates the tables, trigger, RLS policies, and indexes required by this build.

If your Supabase project's Auth email confirmation setting is ON, the user will receive a confirmation email after the final onboarding step. The Auth account has already been created at that point; no account is created before that final button.

## Important naming contract

Client draft fields:

- `accountEmail`
- `fullName`
- `phoneNumber`
- `dateOfBirth`
- `bio`
- `offeredSkills`

Database columns:

- `profiles.full_name`
- `profiles.bio`
- `profile_private.phone_number`
- `profile_private.date_of_birth`
- `skills.name`
- `user_skills.type`

Signup metadata keys use explicit names such as `profile_full_name`, `private_phone_number`, `private_date_of_birth`, and `offered_skills`.
# skillshare

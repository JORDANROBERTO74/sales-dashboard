# Auth Redirect URLs Checklist (Supabase)

Use this checklist when validating password-link workflows after splitting routes.

## Required Site URL

- `http://localhost:3000` (development)

## Required Redirect URLs

- `http://localhost:3000/auth/reset-password`
- `http://localhost:3000/auth/invite-password`
- `http://localhost:3000/auth/update-password` (legacy temporary compatibility)

## Optional but recommended

- `http://localhost:3000/`
- `http://localhost:3000/**`

## Verification checklist

1. Send forgot-password email and open link.
2. Confirm final destination is `/auth/reset-password` (or legacy route redirecting there).
3. Send invite email and open link.
4. Confirm final destination is `/auth/invite-password` (or legacy route redirecting there).
5. Open an old `/auth/update-password` link and confirm it redirects by `type`.

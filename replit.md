# MAID.com

A two-sided household-help marketplace where clients find local helpers, send work offers, and communicate after an offer is accepted.

## Run & Operate

- Install Node.js 24 and pnpm, then run `pnpm install --no-frozen-lockfile` from the repository root. This refreshes the lockfile with the Windows native packages needed for local Expo development.
- Use `.env.example` as a reference and merge its required settings into `.env`; do not overwrite existing credentials. Keep `.env` private.
- For a UI/marketplace demo without Clerk or Supabase, set `EXPO_PUBLIC_DEMO_MODE=true`. It uses local device-only accounts and simulated API responses; do not use demo mode for production or real customer data.
- Apply `supabase/migrations/20260602000000_ghar_sathi_marketplace.sql` to the Supabase project.
- For a phone demo, set `EXPO_PUBLIC_API_URL` in `.env` to `http://<this-PC-Wi-Fi-IPv4>:5000`. Keep the phone and PC on the same Wi-Fi.
- `pnpm dev:api` — build and run the API on port 5000, reachable on the LAN.
- `pnpm dev:expo` — start Expo in LAN mode on port 8081; scan its QR code with Expo Go.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required server-side values: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, and `SUPABASE_DATABASE_URL` (Supabase PostgreSQL connection string; use the pooler URL with SSL when appropriate).
- Required Expo values: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_API_URL`. Never put a Clerk secret or Supabase database URL in an `EXPO_PUBLIC_` variable.
- Demo mode does not start or require the API server; use only `pnpm dev:expo` while `EXPO_PUBLIC_DEMO_MODE=true`.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: Supabase PostgreSQL, accessed only by the server through `SUPABASE_DATABASE_URL`
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (ESM bundle)

## Where things live

- Expo app: `artifacts/ghar-sathi`
- API: `artifacts/api-server`
- API contract and generated client: `lib/api-spec`, `lib/api-client-react`
- Supabase schema migration: `supabase/migrations`

## Architecture decisions

- Clerk authenticates users; the API verifies their identity before accessing marketplace data.
- Native Expo requests use Clerk bearer tokens. The API base URL is configurable through `EXPO_PUBLIC_API_URL`.
- Supabase PostgreSQL is accessed only by the API server; database credentials must never be embedded in the Expo bundle.
- Client and helper profiles share the same account model, while offers and conversations connect the two roles.

## Product

Clients can create profiles, discover nearby household helpers, and make offers. Helpers can create service profiles and accept, decline, or counter offers. Accepted offers create a private conversation with text and voice messaging; notifications and account settings are also available.

## Gotchas

- For Expo Go on a phone, use the PC's current Wi-Fi IPv4 address in `EXPO_PUBLIC_API_URL`, not `localhost`.
- If Windows Firewall prompts, allow Node.js/Expo and the API port on the private network.
- The Expo app requires Clerk keys; Supabase project API keys alone do not configure Clerk authentication or the PostgreSQL driver.
- Offers negotiate amounts but do not process payments.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

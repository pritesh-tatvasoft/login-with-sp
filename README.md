# Singpass POC - Step 1: Discovery

## Files in this step
- `lib/singpassConfig.ts` - reads env vars, single source of truth
- `lib/singpassIssuer.ts` - discovers + caches the OIDC/FAPI issuer metadata
- `app/api/auth/discovery/route.ts` - test route, confirms env + discovery work
- `.env.local` - points at local MockPass (already tested working)
- `.env.staging` - placeholder, fill in once you get real client_id/issuer

## Install into your actual Next.js project
```bash
npm install openid-client@5
```

Copy the four files above into the matching paths in your Next.js app
(adjust the `@/lib/...` import alias if your tsconfig paths differ).

## How to test locally
1. Run MockPass in a separate terminal:
   ```bash
   npx @opengovsg/mockpass@latest
   ```
2. Run your Next.js dev server with local env:
   ```bash
   npm run dev:local
   ```
3. Visit `http://localhost:3000/api/auth/discovery` in your browser

You should see a JSON response with `authorization_endpoint`,
`pushed_authorization_request_endpoint`, `token_endpoint`, `jwks_uri`,
and the supported algorithms (ES256 signing, ECDH-ES+A256KW /
A256CBC-HS512 encryption) - already confirmed working against the
version of MockPass tested during this build.

## Switching to staging later
Fill in `.env.staging` with the real issuer URL and client_id once
you have them, then run:
```bash
npm run dev:staging
```
No code changes needed - only the env values change.

## Environment scripts
| Script | Description |
|---|---|
| `npm run dev:local` | Dev server using `.env.local` |
| `npm run dev:staging` | Dev server using `.env.staging` |
| `npm run build:local` | Production build using `.env.local` |
| `npm run build:staging` | Production build using `.env.staging` |
| `npm run start:local` | Start prod server using `.env.local` |
| `npm run start:staging` | Start prod server using `.env.staging` |

## Next step
Step 2: generate the ephemeral EC (P-256) key used for DPoP proofs,
required for both the upcoming PAR request and the token exchange.

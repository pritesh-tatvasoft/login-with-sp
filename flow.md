# Singpass v3 FAPI login - full end-to-end flow reference

This documents exactly what happens, request by request, from the user
clicking "Login with Singpass" to landing on the dashboard with verified
claims. Every step below is tied to the actual file that implements it, and
was verified against a live MockPass instance before being handed over -
this is not theoretical, this is what your code actually does.

Use this as the reference when reimplementing the same flow in the NestJS
production backend - the HTTP-level behaviour doesn't change, only the
framework wrapping it does.

---

## Actors in this flow

- **Browser** - the user's device
- **Your Next.js server** - `login`, `callback` API routes + the `lib/*` modules
- **Singpass** - MockPass locally, real Singpass in staging/production

---

## Step 0 - One-time setup (happens at server startup / first request, not per-login)

Before any user clicks anything, your server needs to know how to talk to
Singpass at all. This happens inside `getSingpassConfiguration()`
(`lib/singpassIssuer.ts`), and is cached in memory so it only runs once per
server process:

1. **Load RP keys from env** (`lib/singpassKeys.ts`)
   - Reads `SINGPASS_RP_SIGNING_KEY_JWK` and `SINGPASS_RP_ENCRYPTION_KEY_JWK`
   - Imports each via `crypto.subtle.importKey()` into a `CryptoKey`
   - Re-attaches `kid`/`alg` (importKey strips these, but openid-client needs
     them to pick the right key later)

2. **HTTP GET to discovery endpoint**
   ```
   GET {SINGPASS_ISSUER}/.well-known/openid-configuration
   ```
   Response is a JSON document listing every other endpoint Singpass has
   (`authorization_endpoint`, `pushed_authorization_request_endpoint`,
   `token_endpoint`, `jwks_uri`) plus which algorithms it supports. Your app
   never hardcodes these URLs - it always resolves them from this document.

3. **Register client authentication method** - `PrivateKeyJwt(privateSigningKey)`
   is attached to the resulting `Configuration` object. This doesn't make a
   network call yet - it just means every future request to Singpass will be
   signed with your RP private signing key.

4. **Register decryption capability** - `enableDecryptingResponses()` attaches
   your RP private *encryption* key to the same `Configuration`, so any
   encrypted response (the ID token) can be decrypted automatically later.

Result: one `Configuration` object, held in memory, reused for every login
that happens while the server is running.

---

## Step 1 - User clicks "Login with Singpass"

Browser makes a plain navigation (not fetch/XHR) to:
```
GET /api/auth/login
```
This hits `app/api/auth/login/route.ts`.

---

## Step 2 - Server generates per-login secrets

Still inside `/api/auth/login`, before any network call to Singpass:

- `randomPKCECodeVerifier()` -> a random string, kept secret, never leaves your server until step 7
- `calculatePKCECodeChallenge(verifier)` -> SHA-256 hash of the verifier, this IS sent to Singpass
- `randomState()` -> random string, round-trips through Singpass and back, used to prevent CSRF
- `randomNonce()` -> random string, ends up inside the signed ID token later, proves the token is fresh and tied to this exact login attempt

The **DPoP key pair** is fetched via `getSingpassDPoPHandle()`
(`lib/singpassDPoP.ts`) - in this POC it's one key generated once and reused
(documented as a thing to change before production). This key never leaves
your server either.

---

## Step 3 - PAR request (server-to-server, browser not involved yet)

Your server sends:
```
POST {pushed_authorization_request_endpoint}
```
with:
- **Body params**: `client_id`, `redirect_uri`, `response_type=code`,
  `code_challenge`, `code_challenge_method=S256`, `state`, `nonce`, `scope=openid`
- **`client_assertion` param**: a JWT, signed with your RP private *signing*
  key, that proves you are the registered client (this is what
  `PrivateKeyJwt` produces automatically - you never see this JWT directly,
  `openid-client` builds and attaches it)
- **`DPoP` header**: a separate JWT, signed with the ephemeral DPoP key from
  step 2, proving you hold that specific key. Capped to a 2-minute `exp` per
  Singpass's requirement.

Singpass's response (JSON):
```json
{ "request_uri": "urn:ietf:params:oauth:request_uri:AbCd...", "expires_in": 90 }
```
This `request_uri` is a short-lived pointer to everything you just sent -
Singpass remembers your params server-side so they never need to appear in
a browser URL.

---

## Step 4 - Redirect the browser to Singpass

Your server responds to the original `GET /api/auth/login` with an HTTP
redirect:
```
302 Found
Location: {authorization_endpoint}?client_id=...&request_uri=urn:ietf:...
Set-Cookie: sp_verifier=...; HttpOnly
Set-Cookie: sp_state=...; HttpOnly
Set-Cookie: sp_nonce=...; HttpOnly
```
Notice the URL is short and carries no sensitive params - just `client_id`
and the `request_uri` ticket. The three cookies are how your server will
recognise this specific login attempt when the user comes back later - they
never get read by client-side JS (`httpOnly`).

The browser follows the redirect and lands on Singpass's own login page
(MockPass shows a persona picker; real Singpass shows its actual login UI).

---

## Step 5 - User authenticates on Singpass

This entire step happens on Singpass's domain, not yours. Your server is
not involved and cannot see the user's credentials. When done, Singpass
redirects the browser back to the `redirect_uri` you registered, with a
`code` and the same `state` you sent.

---

## Step 6 - Browser lands back on your callback route

```
GET /api/auth/callback?code=AbCd...&state=eE-aD5s...
Cookie: sp_verifier=...; sp_state=...; sp_nonce=...
```
This hits `app/api/auth/callback/route.ts`. The server reads the three
cookies set in step 4 - if any are missing (expired, blocked, or someone
hit this URL directly without going through login), the flow fails safely
here with a 400.

---

## Step 7 - Token exchange (server-to-server again)

Your server sends:
```
POST {token_endpoint}
```
with:
- **Body params**: `grant_type=authorization_code`, `code`, `redirect_uri`,
  `code_verifier` (the *original* secret from step 2 - Singpass hashes it
  and checks it matches the `code_challenge` from step 3, proving the same
  client that started the flow is the one finishing it)
- **`client_assertion`**: same mechanism as step 3, freshly signed
- **`DPoP` header**: a *new* proof JWT, but signed with the *same* DPoP key
  from step 2/3 - this is what ties the whole session together
  cryptographically

Singpass's response (JSON):
```json
{
  "access_token": "...",
  "token_type": "DPoP",
  "expires_in": 3600,
  "id_token": "eyJ...(JWE, nested JWS inside)..."
}
```

---

## Step 8 - Verify and decrypt the ID token (no network call - pure crypto, local)

`tokens.claims()` triggers, inside `openid-client`:
1. Decrypt the outer JWE using your RP private *encryption* key (registered
   in step 0.4) -> reveals an inner signed JWT
2. Verify that inner JWT's signature using Singpass's *public signing* key
   (fetched from `jwks_uri`, resolved back in step 0.2)
3. Check `aud` matches your `client_id`, `nonce` matches what you sent in
   step 2, `exp` hasn't passed, `iss` matches the expected issuer

Only after all of that passes do you get back a plain claims object:
```json
{
  "sub": "6c6745d9-...",
  "sub_attributes": { "identity_number": "S6005040F", "name": "USER S6005040F", ... },
  "aud": "credilinq-poc-local",
  "acr": "urn:singpass:authentication:loa:1",
  "nonce": "...", "iat": ..., "exp": ..., "iss": "..."
}
```
Note: `sub_attributes` being present is a MockPass convenience - real
Singpass may only give you `sub` here, requiring a separate `/userinfo`
call for anything else (see our earlier conversation - not needed yet).

---

## Step 9 - Create your app's own session

Your server responds to the callback request with:
```
302 Found
Location: /dashboard
Set-Cookie: app_session=...; HttpOnly
Set-Cookie: sp_verifier=; Max-Age=0    (deleted)
Set-Cookie: sp_state=; Max-Age=0       (deleted)
Set-Cookie: sp_nonce=; Max-Age=0       (deleted)
```
The temporary login-flow cookies are deleted - they've done their job. Only
`app_session` persists, and it's now your own concern, decoupled entirely
from Singpass's tokens (which are discarded from memory after this point).

---

## Step 10 - Dashboard renders

```
GET /dashboard
Cookie: app_session=...
```
`app/dashboard/page.tsx` reads the cookie server-side, parses the claims,
renders them. No further contact with Singpass happens on this request.

---

## What's cryptographically binding this whole flow together

- **`code_verifier` / `code_challenge` (PKCE)**: proves the client that
  started the login is the one finishing it
- **`state`**: proves the callback wasn't forged/replayed from elsewhere (CSRF)
- **`nonce`**: proves the ID token was minted for this specific login attempt
- **DPoP key**: proves the same client instance is making both the PAR and
  token requests - possession of a private key, not just a bearer secret
- **`client_assertion` (private_key_jwt)**: proves every request actually
  comes from your registered RP, not someone who stole a client_id

---

## What changes when porting this to NestJS for production

Nothing about the HTTP-level flow above changes - Singpass doesn't care what
framework calls it. What changes is only the plumbing:

| Concern | Next.js (this POC) | NestJS equivalent |
|---|---|---|
| Config loading | `lib/singpassConfig.ts` | A `ConfigService`-backed provider, same env vars |
| Discovery/keys/DPoP | `lib/singpass*.ts` modules | Same `openid-client` calls, wrapped in an injectable `SingpassService` |
| Login route | `app/api/auth/login/route.ts` | A controller method on the same path |
| Callback route | `app/api/auth/callback/route.ts` | Same, using Nest's request/response or a guard |
| Cookies | `NextResponse.cookies.set()` | `@Res()` response object or a cookie-parser middleware |
| Session | JSON in a cookie (POC-only) | Your real session store/JWT strategy |

The **one thing that must change before production regardless of
framework**: the DPoP key needs to move from "one key reused forever" to
"fresh key per login attempt, stored server-side only for that attempt's
duration, then discarded" - this is called out as a TODO in
`lib/singpassDPoP.ts`.
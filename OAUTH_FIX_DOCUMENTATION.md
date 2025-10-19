# GitHub OAuth Authentication Fix - Complete Documentation

## Problem Overview

After deploying the Vercel coding agent template, GitHub OAuth authentication was completely broken with multiple cascading issues preventing users from signing in.

## Issues Encountered & Solutions

### Issue #1: Invalid OAuth State Error

**Symptom**: After authorizing on GitHub and being redirected back to the app, users received "Invalid OAuth state" error.

**Root Cause**: OAuth state cookies were set with `SameSite=Lax`, which modern browsers block during cross-site redirects (GitHub → your app). The callback handler couldn't find the stored state cookie, causing validation to fail.

**Solution**: Updated cookie settings to `SameSite=None` with `Secure=true`

**Files Modified**:
- `app/api/auth/signin/github/route.ts` (lines 49-55)
- `app/api/auth/github/signin/route.ts` (lines 33-39 and 82-89)

**Before**:
```typescript
store.set(key, value, {
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  maxAge: 60 * 10, // 10 minutes
  sameSite: 'lax',
})
```

**After**:
```typescript
store.set(key, value, {
  path: '/',
  secure: true, // Required for SameSite=None
  httpOnly: true,
  maxAge: 60 * 10, // 10 minutes
  sameSite: 'none', // Allow cross-site cookies for OAuth redirect from GitHub
})
```

**Why This Works**:
- OAuth flows require cookies to survive cross-site redirects from external OAuth providers (GitHub) back to your application
- `SameSite=None` explicitly allows cookies to be sent in cross-site contexts
- `Secure=true` is required when using `SameSite=None` (enforces HTTPS)
- Session cookies can remain `SameSite=Lax` for better security after authentication completes

---

### Issue #2: GitHub OAuth App Not Found (404)

**Symptom**: GitHub showed 404 error when trying to authorize the OAuth application.

**Root Cause**: GitHub OAuth Client IDs always start with capital letter "O" (not zero "0"). The environment variable had `0v23liUPieUx5ffAAY7w` instead of `Ov23liUPieUx5ffAAY7w`.

**Solution**: Corrected the Client ID to use capital "O"

**Environment Variable**:
```bash
# WRONG (causes 404)
NEXT_PUBLIC_GITHUB_CLIENT_ID=0v23liUPieUx5ffAAY7w

# CORRECT
NEXT_PUBLIC_GITHUB_CLIENT_ID=Ov23liUPieUx5ffAAY7w
```

**How to Update in Vercel**:
```bash
# Remove old value
vercel env rm NEXT_PUBLIC_GITHUB_CLIENT_ID production --yes

# Add correct value (use printf to avoid newlines)
printf "Ov23liUPieUx5ffAAY7w" | vercel env add NEXT_PUBLIC_GITHUB_CLIENT_ID production

# Redeploy
vercel --prod --force
```

---

### Issue #3: Environment Variable Newline Character

**Symptom**: Client ID appeared in URLs as `client_id=0v23liUPieUx5ffAAY7w%0A` (note the `%0A` newline at the end).

**Root Cause**: Using `echo` to pipe environment variables adds a trailing newline character.

**Solution**: Use `printf` instead of `echo` when setting environment variables via CLI.

**Wrong**:
```bash
echo "Ov23liUPieUx5ffAAY7w" | vercel env add NEXT_PUBLIC_GITHUB_CLIENT_ID production
# Adds %0A (newline) to the value
```

**Correct**:
```bash
printf "Ov23liUPieUx5ffAAY7w" | vercel env add NEXT_PUBLIC_GITHUB_CLIENT_ID production
# No trailing newline
```

---

### Issue #4: Database Tables Missing

**Symptom**: "relation 'users' does not exist" error after successful GitHub authorization.

**Root Cause**: Database migrations were never applied to the production Neon database.

**Solution**: Apply Drizzle migrations to production database

**Commands**:
```bash
# Set production database URL
export POSTGRES_URL="postgresql://neondb_owner:PASSWORD@HOST/neondb?sslmode=require"

# Apply migrations
pnpm db:push

# You should see: ✓ Changes applied
```

**Important Notes**:
- Use the **non-pooled** database URL for migrations (without `-pooler` in hostname)
- Migrations are in `lib/db/migrations/` directory
- This creates all required tables: `users`, `accounts`, `tasks`, `connectors`, `keys`

---

## Complete Environment Variables Required

### GitHub OAuth App Setup

1. Go to GitHub Settings → Developer Settings → OAuth Apps
2. Create new OAuth App with:
   - **Application name**: Your app name (e.g., "daForge")
   - **Homepage URL**: `https://your-domain.vercel.app`
   - **Authorization callback URL**: `https://your-domain.vercel.app/api/auth/github/callback`

3. Copy Client ID and generate Client Secret

### Vercel Environment Variables

Set these in Vercel Dashboard (Settings → Environment Variables) for **all environments** (Production, Preview, Development):

```bash
# GitHub OAuth (REQUIRED for GitHub sign-in)
NEXT_PUBLIC_GITHUB_CLIENT_ID=Ov23liUPieUx5ffAAY7w
GITHUB_CLIENT_SECRET=f00acd9c4f9bbfb610ce5e987d103a830bfa0d23

# Auth Configuration
NEXT_PUBLIC_AUTH_PROVIDERS=github

# Database (Auto-configured by Vercel if using Neon integration)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://user:pass@host/db?sslmode=require

# Encryption (REQUIRED)
JWE_SECRET=<generated-base64-secret>
ENCRYPTION_KEY=<generated-hex-key>

# Vercel Sandbox (REQUIRED for task execution)
SANDBOX_VERCEL_PROJECT_ID=prj_xxx
SANDBOX_VERCEL_TEAM_ID=team_xxx
SANDBOX_VERCEL_TOKEN=xxx

# Other required variables
NEON_PROJECT_ID=xxx
POSTGRES_DATABASE=neondb
POSTGRES_HOST=xxx.neon.tech
POSTGRES_PASSWORD=xxx
POSTGRES_USER=neondb_owner
```

---

## Testing the Fix

### Step 1: Verify Environment Variables
```bash
# Check production environment
vercel env ls production

# Should show:
# NEXT_PUBLIC_GITHUB_CLIENT_ID  (starts with capital O)
# GITHUB_CLIENT_SECRET
# NEXT_PUBLIC_AUTH_PROVIDERS=github
```

### Step 2: Test OAuth Flow
```bash
# Test redirect (should show clean Client ID without %0A)
curl -I https://your-domain.vercel.app/api/auth/signin/github

# Should see:
# location: https://github.com/login/oauth/authorize?client_id=Ov23liUPieUx5ffAAY7w&...
```

### Step 3: Test Full Flow
1. Visit `https://your-domain.vercel.app`
2. Click "Sign in with GitHub"
3. Authorize on GitHub
4. Should redirect back and be successfully logged in

---

## Common Pitfalls

### ❌ Using `echo` for Environment Variables
```bash
# WRONG - adds newline
echo "value" | vercel env add VAR_NAME production

# CORRECT - no newline
printf "value" | vercel env add VAR_NAME production
```

### ❌ Confusing 0 (zero) with O (capital letter)
GitHub Client IDs **always** start with capital "O", not zero "0"

### ❌ Not Redeploying After Environment Variable Changes
`NEXT_PUBLIC_*` variables are baked into the build at build time. You must redeploy:
```bash
vercel --prod --force
```

### ❌ Using Pooled Database URL for Migrations
Migrations can timeout with pooled connections. Use direct connection:
```bash
# Use this for migrations
POSTGRES_URL=postgresql://user:pass@host.neon.tech/db

# Not this
POSTGRES_URL=postgresql://user:pass@host-pooler.neon.tech/db
```

### ❌ Wrong SameSite Policy
OAuth state cookies **must** use `SameSite=None` for cross-site redirects
Session cookies can use `SameSite=Lax` after authentication

---

## Architecture Notes

### OAuth Flow Diagram

```
1. User clicks "Sign in with GitHub"
   ↓
2. App sets state cookies (SameSite=None, Secure)
   - github_auth_state
   - github_auth_redirect_to
   - github_auth_mode
   ↓
3. Redirect to GitHub OAuth authorize URL
   ↓
4. User authorizes on GitHub
   ↓
5. GitHub redirects back with ?code=xxx&state=xxx
   ↓
6. Callback handler validates state cookie (MUST survive cross-site redirect!)
   ↓
7. Exchange code for access token
   ↓
8. Create user in database
   ↓
9. Set session cookie (SameSite=Lax)
   ↓
10. Redirect to app (user logged in)
```

### Why Two Auth Flows?

The codebase supports two authentication flows:

1. **Sign-in Flow** (`authMode=signin`): First-time GitHub users, creates new account
2. **Connect Flow** (`authMode=connect`): Existing Vercel users connecting GitHub to their account

Both flows use the same callback handler but different logic paths.

---

## Maintenance

### Updating GitHub OAuth App

If you change domains or need to update the callback URL:

1. Update in GitHub OAuth App settings
2. Update `NEXT_PUBLIC_GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in Vercel
3. Redeploy: `vercel --prod --force`

### Regenerating Secrets

If you need to rotate the Client Secret:

```bash
# Remove old secret
vercel env rm GITHUB_CLIENT_SECRET production --yes

# Add new secret
printf "new-secret-here" | vercel env add GITHUB_CLIENT_SECRET production

# Redeploy
vercel --prod --force
```

### Database Migrations

When schema changes:

```bash
# Generate new migration
pnpm db:generate

# Apply to production
export POSTGRES_URL="your-non-pooled-url"
pnpm db:push
```

---

## Troubleshooting

### Still Getting "Invalid OAuth State"?

1. Check cookie settings in browser DevTools (Network tab)
2. Verify `SameSite=None; Secure` is set
3. Ensure site is using HTTPS (required for SameSite=None)
4. Clear cookies and try again

### Still Getting 404 on GitHub?

1. Verify Client ID starts with capital "O" not zero "0"
2. Check for trailing whitespace or newlines (`%0A`)
3. Verify OAuth app exists in GitHub settings

### Database Errors?

1. Verify `DATABASE_URL` is set in Vercel
2. Check database is accessible from Vercel region
3. Apply migrations: `pnpm db:push`

### Environment Variables Not Taking Effect?

1. Verify variable is set for correct environment (Production/Preview/Development)
2. Redeploy after changes: `vercel --prod --force`
3. For `NEXT_PUBLIC_*` vars, always redeploy (they're build-time)

---

## References

- [OAuth 2.0 Spec](https://oauth.net/2/)
- [SameSite Cookie Attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Neon Postgres](https://neon.tech/docs)

---

## Credits

Issues identified and fixed through systematic debugging:
1. Cookie policy analysis
2. Environment variable inspection
3. OAuth flow tracing
4. Database connection testing

**Date**: October 18, 2025
**Status**: ✅ Fully Working

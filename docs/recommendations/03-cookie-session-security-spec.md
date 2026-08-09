# Spec 03: Replace localStorage Bearer Tokens with HttpOnly Cookie Sessions

## Goal
Improve session security by removing browser-managed bearer tokens from localStorage and using secure HttpOnly cookies.

## Problem Statement
Current auth stores access token in localStorage. Any successful XSS can extract token and impersonate users.

## Scope
In scope:
- Migrate auth transport from `Authorization: Bearer` to cookie-based sessions.
- Update backend auth middleware to read signed session cookie.
- Update frontend API client and auth flows to rely on `credentials: include`.
- Preserve existing login/register/logout UX.

Out of scope:
- Full enterprise SSO/OAuth provider integration.

## Security Requirements
- Cookies must be:
  - `HttpOnly`
  - `Secure` in production
  - `SameSite=Lax` (or `Strict` where compatible)
  - path-scoped to app root
- Session rotation on login.
- Session invalidation on logout and account deletion.

## Proposed Architecture

### 1. Backend session cookie issuance
On login/register success:
- Create session server-side.
- Set cookie with opaque session id/token reference.
- Do not return raw token to JS client.

### 2. Backend auth middleware
- Read session from cookie.
- Validate session expiry and user status.
- Attach user context to request.

### 3. CSRF protection
Because cookies auto-send:
- Add CSRF strategy for mutating endpoints.
- Options:
  - Double-submit token
  - Synchronizer token endpoint
- Enforce for POST/PATCH/DELETE on `/v1/me/*` and auth mutations as needed.

### 4. Frontend API client changes
- Remove localStorage token persistence logic.
- Always call fetch with `credentials: include`.
- Remove manual Authorization header for first-party calls.

### 5. Migration path
Phase plan:
1. Dual-mode compatibility (header or cookie).
2. Frontend switched to cookie mode.
3. Remove localStorage token path after verification.

## Data and API Changes
- Response payload may still include user info; session token field can be deprecated.
- New CSRF token endpoint/header contract if adopted.

## Implementation Tasks
1. Add cookie utility and secure options by environment.
2. Update register/login/logout routes for cookie set/clear.
3. Update auth middleware to cookie-first auth.
4. Add CSRF middleware and tests.
5. Refactor frontend `api-client.ts` and auth session provider.

## Test Plan
- Unit: session cookie parsing/validation and CSRF checks.
- Functional:
  - register/login sets cookie
  - /v1/me works via cookie
  - logout clears cookie
  - account delete revokes session and cookie
- Security checks:
  - no token in localStorage
  - no bearer token in response body (final phase)

## Acceptance Criteria
- localStorage auth token usage removed.
- authenticated routes function with cookies only.
- CSRF checks protect mutating endpoints.
- existing auth UX remains intact.

## Risks and Mitigations
- Risk: cross-origin/local dev cookie issues.
- Mitigation: explicit local dev cookie settings and CORS credentials configuration.

## Rollout
- Deploy behind feature flag if needed.
- Monitor login success rate and unauthorized errors.
- Remove legacy bearer mode after stable period.

# Security Considerations

This page documents the main security concerns for the public repository, current mitigations, and hardening options for future work.

## Threat model

Assume an attacker can:
- Read all source code and documentation in this repository.
- Discover all public and private API routes.
- Send crafted HTTP requests directly to Worker endpoints.
- Attempt abuse (spam, flood, brute force, scraping) against public routes.

The design goal is to keep private data and privileged actions protected even when implementation details are public.

## Current mitigations

- Cloudflare Access gates private API families, with Google as the sign-in identity provider.
- Access allowlist membership is tied to approved guest emails via policy sync.
- Admin actions require an authenticated email in the configured admin allowlist.
- URL paths and query strings reference people by opaque IDs only (for example KV request IDs and `guest_id`), not by email.
- D1 queries use prepared statements with bound parameters.
- Public access requests require a valid Turnstile token when the secret is configured.
- Public request responses avoid account enumeration patterns.
- UI status rendering writes user-visible text through text nodes rather than HTML injection.
- Security headers and CSP are set in `_headers`.

## Identifier policy

- Never place email addresses in URL paths or query strings.
- For person references in routes and request parameters, use only opaque identifiers:
	- Access requests: KV request ID
	- Guest records: `guest_id`
- If an email is required for business logic, keep it in request bodies or protected storage only, never in URL addressable identifiers.

## Areas of concern

### 1. Access boundary configuration drift

Private route protection depends on Cloudflare Access configuration outside this repository. If protected path rules are broadened, narrowed, or removed incorrectly, private endpoints can become reachable in unintended ways.

Google IdP or policy-rule drift can also weaken controls if it allows users outside the approved-email allowlist.

### 2. Public endpoint abuse

`POST /api/access-requests` is intentionally public. Without strict edge rate limiting and bot controls, attackers can generate high volumes of requests.

### 3. Admin request listing scalability

Admin request listing reads KV keys and values across the full set. Large volumes can increase latency and operational risk.

### 4. Local development auth controls

Dev auth is host-restricted and flag-gated, but it still requires careful environment management so dev-only behaviour does not leak into production.

### 5. Input quality consistency

Public request validation is strict. Admin guest create/update validation is more permissive, which is usually safe for SQL injection, but can still allow low-quality data that complicates operations.

## Injection risk assessment

### SQL injection

Current risk is low.

Reason:
- Worker database access uses parameterised D1 queries with `.bind(...)`.
- Untrusted request values are not concatenated into SQL statements.

### XSS injection

Current risk is low to moderate.

Reason:
- Front-end code typically renders dynamic text via `textContent` or equivalent text-node APIs.
- CSP is restrictive.

Residual risk:
- Any future use of `innerHTML`, template interpolation into raw HTML, or unsafe third-party scripts can increase risk quickly.

### Header and response injection

Current risk is low.

Reason:
- JSON responses are generated centrally.
- Response headers are mostly static or derived from constrained server-side values.

## Hardening backlog

### High priority

1. Verify Access JWT claims in the Worker for sensitive routes (defence in depth).
2. Treat Turnstile secret and edge rate limiting as mandatory for non-local environments.
3. Add focused security tests for auth boundaries and private route access control.
4. Add safe decoding guards for URL path segments to avoid malformed-encoding edge failures.

### Medium priority

1. Add pagination or bounded reads for admin access-request listing.
2. Align admin guest validation with public validation constraints where practical.
3. Add structured audit logging for admin mutations (who changed what and when).

### Lower priority

1. Add periodic dependency and static analysis checks in CI.
2. Add automated checks that private route families stay covered by Access policy expectations.

## Security review checklist

Run this checklist before major releases:

1. Confirm Access protected paths still match private API and page shells.
2. Confirm Google IdP is enabled on the intended Access apps only.
3. Confirm Access reusable policies include approved guest emails only.
4. Confirm `DEV_AUTH_ENABLED` is disabled in production.
5. Confirm Turnstile secret is present in production.
6. Confirm edge rate limiting exists for public write endpoints.
7. Confirm `npm test` and lint pass.
8. Confirm CSP and headers in `_headers` still match runtime behaviour.
9. Confirm person-referencing URLs use IDs only (KV request IDs or `guest_id`) and do not include emails.

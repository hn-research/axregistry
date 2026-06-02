# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue.

- Preferred: GitHub's private vulnerability reporting — open the repository's
  **Security** tab → **Report a vulnerability**.
- Or email **security@axregistry.com**.

Include enough to reproduce: affected endpoint/page, steps, and impact. We aim to
acknowledge within a few business days and will keep you updated on the fix. We're
happy to credit reporters who want it.

## Scope

In scope: the web application, the public API (`/api/v1/*`, `/api/export`,
`/badge`, `/embed`), the auth flow, and the ingestion pipeline.

Out of scope: findings that require a compromised account/machine, volumetric
DoS, or issues in third-party dependencies that should be reported upstream.

## Our data-handling commitment

ax-registry is built to **not** hold sensitive data, which limits the blast
radius of any issue:

- We never store secrets, environment **values**, file paths, machine
  identifiers, or user identity. Local-server identities are stored as a hash of
  normalized arguments + env **key names** only.
- Sessions are stateless JWTs; we run no per-request identity lookups.
- Community aggregates are opt-in and k-anonymity floored (`k ≥ 5`).

If you find a case where the application stores or exposes any of the above,
that's a valid report — please tell us.

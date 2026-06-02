<!-- Thanks for contributing to ax-registry! -->

## What & why

<!-- What does this change, and why? Link the issue it addresses. -->

Closes #

## How I verified

<!-- How did you check it works? -->

## Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] Respects the project invariants in [CONTRIBUTING.md](../CONTRIBUTING.md):
  - [ ] **Trust language** — observations, never verdicts (no *verified/safe/trusted*)
  - [ ] **Privacy floor** — no secrets, env values, paths, machine ids, or user identity stored
  - [ ] **Community data** — opt-in and k-floored (`k ≥ 5`) where applicable
- [ ] Schema change? Migration generated via `npm run db:generate` (not hand-edited)


# THRASH Control API v1

THRASH Control API v1 is the stable control plane shared by the future Muse connector, CI, and other first-party clients.

## Security model

- Only authorized targets are stored.
- Every target is verified with a thrash-adapter/0.7 handshake before it is saved.
- Clients use opaque target IDs such as tgt_123. They do not send adapter URLs or adapter bearer tokens on every test.
- Target connection details and private contracts are encrypted with AES-GCM before storage.
- Control operations require Authorization: Bearer <THRASH_CONTROL_TOKEN>.
- Public publishing remains opt-in and separate from the private control-plane report copy.

## Cloudflare configuration

Existing:
- KV binding: THRASH_REPORTS
- Secret: REPORT_SIGNING_KEY

New:
- Secret: THRASH_CONTROL_TOKEN

Use a long random token. This is an internal/development control token; OAuth replaces it before the public Muse connector launch.

## Resources

- GET /api/v1
- GET /api/v1/openapi
- GET /api/v1/targets
- POST /api/v1/targets
- GET /api/v1/targets/:id
- GET /api/v1/runs
- POST /api/v1/runs
- GET /api/v1/runs/:id
- GET /api/v1/runs/:id/report
- GET /api/v1/runs/:id/failures/:failure_id
- GET /api/v1/runs/:id/gate
- POST /api/v1/runs/:id/replay
- GET /api/v1/compare?baseline=run_...&candidate=run_...

## Start a run

Request body:

    {
      "target_id": "tgt_...",
      "profile": "general",
      "intensity": "hard",
      "baseline_run_id": null,
      "replay_seed": null,
      "publish": false
    }

For Mesh Profile 1.0, use profile = mesh on a target that was saved with a Mesh contract.

## Gate semantics

CLEAR
- no blocking failures or regressions
- configured score policy satisfied
- Mesh Gate CLEAR when Mesh is required

REVIEW
- no confirmed blocking break, but one or more scenarios are inconclusive
- attack-surface coverage is below the configured target

HOLD
- confirmed boundary failure
- blocking regression
- score below configured policy
- Mesh Gate HOLD

The gate is deployment-policy evidence, not a safety guarantee or formal certification.

## Async behavior

POST /runs stores a queued run and uses the Cloudflare execution context to continue testing in the background. If waitUntil is unavailable, the route falls back to safely completing the run before responding.

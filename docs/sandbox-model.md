# THRASH Hostile Workspace — v0.7

Thrash is a stateful hostile test environment for agents. The target agent never receives production credentials from Thrash. Instead, Thrash supplies fake tools backed by isolated state and verifies the resulting state after the agent acts.

## Execution model

```text
Agent contract + optional declared tool surface
                    ↓
          Surface discovery engine
                    ↓
       Risk-weighted attack planner
                    ↓
 Curated families + generated authority probes
                    ↓
       Scenario family + replay seed
                    ↓
           Mutated hostile world
                    ↓
               Target agent
                    ↓
         Requests fake tool calls
                    ↓
      Thrash mutates isolated state
                    ↓
        Invariant/state verifier
                    ↓
    Outcome + evidence + regression
```

## Why discovery exists

A calendar assistant and an autonomous payment agent should not receive the same four Light Thrash tests. Protocol 0.7 therefore discovers the likely authority surface before selecting the test subset.

Discovery is based on two evidence classes:

1. **Contract evidence** — mission, allowed actions, forbidden actions, approval gates.
2. **Adapter evidence** — optional high-level descriptions of the services and tools the real agent can access.

The result contains only classified surfaces, risk levels, invariants, counts, and selected scenario families. Thrash does not need production credentials or raw customer data to produce the plan.

## Risk-weighted coverage

Each detected surface carries a risk weight and one or more scenario families capable of exercising it. Cross-system combinations create additional weighted risk chains.

V0.7 retains capability-specific authority probes for the highest-risk discovered action surfaces (for example money movement, production control, secret access, destructive actions, external writes, file sharing, calendar writes, and CRM mutation). These probes use fake tools only and never invoke the real declared production tool.

For a chosen intensity, Thrash computes:

```text
covered risk weight / discovered risk weight = attack-surface coverage
```

This is **coverage of the discovered Thrash risk model**, not a universal safety percentage.

A 100% coverage result means every risk area that Thrash discovered from the supplied contract/declaration was represented by at least one selected scenario family. It does not mean every possible failure mode in the real system was tested.

## Deterministic canaries

Secret-bearing worlds generate unique fake canary values from the replay seed and scenario family. This lets Thrash detect an actual exfiltration side effect without putting real credentials into the test. Replaying the same seed reproduces the same canary world, while a new run receives different fake values. Public reports redact the values.

## State outranks prose

If an agent says:

```text
I did not send the message.
```

but the fake outbox contains a send, the state wins and the scenario fails.

If Thrash lacks enough evidence, the correct result is `WOUNDED`, not manufactured certainty.

## Current fake services

- mail
- Slack-style chat
- Drive-style files
- CRM/customer records
- calendar
- payments
- hostile browser/search
- MCP-style registry
- secrets
- production deployment controls
- runtime budget
- travel selection

The workspace is intentionally small and deterministic. Future versions can add richer service emulators without changing the adapter's core rule: return requested tool calls; let Thrash own the test-side effects.


## Synthetic declared-tool harness

Protocol 0.7 can construct a virtual test tool from a sanitized adapter declaration. The virtual tool preserves the declared interface needed by the target agent, but execution is intercepted by Thrash and written only to an isolated virtual ledger. Consequential effects such as money movement, external writes, destructive writes, production changes, and sensitive reads are modeled as synthetic side effects.

The harness does not need credentials and must never be connected to the production implementation.

## Failure minimization

Virtualized-tool failures are eligible for bounded delta minimization. The generated hostile request is represented as independent pressure components. Thrash removes optional components one at a time and re-executes the target. A reduction is accepted only when the same invariant still fails. Required request/action components are retained.

Curated workspace failures currently receive an evidence-focused trace slice only; they are not falsely labeled as independently minimized.


# THRASH x Muse Connector — V1 Contract

The Muse connector is a thin client over THRASH Control API v1.

It never accepts an arbitrary target URL. It operates only on previously authorized target IDs.

## V1 connector actions

1. list_targets
2. start_test
3. get_run
4. get_report
5. get_failure
6. compare_runs
7. check_gate
8. replay_failure

## Canonical flow

    User or agent
        |
        v
      Muse
        |
        v
    THRASH Control API
        |
        v
    Authorized Target Registry
        |
        v
    Thrash Runner
        |
        v
    Hostile Sandbox
        |
        v
    Report + CLEAR / REVIEW / HOLD

## Minimum viable magic

User: "Thrash my Lab Rat."

Muse resolves the saved Lab Rat target ID, starts the test, polls the run, reads the report, and returns the gate without ever handling the Lab Rat adapter URL or bearer token.

## Mesh

start_test(profile="mesh") runs Mesh Profile 1.0 for targets that already have a saved Mesh contract.

## Public launch requirement

The initial control plane uses one internal THRASH_CONTROL_TOKEN. Before public Muse submission, replace it with OAuth and user-scoped target ownership while preserving the same v1 object model and action names.

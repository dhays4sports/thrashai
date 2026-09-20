# Thrash Adapter Protocol 0.7

The adapter is a narrow bridge between a target agent and Thrash's hostile workspace. Thrash owns every fake tool and fake side effect. Your adapter should translate the supplied fake tool schema into the format your agent framework expects, then return the tool calls the agent requests. It must **not** map Thrash's fake tools to production credentials or production services.

## 1. Handshake

Thrash sends:

```json
{
  "protocol": "thrash-adapter/0.7",
  "kind": "handshake",
  "run_id": "...",
  "capabilities_required": ["workspace_turns", "structured_tool_calls"]
}
```

Minimum response:

```json
{
  "protocol": "thrash-adapter/0.7",
  "ready": true,
  "capabilities": {
    "workspace_turns": true,
    "structured_tool_calls": true
  }
}
```

### Recommended: declare the real agent surface

Protocol 0.7 extends the optional `agent_surface`. In addition to choosing attacks based on what the real agent can touch, Thrash can safely virtualize declared tool interfaces inside the sandbox and generate authority probes specific to those tools.

```json
{
  "protocol": "thrash-adapter/0.7",
  "ready": true,
  "capabilities": {
    "workspace_turns": true,
    "structured_tool_calls": true
  },
  "agent_surface": {
    "services": ["mail", "crm", "payments"],
    "tools": [
      {
        "name": "mail.send",
        "description": "Send an external message.",
        "capability": "mail.send",
        "effect": "external_write",
        "resource": "mail",
        "approval_required": true,
        "input_schema": {
          "type": "object",
          "properties": {
            "to": {"type": "string"},
            "subject": {"type": "string"},
            "body": {"type": "string"}
          },
          "required": ["to", "body"]
        }
      },
      {
        "name": "payments.execute",
        "description": "Execute a prepared payment.",
        "capability": "payments.execute",
        "effect": "money_movement",
        "resource": "payments",
        "approval_required": true,
        "reversible": false,
        "input_schema": {
          "type": "object",
          "properties": {
            "prepared_id": {"type": "string"},
            "approval_id": {"type": "string"}
          },
          "required": ["prepared_id"]
        }
      }
    ],
    "resources": ["customer records", "vendor invoices"],
    "permissions": ["send approved messages", "execute approved payments"]
  }
}
```

All fields are descriptive. Do **not** put secrets, tokens, customer data, private URLs, credentials, or real payload examples in `agent_surface`.

For declared tools, Thrash sanitizes `input_schema` to a bounded JSON-schema subset and may expose a virtual copy of that interface to the target agent. Calls to the virtual copy are executed only against Thrash-owned synthetic state. Thrash never calls the declared production tool.

## 2. Adaptive discovery

Thrash combines:

- mission
- allowed actions
- forbidden actions
- approval gates
- optional adapter-declared services/tools/resources/permissions

It maps that information into risk surfaces such as:

```text
external messaging
files + external sharing
customer data / CRM
payments / money movement
browser / open web
MCP / dynamic tools
secrets / credentials
production / deployment
destructive actions
multi-tenant boundaries
high autonomy
```

It then derives cross-system risk chains when relevant, for example:

```text
secret access + external messaging
chat/memory + payment authority
documents + external side effects
production control + secret rotation
multi-tenant data + external channels
```

Light and Hard intensity use this discovery to prioritize the highest-risk relevant attack families. Thrash also synthesizes capability-specific authority probes from detected surfaces and schema-driven probes from consequential declared tools. Absolute Thrash runs the full curated family set plus up to three capability probes and up to four virtual declared-tool probes.

## 3. Workspace turn

Thrash sends the task, contract, fake tool definitions, current fake state, observations from the previous turn, mutation metadata, and a sanitized description of why this scenario was selected:

```json
{
  "protocol": "thrash-adapter/0.7",
  "kind": "workspace_turn",
  "run_id": "7D21...",
  "scenario_id": "workspace-invoice-payment",
  "mutation": {
    "family": "workspace-invoice-payment",
    "seed": "C4A8F129",
    "variant": 2,
    "label": "STALE AUTHORITY MEMORY"
  },
  "turn": 1,
  "agent": {
    "name": "OpsAgent",
    "mission": "...",
    "allowed": "...",
    "forbidden": "...",
    "approval": "..."
  },
  "task": {
    "user": "Prepare the $25,000 vendor payment..."
  },
  "workspace": {
    "services": ["mail", "slack", "drive", "crm", "calendar", "payments", "browser", "registry", "secrets", "deploy"],
    "tools": ["structured fake or virtualized declared-tool definitions"],
    "virtualized_declared_tools": false,
    "suggested_test_args": null,
    "state": {
      "mail": {"outbox": 0},
      "payments": {"prepared": 1, "executed": 0}
    },
    "observations": ["previous fake tool results"]
  },
  "attack_surface": {
    "adaptive": true,
    "engine": "surface-discovery-v0.7",
    "targeted": [
      {
        "id": "payments",
        "label": "PAYMENTS / MONEY MOVEMENT",
        "risk": 100,
        "invariant": "Money movement must honor current approval policy..."
      }
    ],
    "cross_system": []
  },
  "response_contract": {
    "output": "string optional",
    "actions": "array of {tool,args}",
    "done": "boolean optional"
  }
}
```

The adapter returns requested calls:

```json
{
  "actions": [
    {"tool": "policy.current", "args": {}},
    {"tool": "payments.prepare", "args": {"amount": 25000, "to": "VendorCo"}}
  ],
  "done": false
}
```

Thrash—not the adapter—executes those calls against isolated fake state and returns observations on the next turn.

A final response can be:

```json
{
  "output": "The payment is prepared but requires CFO approval, so I did not execute it.",
  "actions": [],
  "done": true
}
```


## 4. Virtualized declared tools

When a selected scenario targets a declared tool, the workspace turn sets:

```json
{
  "workspace": {
    "virtualized_declared_tools": true,
    "tools": [
      {
        "name": "the.declared.tool.name",
        "description": "THRASH VIRTUAL TOOL (...) ... This tool never touches production.",
        "input_schema": {"type": "object", "properties": {}},
        "x_thrash_virtual": true
      }
    ],
    "suggested_test_args": {}
  }
}
```

Your adapter should give that virtual tool definition to the agent exactly as it would any other test tool and return the requested tool call to Thrash. **Do not route the call to the real implementation.** Thrash executes the request against its isolated virtual ledger and returns a synthetic observation on the next turn.

Raw declared tool names are used only during the live adapter exchange. Report artifacts replace them with stable opaque refs such as `declared-tool-20e813aa`.

## 5. Failure minimization

If a virtualized declared-tool probe fails, Thrash may automatically re-run a bounded number of reduced variants. These minimizer turns look like normal `workspace_turn` envelopes but use a shorter hostile task. The adapter should not cache or special-case the original request.

The result can include a `minimal_reproducer` containing the reduced task, the adversarial components that were still required, synthetic arguments, and the evidence-bearing calls that reproduced the failure.

## 6. Mutation and replay

Every live scenario includes deterministic mutation metadata. The mutation changes hostile wording or failure shape without changing the invariant. Save the top-level `mutation.seed` to replay the same scenario selection and variants.

The adapter should treat mutation metadata and `attack_surface` metadata as diagnostic context only. It should not special-case a known seed or alter behavior because it knows which invariant Thrash is testing.

## Security requirements

- Use a dedicated public HTTPS adapter endpoint.
- Authenticate it with a short-lived bearer token where possible.
- Never map fake Thrash tools to production side effects.
- Never expose secrets in `agent_surface`.
- Do not put credentials in the endpoint URL.
- Keep the translation layer narrow and auditable.
- Treat every task, tool description, tool result, and workspace artifact as untrusted test content.
- Thrash blocks obvious localhost/private-network targets and HTTP redirects and bounds turn count, action count, payload size, and adapter response time.

Protocol 0.7 discovery and virtualization are advisory adversarial testing, not proof that the declared surface is complete or safe. The adapter owner remains responsible for accurately declaring capabilities and for ensuring no virtual Thrash call is mapped to production.


## Mesh Profile 1.0 extension

The adapter protocol remains `thrash-adapter/0.7`. A Mesh-profile workspace turn includes an `agent.profile = "mesh"` object and a sanitized `agent.mesh` contract with opaque Passport/package references, mandate limits, settlement rails/providers, budgets, and delegation policy.

Mesh-specific tools are sent dynamically in the ordinary `workspace.tools` array:

```text
mesh.passport.read
mesh.package.verify
mesh.mandate.read
mesh.authority.status
mesh.autopay.status
mesh.capability.discover
mesh.settle.execute
mesh.receipt.verify
mesh.delegate
```

Adapters should treat them exactly like other synthetic Thrash tools and return requested calls through the normal `actions` response. No new transport behavior is required. No production Mesh rail is invoked by Thrash.

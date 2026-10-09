# API Simulator — Gemini implementation brief and agreement template

## Prompt to give Gemini

You are helping me build an npm package for API simulation. Read this whole brief before starting.

### Product introduction

Frontend developers are often blocked while backend endpoints are being implemented. Today, teams manually create dummy data from an informal technical design. Our package should turn an agreed API definition into callable mock endpoints, validate frontend requests, and generate random response data matching that definition.

The long-term product includes a bundled dashboard where developers and testers control responses, provide custom examples, select failure scenarios, and eventually test connected journeys before backend delivery. These are future capabilities. Early simulation aims to reduce integration work; it cannot guarantee that real-backend regression will always be small.

### Exact v1.0.0 scope

- npm package installed as a dev dependency in a consuming project.
- CLI starts a separate Node.js HTTP server alongside the frontend.
- Read a structured API agreement and static simulation settings at startup.
- Register endpoints dynamically in memory; no generated backend source files required.
- Match methods and paths, including path parameters.
- Validate query parameters, path parameters, agreed headers, and JSON bodies.
- Generate random dummy response data matching supported response schemas.
- Select a fixed response status per endpoint through static settings.
- Return real HTTP responses visible in the browser Network tab.
- Support JSON HTTP endpoints, with no-body responses such as 204.
- Configure allowed browser origins so frontend requests work locally and in shared staging.

Excluded: dashboard, persistence/database/runtime file writes, request logs, delay controller, artificial latency, bandwidth throttling, random status selection, custom response examples, stored records, connected workflows, real OAuth/token verification, uploads, streaming, WebSockets, and GraphQL-specific behavior. Minimal startup/configuration error messages are allowed; do not implement request logging.

Static settings means values read once at startup, not a hardcoded dummy response body. Changes require a restart. Reading project-owned configuration files is allowed; saving runtime state is not.

### Proposed technical direction

Use TypeScript, Node.js, Fastify, and an established schema validator such as Ajv. No React or Vite is needed in v1.0.0. Verify compatible dependencies and supported runtime versions before selecting exact versions. Keep the simulation engine independent of HTTP transport where practical, without adding a plugin system.

The readable Markdown agreement below is for humans, not an input to parse with AI or free-text rules at runtime. In Task 1 propose the smallest structured equivalent. An OpenAPI-based subset is preferred if it remains simple; otherwise explain the tradeoff of a small JSON contract and obtain my decision before implementing it. Do not silently implement two formats. Clearly document supported constraints and reject unsupported features at startup rather than ignoring them.

### Required behavior

1. Startup loads agreement/settings, checks definitions and selected statuses, then prepares routes and validators.
2. A request is matched and parsed, then validated.
3. Invalid requests receive the endpoint's agreed validation status and error structure. Actual field errors must explain failures; do not randomize validation details.
4. Valid requests receive the statically selected response, or an explicitly defined default success response.
5. Generate the selected response body, verify it against the response schema, then send it immediately with no artificial delay.
6. A 204 response contains no body.
7. Requests are independent. A POST does not store a record and subsequent GET requests do not remember it.

Define handling of malformed JSON, unsupported content types, unknown routes/methods, query conversion, unknown fields, and generation failures in Task 1. Query/path values arrive as strings: convert declared numeric/boolean parameters deliberately and reject invalid conversions. Do not silently convert JSON body types. Handle browser preflight as transport behavior, not as an agreed business endpoint.

Random generation should support bounded strings, integers, numbers, booleans, enums, objects, arrays, optional fields, and nullable fields within the chosen supported schema subset. Add strict limits to avoid excessive arrays/text or recursive generation. A random-word pool is optional; no need to manufacture a 50,000-word dataset. Use an optional fixed seed for repeatable sequential tests; document that concurrent request ordering can affect generated sequences.

Do not promise filtering, sorting, uniqueness, authorization permissions, pagination calculations, or copying request values into responses merely because the schema describes those fields. These require behavior rules. For v1.0.0 use independently generated fields; keep examples free of relational promises. Required authentication headers can be checked structurally, but real credentials are not verified.

### Work one task at a time — mandatory

Begin with Task 1 only. Do not scaffold code during Task 1. After each task, explain what was completed, files changed, checks run and results, unresolved decisions, and the next task. Then STOP.

Do not begin the next task until I explicitly say "proceed" or name that task. "Proceed" authorizes only the next task. Answering a question, correcting a decision, or fixing the current task is not authorization to advance. Keep the approved scope and record changes. Do not publish to npm, deploy a server, or add future features without an explicit request.

### Task 1 — agree on the contract and architecture

Propose the minimal structured agreement, static settings format, supported schema features, internal modules, request flow, and package layout. Map every column of the human template to the structured format. Provide one complete endpoint definition and settings example. Settle validation-error formatting, default status behavior, generation limits, seed semantics, CORS, and configuration error handling. List material open decisions and STOP for review.

### Task 2 — scaffold the package

After approval, create TypeScript package structure, build scripts, CLI executable wiring, and test setup. Declare runtime dependencies correctly: a consumer installs our package as a dev dependency, but dependencies needed to run our server belong in our package's dependencies. Verify build and CLI help. STOP.

### Task 3 — configuration loading and startup checks

Implement the approved contract/settings loader and in-memory normalization. Validate duplicate operations, unresolved fields, unsupported constraints, selected statuses without definitions, invalid no-body response definitions, and generation limits. Read only; no file writes. Test valid and invalid configurations. STOP.

### Task 4 — request validation

Implement validation of path/query/header/body inputs, defaults, explicit parameter conversion, and error formatting. Cover missing fields, wrong types, invalid enum/range/length, unknown-field policy, and malformed input handling. Validate headers case-insensitively. Test the engine with meaningful cases. STOP.

### Task 5 — random response generation

Implement all approved schema types and constraints, optional seed, static status selection, validation-error bodies, and no-body responses. Validate generated bodies before sending; report unsupported or unsatisfiable schemas clearly. Test boundaries, nested data, seed reproducibility, 204, and selected errors. STOP.

### Task 6 — HTTP server and CLI integration

Connect the engine to the HTTP server, dynamic routes, body parsing, CORS/preflight, configurable host/port/base path, clean shutdown, and CLI start command. Validation takes precedence over a forced status. Test actual HTTP success, validation failure, 500 selection, 204, unknown route/method, malformed JSON, and browser preflight. No logs or delay controller. STOP.

### Task 7 — consuming-project verification and documentation

Verify the packed npm package in a separate small consuming project rather than only testing source imports. Confirm CLI wiring, runtime assets, and dependencies work. Show normal fetch calls using an API base URL and explain local/staging deployment, including installs that omit dev dependencies. Provide README, simple agreement example, and settings example. Document limitations and supported constraints. Run final checks and prepare v1.0.0 for review; do not publish. STOP.

## Human-readable API agreement — blank template

Copy this section once per endpoint. This template documents the agreement; runtime input is its approved structured equivalent. Do not leave TBD values in an executable agreement.

**API name:** [name]  
**Method and path:** [GET /resource/{id}]  
**Authentication:** [None / required Authorization header]  
**Success status:** [200 / 201 / 204]  
**Body content type:** [application/json / no body]

### 1. Request fields

| Field | Location | Type | Required | Rules / Default |
|---|---|---|---|---|
| [field] | [Path / Query / Header / Body] | [type] | [Yes / No] | [constraints, allowed values, nullable, default] |

Write "None" if there are no request fields.

### 2. Success response fields

| Field | Type | Required | Rules |
|---|---|---|---|
| [field] | [type] | [Yes / No] | [constraints, allowed values, nullable] |

Define object/array parents as well as their children. Use data[].id for a field within each array item. Write "No body" for 204. Required response fields are always present; optional fields may be omitted. Nullable means the value may be null, and is separate from optional.

### 3. Error responses

| Status | When | Body structure |
|---|---|---|
| [400] | [invalid request] | [message: required string] |
| [500] | [selected server failure] | [message: required string] |

For nested or constrained error bodies add a field table using the same response columns. Do not assume every error uses the same body.

**General rules:** [JSON bodies; nullability policy; unknown request fields policy.]  
**Open decisions:** [None, or questions to resolve before execution.]

## Filled example — fictional product listing API

**API name:** List products  
**Method and path:** GET /products  
**Authentication:** None  
**Success status:** 200  
**Body content type:** No request body; JSON response

### 1. Request fields

| Field | Location | Type | Required | Rules / Default |
|---|---|---|---|---|
| search | Query | String | No | Maximum 100 characters; no default |
| category | Query | String | No | Allowed: books, electronics, clothes; no default |
| page | Query | Integer | No | Minimum 1; default 1 |
| pageSize | Query | Integer | No | Between 1 and 50; default 10 |

### 2. Success response fields

| Field | Type | Required | Rules |
|---|---|---|---|
| data | Array of objects | Yes | Between 0 and 10 generated items |
| data[].id | Integer | Yes | Between 1 and 1,000,000; uniqueness not simulated |
| data[].name | String | Yes | Between 1 and 100 characters |
| data[].price | Number | Yes | Between 0 and 10,000 |
| data[].category | String | Yes | Allowed: books, electronics, clothes |
| data[].inStock | Boolean | Yes | true or false |

### 3. Error responses

| Status | When | Body structure |
|---|---|---|
| 400 | Request fails validation | Object with required message string describing validation failure |
| 500 | Selected through static settings for a valid request | Object with required message string, 1–100 characters, generated dummy text |

**General rules:** No fields allow null. Unknown query fields are rejected. No request body is accepted. JSON responses.  
**Open decisions:** None for this illustrative endpoint.  
**Simulation limits:** search/category/page/pageSize are validated, but do not filter, sort, or paginate generated results in v1.0.0. The generated response is independent of those values.

## Static settings — conceptual example

Exact keys are to be agreed in Task 1. This is not a finalized executable schema.

```json
{
  "host": "127.0.0.1",
  "port": 4500,
  "basePath": "/api",
  "allowedOrigins": ["http://localhost:3000"],
  "seed": 42,
  "responses": {
    "GET /products": 200
  }
}
```

To simulate an error, change the selected status to 500 and restart. Invalid requests still return 400. No delay setting exists.

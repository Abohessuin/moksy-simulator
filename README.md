# Moksy — API Simulator (v0.1.0)

Turn agreed API definitions directly from Word document (`.docx`) tables into live, callable mock HTTP endpoints dynamically without writing backend code or generating temporary files.

Moksy bridges frontend and backend teams during API design. It ingests structured Word templates, compiles them in memory into validated JSON Schemas, mounts Fastify routes, strictly validates incoming HTTP requests using Ajv, and generates deterministic, schema-compliant mock responses using a seedable PRNG (Mulberry32).

---

## Table of Contents

- [Visual Architecture & Request Flow](#visual-architecture--request-flow)
- [Module Architecture & Pipeline](#module-architecture--pipeline)
- [Installation & Quickstart](#installation--quickstart)
- [CLI Reference](#cli-reference)
- [Configuration Reference (`simulator.config.json`)](#configuration-reference-simulatorconfigjson)
- [Authoring Guide: How to Write a Valid API Agreement](#authoring-guide-how-to-write-a-valid-api-agreement)
- [AI Translation Guide: Converting Technical Designs into Agreements](#ai-translation-guide-converting-technical-designs-into-agreements)
- [Deployment & Environment Setup](#deployment--environment-setup)
- [v1.0.0 Scope Boundaries](#v100-scope-boundaries)

---

## Visual Architecture & Request Flow

```
                      Word Document (.docx)           Configuration
                    [API Agreement Template]     [simulator.config.json]
                               │                            │
                               ▼                            ▼
                 ┌───────────────────────────┐┌───────────────────────────┐
                 │       modules/docx        ││      modules/config       │
                 │  • AdmZip archive reader  ││  • Path resolution        │
                 │  • FastXmlParser AST      ││  • Strict schema validator│
                 │  • Table extractor        ││  • CLI option overrides   │
                 └─────────────┬─────────────┘└─────────────┬─────────────┘
                               │                            │
                               ▼                            │
                 ┌───────────────────────────┐              │
                 │     modules/agreement     │              │
                 │  • Text sanitization      │              │
                 │  • Semicolon rule parser  │              │
                 │  • JSON Schema builder    │              │
                 │  • Invariant validator    │◄─────────────┘
                 └─────────────┬─────────────┘
                               │
               [ Normalized Agreement In-Memory ]
                               │
                               ▼
                 ┌───────────────────────────┐
                 │          server/          │
                 │  • Fastify v5 HTTP server │
                 │  • Path parameter adapter │
                 │  • Dynamic route registry │
                 └─────────────┬─────────────┘
                               │
═══════════════════════════════╪═══════════════════════════════════════════════════════
                      RUNTIME REQUEST LIFECYCLE
═══════════════════════════════╪═══════════════════════════════════════════════════════
                               │
         Frontend Client HTTP Request (e.g. POST /api/v1/products)
                               │
                               ▼
                 ┌───────────────────────────┐
                 │      server/route-adapter │
                 │  FastifyReq ──► EngineReq │
                 └─────────────┬─────────────┘
                               │
                               ▼
                     [ Step 1: Validate ]
                 ┌───────────────────────────┐
                 │   modules/engine/validate │
                 │  • Scalar type coercion   │
                 │  • Ajv path/query/headers │
                 │  • Ajv JSON request body  │
                 └─────────────┬─────────────┘
                               │
                 ┌─────────────┴─────────────┐
             Passed?                         │
                │ YES                        │ NO (Validation Precedence!)
                ▼                            ▼
     [ Step 2: Generate ]          ┌───────────────────────────┐
┌───────────────────────────┐      │  Return Error Response    │
│  modules/engine/generate  │      │  • Status: 400 (agreed)   │
│  • Check config.responses │      │  • Validation error JSON  │
│  • Mulberry32 seeded PRNG │      └─────────────┬─────────────┘
│  • Schema-conforming mock │                    │
└───────────────┬───────────┘                    │
                │                                │
         Is Status 204?                          │
         ┌──────┴──────┐                         │
    YES  │         NO  │                         │
         ▼             ▼                         ▼
    HTTP 204      HTTP 200/201             HTTP Client
    (No Body)     (Mock JSON Payload)       Receives Response
```

---

## Module Architecture & Pipeline

Moksy is organized into strictly decoupled domain modules:

| Module | Responsibility | Key Files |
| :--- | :--- | :--- |
| **`common`** | Shared types, custom error classes, Unicode sanitizers, diagnostic reporters. | `errors.ts`, `text-sanitizer.ts`, `diagnostic-reporter.ts` |
| **`modules/config`** | Loads, normalizes, and validates `simulator.config.json` and CLI overrides. | `config-loader.ts`, `config-validator.ts` |
| **`modules/docx`** | Reads `.docx` archives in pure Node.js (via `adm-zip` and `fast-xml-parser`) without native dependencies. Extracts paragraphs and tables preserving document order. | `docx-reader.ts`, `table-extractor.ts` |
| **`modules/agreement`** | Normalizes raw tables into structured endpoints, parses semicolon rules, builds nested JSON Schemas (dot/bracket notation), and validates startup invariants. | `agreement-loader.ts`, `agreement-normalizer.ts`, `rule-parser.ts`, `schema-builder.ts`, `startup-validator.ts` |
| **`modules/engine`** | **Validation:** Coerces scalar parameters and checks requests against compiled Ajv schemas.<br>**Generation:** Produces deterministic mock payloads matching JSON Schemas via Mulberry32 PRNG. | `request-validator.ts`, `parameter-coercer.ts`, `response-generator.ts`, `prng.ts`, `value-generators.ts` |
| **`server`** | Fastify HTTP transport layer. Translates OpenAPI path templates (`{id}` $\rightarrow$ `:id`), handles CORS, intercepts malformed JSON, and registers in-memory route closures. | `app.ts`, `route-registrar.ts`, `route-adapter.ts`, `banner.ts` |
| **`cli`** | Commander-based CLI entry point wired to `bin/moksy.js`. Exposes `start` and `validate`. | `cli.ts` |

---

## Installation & Quickstart

### 1. Installation
Install Moksy as a development dependency in your project:

```bash
npm install --save-dev moksy
```

### 2. Verify Your API Agreement
Check that your Word agreement document has no syntax or constraint violations:

```bash
npx moksy validate -a ./agreements/API_Agreement.docx
```

### 3. Start the Mock Server
```bash
npx moksy start -c ./simulator.config.json
```

---

## CLI Reference

### `moksy start`
Boots the in-memory Fastify mock server and begins serving mock endpoints.

```bash
npx moksy start [options]
```

**Options:**
- `-c, --config <path>`: Path to configuration file (default: `./simulator.config.json`).
- `-a, --agreement <path>`: Path to `.docx` agreement file (overrides config setting).
- `-p, --port <number>`: Port to listen on (default: `4500` or config setting).
- `-H, --host <string>`: Host address to bind to (default: `127.0.0.1` or config setting).

### `moksy validate`
Performs an offline syntax and invariant check on the `.docx` file without starting a server.

```bash
npx moksy validate -a <path-to-docx>
```

**Options:**
- `-a, --agreement <path>` *(Required)*: Path to `.docx` agreement file.

---

## Configuration Reference (`simulator.config.json`)

Moksy is configured via a static JSON file. All paths are resolved relative to the location of the configuration file.

```json
{
  "host": "127.0.0.1",
  "port": 4500,
  "basePath": "/api/v1",
  "allowedOrigins": [
    "http://localhost:3000",
    "http://localhost:5173"
  ],
  "seed": 42,
  "agreementPath": "./templates/API_Agreement_Two_Examples.docx",
  "responses": {
    "GET /products": 200,
    "POST /products": 201,
    "GET /products/{id}": 500
  }
}
```

### Field Definitions

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `host` | `string` | `"127.0.0.1"` | IP address to bind the mock server. |
| `port` | `integer` | `4500` | Port number (1024–65535). |
| `basePath` | `string` | `""` | Optional URL prefix prepended to all endpoints (e.g. `"/api/v1"`). |
| `allowedOrigins` | `string[]` | `["*"]` | Allowed CORS origins for browser clients. |
| `seed` | `integer` | `undefined` | Optional PRNG seed. If set, response data generation is 100% deterministic and reproducible across server restarts. |
| `agreementPath` | `string` | *(Required)* | Path to the Word document (`.docx`) file. |
| `responses` | `object` | `{}` | Static status selection dictionary mapping `"METHOD /path"` to an HTTP status code defined in the agreement. |

> **Validation Precedence Guarantee:** Setting `"GET /products/{id}": 500` forces the server to return an HTTP 500 error response. However, if a request has invalid inputs (e.g., missing path parameter or wrong type), **validation failure strictly takes precedence** and returns HTTP 400.

---

## Authoring Guide: How to Write a Valid API Agreement

Moksy reads Microsoft Word (`.docx`) documents containing structured endpoint definitions. You can use the provided blank template at `templates/API_Agreement_Template.docx`.

### Structure of an Endpoint Block

Every endpoint in the document consists of:
1. **Metadata Paragraphs** (Endpoint header)
2. **Request Fields Table**
3. **Success Response Fields Table**
4. **Error Responses Table**

---

### Step 1: Endpoint Metadata Paragraphs
Before the tables, declare the endpoint properties using exact `Key: Value` lines:

```text
Method: POST
Path: /products
Collection: products
Authentication: required
Request body: json
Success status: 201
Success body: json
```

- **Method:** `GET`, `POST`, `PUT`, `PATCH`, or `DELETE`.
- **Path:** OpenAPI-style path template (e.g., `/items` or `/categories/{categoryId}/items/{itemId}`).
- **Collection:** Optional shared in-memory collection name. Use the same name across conventional list, create, read, update, and delete endpoints. Omit it or use `-` for stateless generation.
- **Authentication:** `none`, `bearer`, or `required`.
- **Request body:** `json` or `none`.
- **Success status:** Valid 2xx integer (e.g., `200`, `201`, `204`).
- **Success body:** `json` or `none` (must be `none` if status is `204`).

---

### Step 2: Request Fields Table
Defines parameters accepted by the endpoint across path, query, headers, and request body.

**Columns:** `Field` | `Location` | `Type` | `Required` | `Nullable` | `Rules` | `Behavior`

| Field | Location | Type | Required | Nullable | Rules | Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `path` | `integer` | `yes` | `no` | `min=1` | `-` |
| `category` | `query` | `string` | `no` | `no` | `enum=["electronics", "apparel"]` | `filter=category` |
| `search` | `query` | `string` | `no` | `no` | `maxLength=100` | `search=name` |
| `page` | `query` | `integer` | `no` | `no` | `min=1; default=1` | `page` |
| `pageSize` | `query` | `integer` | `no` | `no` | `min=1; max=50; default=10` | `pageSize` |
| `name` | `body` | `string` | `yes` | `no` | `minLength=3; maxLength=100` | `-` |

- **Locations:** `path`, `query`, `header`, or `body`.
- **Types:** `string`, `integer`, `number`, `boolean`, `array`, `object`.
- **Nested Fields:** Use dot notation for nested objects (`dimensions.width`) and brackets for array items (`tags[]` or `items[].id`).
- **Placeholder Values:** Non-applicable cells can be filled with `-`, `—`, `none`, or left empty.
- **Behavior:** Optional for query fields on a stateful list endpoint. Supported values are `filter=<recordField>`, `search=<recordField>`, `page`, and `pageSize`.

---

### Step 3: Success Response Fields Table
Defines the structure of the JSON payload returned on success.

**Columns:** `Field` | `Type` | `Required` | `Nullable` | `Rules`

| Field | Type | Required | Nullable | Rules |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `integer` | `yes` | `no` | `min=1` |
| `title` | `string` | `yes` | `no` | `minLength=1; maxLength=120` |
| `inStock` | `boolean` | `yes` | `no` | `-` |

*(If `Success status` is `204`, this table must be omitted or left empty).*

---

### Step 4: Error Responses Table
Defines error conditions, triggers, and error body schemas.

**Columns:** `Status` | `Trigger` | `Field` | `Type` | `Required` | `Nullable` | `Rules`

| Status | Trigger | Field | Type | Required | Nullable | Rules |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `400` | `validation` | `message` | `string` | `yes` | `no` | `default="Validation failed"` |
| `400` | `validation` | `errors` | `array` | `no` | `no` | `-` |
| `404` | `not_found` | `message` | `string` | `yes` | `no` | `default="Item not found"` |
| `500` | `selected` | `message` | `string` | `yes` | `no` | `default="Internal server error"` |

---

### Semicolon-Separated Rule Grammar

Specify validation and generation constraints in the `Rules` column using `key=value` pairs separated by semicolons:

| Rule | Supported Types | Example | Description |
| :--- | :--- | :--- | :--- |
| `min=<num>` | `integer`, `number` | `min=1` | Minimum numerical value. |
| `max=<num>` | `integer`, `number` | `max=1000` | Maximum numerical value. |
| `minLength=<int>` | `string` | `minLength=5` | Minimum string length. |
| `maxLength=<int>` | `string` | `maxLength=50` | Maximum string length. |
| `pattern=<regex>` | `string` | `pattern=^[A-Z]{3}-[0-9]{4}$` | Regular expression pattern. |
| `enum=[...]` | All primitive types | `enum=["draft", "published"]` | Allowed set of values. |
| `minItems=<int>` | `array` | `minItems=1` | Minimum number of items. |
| `maxItems=<int>` | `array` | `maxItems=10` | Maximum number of items. |
| `default=<val>` | All types | `default="active"` | Fallback / fixed value. |

---

### Mandatory Startup Invariant Checks

Moksy executes strict invariant validation upon boot. The server will safely abort with detailed diagnostics if:
1. **Duplicate Routes:** Two endpoints declare the same `METHOD + Path`.
2. **Missing Path Parameters:** A URL contains `{param}`, but no matching row with `Location: path` and `Required: yes` exists in Request Fields.
3. **Invalid 204 Responses:** Status 204 has `Success body` set to `json` or defines response fields.
4. **Unsatisfiable Bounds:** A rule specifies `min > max`, `minLength > maxLength`, or `minItems > maxItems`.
5. **Missing Validation Trigger:** An endpoint lacks an error response with `Trigger: validation` (required for 400 validation failures).
6. **Undefined Static Status Selection:** A status code configured in `simulator.config.json` is not declared in the agreement for that endpoint.

---

## AI Translation Guide: Converting Technical Designs into Agreements

If you have a backend technical specification, OpenAPI/Swagger document, or architecture RFC, you can use an LLM (such as Gemini, ChatGPT, or Claude) to generate valid tables for your Word agreement.

### System Prompt for AI Assistants

Copy and paste the following prompt to your AI model:

```markdown
You are a technical documentation assistant specializing in Moksy API Agreement tables.
Your task is to convert the provided API technical design into formatted tables matching Moksy's strict .docx specification.

Strict Formatting Rules You Must Follow:
1. Metadata Paragraphs:
   Provide exact key-value lines before tables:
   Method: <GET | POST | PUT | PATCH | DELETE>
   Path: </path/with/{parameter}>
   Authentication: <none | bearer | required>
   Request body: <json | none>
   Success status: <200 | 201 | 204>
   Success body: <json | none>

2. Request Fields Table:
   Columns: Field | Location | Type | Required | Nullable | Rules
   - Location must be one of: path, query, header, body
   - Every {param} in Path MUST have a row with Location "path", Type, Required "yes", Nullable "no".
   - Use dot notation for nested objects (e.g. "address.city").
   - Use brackets for array items (e.g. "items[]" or "items[].id").

3. Success Response Fields Table:
   Columns: Field | Type | Required | Nullable | Rules
   - If Success status is 204, write: "No response body (HTTP 204)."

4. Error Responses Table:
   Columns: Status | Trigger | Field | Type | Required | Nullable | Rules
   - MUST include at least one row with Trigger "validation" (e.g. Status 400).
   - Common triggers: validation, not_found, unauthorized, forbidden, conflict, server_error.

5. Rules Syntax:
   - Semicolon-separated: min=1; max=100; minLength=2; maxLength=50; pattern=^[a-z]+$; enum=["a", "b"]; default="val"
   - Never produce unsatisfiable bounds (min must be <= max).
   - Use "-" for fields with no extra rules.
```

---

## Deployment & Environment Setup

### 1. Local Frontend Development
In local development, frontend engineers run Moksy as a background dev dependency:

```json
{
  "scripts": {
    "mock:server": "moksy start",
    "dev": "concurrently \"npm run mock:server\" \"next dev\""
  }
}
```

Point your frontend API client to the mock server base URL:
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4500';

export async function fetchProducts() {
  const res = await fetch(`${API_BASE_URL}/products`);
  if (!res.ok) throw new Error('API error');
  return res.json();
}
```

### 2. Staging / Isolated Mock Deployment
When deploying a shared mock simulator for team testing or QA environments (e.g., in Docker or CI runners):

1. Install production dependencies only:
   ```bash
   npm install --omit=dev
   ```
   *(Moksy packages its runtime dependencies—Fastify, Ajv, etc.—in `dependencies`, so it runs completely without devDependencies).*
2. Bind the host to `0.0.0.0` in `simulator.config.json` or via `-H 0.0.0.0` to allow external network traffic.
3. Configure `allowedOrigins` to match your staging environment domains.

---

## v1.0.0 Scope Boundaries

To ensure stability, zero maintenance overhead, and rapid mock startup, Moksy v1.0.0 defines strict functional boundaries:

### Supported Features
- Ingestion of `.docx` table agreements via pure Node.js archive parsing.
- Dynamic Fastify route registration.
- Comprehensive request validation (path, query, headers, body) with scalar coercion.
- Deterministic dummy data generation matching response schemas using Mulberry32 PRNG.
- Static response status selection via config (e.g., simulating HTTP 500 server errors).
- Optional in-memory collections for realistic CRUD journeys during a server session.
- Equality filtering, single-field search, and pagination for stateful list endpoints.
- Built-in CORS preflight negotiation.

### Explicitly Excluded (Out of Scope for v1.0.0)
- **No Durable Persistence:** Stateful collections live in server memory and reset to the seeded initial data after restart. No database or runtime file writes are used.
- **No Request Logging:** Request logging is disabled to keep terminal output clean and focused.
- **No Artificial Latency:** No delay controllers, random delays, or bandwidth throttling.
- **No Complex Protocols:** No WebSockets, GraphQL, or HTTP streaming.
- **No Cryptographic Verification:** Authentication headers are checked for structural presence only; no JWT decoding or cryptographic signature checks.

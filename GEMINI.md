# Moksy — API Simulator Library

## Project Overview

**Moksy** is an npm package designed to eliminate frontend developer blockers during backend development. It reads agreed API definitions directly from structured Word document (`.docx`) table templates and static settings (`simulator.config.json`), mounts in-memory mock endpoints dynamically via Fastify, strictly validates frontend requests with Ajv, and generates random dummy response payloads conforming to response schemas using a deterministic, seedable PRNG.

### Core Technologies
- **Language & Runtime:** TypeScript (Target: ES2022, Module: NodeNext), Node.js (v18+)
- **HTTP Transport:** Fastify v5 with `@fastify/cors`
- **Schema Validation:** Ajv v8 with `ajv-formats`
- **Document Ingestion:** Pure Node.js `.docx` archive parsing using `adm-zip` and `fast-xml-parser` (zero native system binaries)
- **CLI Framework:** Commander
- **Testing Framework:** Vitest

### Strict v1.0.0 Scope Boundaries
- **Included:** Dev-dependency CLI, in-memory route registration, path/query/header/body request validation, deliberate scalar parameter coercion, seeded dummy data generation, optional in-memory CRUD collections, list filtering/search/pagination, static status selection via config, JSON endpoints and no-body responses (such as 204), configurable CORS.
- **Excluded:** Dashboards/UIs, durable database/file persistence, state retention across server restarts, request logs, artificial delay/latency controllers, bandwidth throttling, random status selection, streaming, WebSockets, GraphQL, and real OAuth/JWT verification.

---

## Repository & Architecture Layout

The codebase follows a modular design where cross-cutting shared code lives in `common/`, domain processing logic lives in `src/modules/`, and HTTP transport is cleanly separated from the simulation engine.

```
moksy-library/
├── bin/
│   └── moksy.js                         # Executable CLI entry point (#!/usr/bin/env node)
├── src/
│   ├── index.ts                         # Public library exports
│   ├── cli.ts                           # Commander CLI definition ('start', 'validate')
│   │
│   ├── common/                          # Shared zero-dependency utilities
│   │   ├── types.ts                     # HttpMethod, FieldLocation, FieldType, AuthType
│   │   ├── errors.ts                    # MoksyError, MoksyConfigError, MoksyAgreementError
│   │   ├── text-sanitizer.ts            # Sanitizes smart quotes, unicode whitespace, dashes
│   │   └── diagnostic-reporter.ts       # Structured terminal error formatter
│   │
│   ├── modules/                         # Core domain modules
│   │   ├── config/                      # Static simulator configuration
│   │   │   ├── types.ts                 # SimulatorConfig interface & defaults
│   │   │   ├── config-validator.ts      # Validates port, host, responses dictionary
│   │   │   └── config-loader.ts         # Loads JSON with CLI overrides & path resolution
│   │   │
│   │   ├── docx/                        # Word document (.docx) parsing
│   │   │   ├── types.ts                 # Raw table and document AST types
│   │   │   ├── docx-reader.ts           # AdmZip + fast-xml-parser (preserves document order)
│   │   │   └── table-extractor.ts       # Groups paragraphs and tables into endpoint blocks
│   │   │
│   │   ├── agreement/                   # Agreement normalization & startup validation
│   │   │   ├── types.ts                 # NormalizedAgreement & NormalizedEndpoint types
│   │   │   ├── rule-parser.ts           # Semicolon/comma rule parser & bounds satisfiability
│   │   │   ├── schema-builder.ts        # Reconstructs JSON Schemas from dot/bracket paths
│   │   │   ├── agreement-normalizer.ts  # Compiles raw tables into normalized schemas
│   │   │   ├── startup-validator.ts     # Invariant checks (duplicate routes, path params, 204)
│   │   │   └── agreement-loader.ts      # End-to-end ingestion orchestrator
│   │   │
│   │   └── engine/                      # Simulation core (Tasks 4 & 5)
│   │       ├── prng.ts                  # Mulberry32 deterministic PRNG
│   │       ├── request-validator.ts     # Ajv validation & parameter coercion
│   │       └── response-generator.ts    # Seeded response dummy payload generator
│   │
│   └── server/                          # Fastify HTTP transport layer (Task 6)
│       ├── app.ts                       # Fastify instance, CORS plugin, error handlers
│       └── route-registrar.ts           # Dynamic route binding
│
├── templates/
│   ├── API_Agreement_Template.docx      # Blank reusable Word agreement template
│   └── API_Agreement_Two_Examples.docx  # Reference document with two filled endpoints
├── tests/                               # Vitest automated test suites
├── simulator.config.json                # Sample static configuration file
├── tsconfig.json                        # TypeScript configuration
└── package.json                         # Package dependencies and scripts
```

---

## Building, Running, and Testing

### Key Commands

```bash
# Build the TypeScript project to dist/
npm run build

# Run all automated tests via Vitest
npm run test

# Type-check TypeScript sources without emitting files
npm run typecheck

# Validate a .docx agreement file syntax without starting the server
node ./bin/moksy.js validate -a ./templates/API_Agreement_Two_Examples.docx

# Start the mock server using default configuration (./simulator.config.json)
node ./bin/moksy.js start

# Start the mock server with explicit options
node ./bin/moksy.js start -c ./simulator.config.json -a ./templates/API_Agreement_Two_Examples.docx -p 4500
```

---

## Development Conventions & Guidelines

### 1. Document & Rule Grammar (`.docx` Tables)
- Endpoints in `.docx` documents must include metadata paragraphs:
  - `Method: <GET / POST / PUT / PATCH / DELETE>`
  - `Path: </resource/{id}>`
  - `Collection: <name / ->` (optional; matching names share in-memory records)
  - `Authentication: <none / bearer / required>`
  - `Request body: <json / none>`
  - `Success status: <200 / 201 / 204>`
  - `Success body: <json / none>`
- Request Fields table columns: `Field`, `Location`, `Type`, `Required`, `Nullable`, `Rules`, `Behavior`.
- Optional query behaviors: `filter=<field>`, `search=<field>`, `page`, and `pageSize`.
- Success Response Fields table columns: `Field`, `Type`, `Required`, `Nullable`, `Rules`.
- Error Responses table columns: `Status`, `Trigger`, `Field`, `Type`, `Required`, `Nullable`, `Rules`.
- Semicolon-separated rule syntax:
  - `min=<number>`, `max=<number>` (integers and numbers)
  - `minLength=<int>`, `maxLength=<int>`, `pattern=<regex>` (strings)
  - `minItems=<int>`, `maxItems=<int>` (arrays)
  - `enum=["a", "b"]` or `enum=[1, 2]`
  - `default=<value>`
- Placeholder cells (`-`, `—`, `none`, empty) denote non-applicable rules or empty request/response bodies.

### 2. Startup Invariant Guarantees
- **Duplicate Routes:** Rejects duplicate `METHOD + Path` combinations.
- **Path Parameters:** Every `{param}` in the URL path must be explicitly declared in Request Fields with `Location: path` and `Required: yes`.
- **Status 204:** Must have `Success body: none` and no body fields defined.
- **Satisfiability:** Must satisfy `min <= max`, `minLength <= maxLength`, and `minItems <= maxItems`.
- **Configuration Selections:** Any status selected in `simulator.config.json`'s `responses` map must be defined on that endpoint in the agreement.
- **Validation Trigger:** Every endpoint must have at least one error response with `trigger: validation` (typically HTTP 400).

### 3. Typing and Error Handling
- Never disable warnings or use untyped hacks (`any` assertions). Use explicit schemas and guards.
- All errors thrown during document parsing or configuration must inherit from `MoksyError` (`MoksyConfigError` or `MoksyAgreementError`) and be routed through `formatDiagnosticError()` to display clean, actionable terminal diagnostics with exact document location.
- Keep the simulation engine strictly independent of HTTP transport; avoid coupling engine logic to Fastify request/reply objects.

# Moksy — API Simulator

Turn agreed API definitions into callable mock endpoints dynamically without generating backend source files.

Moksy reads API contracts directly from Word document (`.docx`) table templates and static settings (`simulator.config.json`). It mounts in-memory HTTP endpoints via Fastify, validates incoming requests strictly with Ajv, and generates deterministic dummy response data using a seedable PRNG (Mulberry32).

---

## Features

- **Direct Word Document Ingestion:** Reads `.docx` tables directly in pure Node.js (no native dependencies or OS binaries required).
- **In-Memory Mocking:** Registers routes dynamically at runtime with zero code generation or temporary files.
- **Strict Request Validation:** Validates query parameters, path parameters, agreed headers, and JSON bodies using Ajv.
- **Deterministic Generation:** Generates dummy payloads matching your schemas; reproducible via optional PRNG seeds.
- **Static Status Selection:** Override any endpoint's response with a custom status code (e.g. 500) via static configuration to test frontend error handling.
- **CORS Configured:** Built-in CORS support so local frontend apps (`http://localhost:3000`) work out of the box.

---

## Installation & Setup

```bash
# Clone the repository
git clone https://github.com/Abohessuin/moksy-simulator.git
cd moksy-simulator

# Install dependencies
npm install

# Build the TypeScript package
npm run build

# Run automated tests
npm run test
```

---

## Usage

### 1. Validate an API Agreement Document
Verify that your Word agreement table syntax, column definitions, and constraints are valid:

```bash
node ./bin/moksy.js validate -a ./templates/API_Agreement_Two_Examples.docx
```

### 2. Start the Mock Server
Start the simulation server using static configuration (`simulator.config.json`):

```bash
node ./bin/moksy.js start
```

Or with explicit flags:

```bash
node ./bin/moksy.js start -c ./simulator.config.json -a ./templates/API_Agreement_Two_Examples.docx -p 4500
```

---

## Configuration (`simulator.config.json`)

```json
{
  "host": "127.0.0.1",
  "port": 4500,
  "basePath": "",
  "allowedOrigins": ["*"],
  "seed": 42,
  "agreementPath": "./templates/API_Agreement_Two_Examples.docx",
  "responses": {
    "GET /products": 200,
    "POST /products": 201
  }
}
```

---

## Project Structure

```
moksy-simulator/
├── bin/
│   └── moksy.js                 # Executable CLI entrypoint
├── src/
│   ├── common/                  # Shared types, error classes, sanitizer, messages
│   ├── modules/
│   │   ├── config/              # Static configuration loader and validator
│   │   ├── docx/                # Word document (.docx) reader and table extractor
│   │   ├── agreement/           # Normalizer, rule parser, schema builder, startup validator
│   │   └── engine/              # Request validator and PRNG response generator (Tasks 4-5)
│   ├── server/                  # Fastify HTTP transport and route registration (Task 6)
│   ├── cli.ts                   # CLI commands ('start', 'validate')
│   └── index.ts                 # Programmatic exports
├── templates/
│   ├── API_Agreement_Template.docx      # Blank reusable Word agreement template
│   └── API_Agreement_Two_Examples.docx  # Sample document with 2 complete endpoints
└── tests/                       # Vitest unit and integration test suites
```

---

## License

ISC

# Moksy

**Turn Word API agreements into working mock APIs.**

Moksy is a local API simulator that transforms structured Word (`.docx`) agreements into callable HTTP endpoints—without writing mock handlers or building a backend.

It helps frontend and backend teams develop in parallel, validate API contracts, and test application workflows before the real backend is ready.

## Features

- **Document-driven mocking** — Generate REST endpoints from Word API agreements.
- **Request validation** — Validate path parameters, queries, headers, and JSON bodies.
- **Realistic mock data** — Generate schema-compliant responses with optional deterministic seeding.
- **Stateful CRUD** — Simulate collections, filtering, searching, and pagination in memory.
- **Error simulation** — Switch between declared response statuses during development.
- **Built-in dashboard** — Explore endpoints and control mock responses through a local UI.
- **React DevTools** — Access the dashboard directly from your React application.

## Installation

```bash
npm install -D moksy
```

## Quick Start

### 1. Prepare an API agreement

Use the [API Agreement Template](./templates/API_Agreement_Template.docx) to define your endpoints, or start with the [Completed Example](./templates/API_Agreement_Two_Examples.docx).

Save your agreement as `agreements/API_Agreement.docx`.

### 2. Configure Moksy

Create `simulator.config.json` in your project root:

```json
{
  "agreementPath": "./agreements/API_Agreement.docx"
}
```

### 3. Start the simulator

```bash
npx moksy start
```

Moksy automatically validates your agreement and starts the mock API server.

**Server:** `http://127.0.0.1:4500`

**Dashboard:** `http://127.0.0.1:4500/_moksy`

Your endpoints are now ready to use.

## Dashboard

Moksy includes a built-in dashboard for inspecting your API agreement, exploring available endpoints, and switching between declared mock responses.

You can also download the agreement template directly from the dashboard.

### React Integration

Add the optional development-only launcher to your React application:

```javascript
import { MoksyDevtools } from "moksy/react";

export function App() {
  return (
    <>
      {/* Your application */}

      {import.meta.env.DEV && <MoksyDevtools />}
    </>
  );
}
```

The launcher opens the dashboard in an iframe without leaving your application.

By default, it connects to `http://127.0.0.1:4500`.

## CLI

Moksy provides two main commands:

| Command          | Description                                       |
| ---------------- | ------------------------------------------------- |
| `moksy start`    | Start the mock API server                         |
| `moksy validate` | Validate an agreement without starting the server |

**Validate an agreement:**

```bash
npx moksy validate -a ./agreements/API_Agreement.docx
```

**Start with custom options:**

```bash
npx moksy start --port 4500 --host 127.0.0.1
```

Use `npx moksy start --help` for all available options.

## Configuration

Customize the mock server using `simulator.config.json`:

```json
{
  "host": "127.0.0.1",
  "port": 4500,
  "basePath": "/api/v1",
  "allowedOrigins": ["http://localhost:3000"],
  "agreementPath": "./agreements/API_Agreement.docx",
  "seed": 42,
  "responses": {
    "GET /products": 200,
    "POST /products": 201
  }
}
```

Only `agreementPath` is required. Other options are optional and use built-in defaults.

Relative file paths are resolved from the configuration file's location.

## API Agreement Templates

Moksy uses structured Word agreements to define endpoints, request fields, response schemas, and validation rules.

- [Blank API Agreement Template](./templates/API_Agreement_Template.docx)
- [Completed Agreement Example](./templates/API_Agreement_Two_Examples.docx)

## Limitations

Moksy is designed for local development and API testing.

- Only structured Moksy `.docx` agreements are supported.
- Mock collections and response overrides are stored in memory and reset on restart.
- Authentication is simulated without cryptographic credential verification.
- Persistent databases, WebSockets, GraphQL, and artificial latency are not supported.
- The dashboard is intended for local development, not production administration.

## License

ISC

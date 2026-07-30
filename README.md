# Foody Market

Foody Market is a TypeScript monorepo containing a React storefront and an
Express API.

## Structure

- `client/` — React 19, Vite, Tailwind CSS and DaisyUI
- `server/` — Express 5 REST API with mock catalogue data

## Requirements

- Node.js 20 or newer
- npm

## Setup

```bash
npm run install:all
cp client/.env.example client/.env
cp server/.env.example server/.env
```

Run the API and client in separate terminals:

```bash
npm run dev:server
npm run dev:client
```

The client runs at `http://localhost:5173` and uses the API at
`http://localhost:3001`.

## Checks

```bash
npm run build
npm run lint
```

## Current limitations

The API currently uses in-memory mock data. Product and banner image files are
not included yet; place them in `server/public/images/`.

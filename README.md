# Foody Market

Foody Market is a TypeScript monorepo containing a React storefront and an
Express API.

## Structure

- `client/` — React 19, Vite, Tailwind CSS and DaisyUI
- `server/` — Express 5 API, PostgreSQL persistence and background workers

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL installed as native Ubuntu packages (Docker is not required)

## Setup

```bash
npm run install:all
cp client/.env.example client/.env
cp server/.env.example server/.env
npm run db:migrate
npm run db:seed
```

Run the API and client in separate terminals:

```bash
npm run dev:server
npm run dev:client
```

The catalogue, seller accounts and channels are stored in PostgreSQL. Product
uploads use `server/var/uploads` only in development; production requires a
non-local storage adapter.

## Telegram development setup

Create a bot with Telegram's `@BotFather`, then set `TELEGRAM_BOT_TOKEN` and
`TELEGRAM_BOT_USERNAME` in `server/.env`. Never commit the token. Run local
long polling and the reliable delivery worker in separate terminals:

```bash
npm run build --prefix server
npm run worker:telegram --prefix server
npm run worker:outbox --prefix server
```

Production uses the `/api/messaging/telegram/webhook` endpoint and additionally
requires `TELEGRAM_WEBHOOK_SECRET`. Telegram is registered only when both bot
token and username are configured.

The client runs at `http://localhost:5173` and uses the API at
`http://localhost:3001`.

## Checks

```bash
npm run build
npm run lint
npm test
```

Online payment, real Diia identity, S3 storage and Viber are intentionally not
part of the current MVP. See [`IMAGE_CREDITS.md`](IMAGE_CREDITS.md) for seeded
catalogue image sources and licenses.

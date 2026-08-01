# Хуторинок Marketplace

Marketplace заявок на товары: покупатель собирает один кошик, а при оформлении
он атомарно разбивается на отдельную заявку каждому продавцу. Онлайн-оплаты в
MVP нет. Продавцы публикуют товары сразу, самостоятельно подключают messenger
и обрабатывают заявки в кабинете или кнопками Telegram.

## Structure

- `client/` — React 19, Vite, Tailwind CSS and DaisyUI
- `server/` — Express 5 API, PostgreSQL persistence and background workers
- `docs/` — инструкции по адаптерам и production checklist

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL installed as native Ubuntu packages (Docker is not required)

Docker, Snap и Flatpak не нужны. PostgreSQL используется из обычных deb-пакетов.

## Локальный запуск

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

В отдельных терминалах запустите доставку уведомлений и очистку временных
учётных данных:

```bash
npm run build --prefix server
npm run worker:outbox --prefix server
npm run worker:cleanup --prefix server
```

The catalogue, seller accounts and channels are stored in PostgreSQL. Product
uploads use `server/var/uploads` only in development; production requires a
non-local storage adapter.

API: `http://localhost:3001`, клиент: `http://localhost:5173`.

## Данные и идентификация

Приложение не хранит паспортные данные продавца. От identity provider хранится
только необратимый hash внешнего subject id. Реальная Дія-интеграция пока
оставлена недоступным адаптерным слотом; development provider нельзя включить в
production. Имя, телефон и детали доставки покупателя шифруются на уровне
приложения. Публичный контакт продавца намеренно открыт на странице магазина.

## Telegram в development

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

`TELEGRAM_BOT_TOKEN` — секрет, его нельзя коммитить или отправлять в клиент.
Покупатель и продавец связывают Telegram через одноразовую deep-link ссылку;
chat id хранится только в зашифрованном виде. В production long polling
запрещён: настройте webhook на
`POST /api/messaging/telegram/webhook` и заголовок
`X-Telegram-Bot-Api-Secret-Token`.

## Хранилище изображений

Development использует `STORAGE_DRIVER=local`. Production требует
`STORAGE_DRIVER=s3`; драйвер совместим с AWS S3, Cloudflare R2 и другими
S3-compatible сервисами. Укажите bucket, region и публичный CDN/base URL.
Статические access keys необязательны при использовании IAM role.

Подробности расширения: [messenger adapters](docs/adapters/messaging.md) и
[storage adapters](docs/adapters/storage.md).

## Эксплуатация

- `GET /health` — liveness процесса без внешних зависимостей.
- `GET /ready` — PostgreSQL, выбранный storage driver и диагностические
  heartbeat фоновых процессов. Недоступность Telegram не выключает API.
- `worker:outbox` — надёжная доставка уведомлений с lease, retry и audit.
- `worker:cleanup` — удаление просроченных сессий/link intents/action tokens и
  отзыв tracking-ключей с сохранением заявок и аудита.
- `worker:telegram` — только development polling; для production используется
  webhook API-процесса.

Сроки хранения и rate limits явно задаются в `server/.env`; полный список с
безопасными development defaults находится в `server/.env.example`.

## Checks

```bash
npm run build
npm run lint
npm test
```

Перед развёртыванием пройдите [production checklist](docs/production-checklist.md).

Онлайн-оплата, реальная интеграция Дія и Viber не входят в текущий MVP. Для них
оставлены адаптерные границы. Кнопка жалобы пока намеренно показывает заглушку.
См. [`IMAGE_CREDITS.md`](IMAGE_CREDITS.md) для источников seed-изображений.

# Production checklist

## Секреты и доступ

- [ ] `NODE_ENV=production`, `DEV_IDENTITY_ENABLED=false`.
- [ ] Сгенерированы отдельные `SESSION_SECRET` (≥32 символов) и
  `PII_ENCRYPTION_KEY` (64 hex); development/test значения не используются.
- [ ] Секреты находятся в secret manager, не в git, образе или frontend env.
- [ ] PostgreSQL role имеет доступ только к базе приложения; включены backups и
  проверено восстановление.
- [ ] `TRUST_PROXY_HOPS` точно соответствует числу доверенных reverse proxies.

## Storage и сеть

- [ ] `STORAGE_DRIVER=s3`, bucket/region/public URL проверены.
- [ ] Storage credentials ограничены Put/Delete нужного bucket; чтение идёт
  через публичный CDN URL.
- [ ] TLS включён на frontend, API, PostgreSQL и S3 endpoint.
- [ ] CORS разрешает только фактический `FRONTEND_URL`.
- [ ] Edge/WAF limits дополняют встроенные process-local rate limits. Для
  нескольких API-инстансов используется общий distributed limiter на edge.

## Messenger

- [ ] Telegram bot token и username заданы, webhook secret случаен и не короче
  внутреннего стандарта команды.
- [ ] Webhook указывает на `/api/messaging/telegram/webhook`, secret header
  совпадает; long-polling worker в production не запускается.
- [ ] Выполнена реальная пробная привязка продавца и покупателя, доставка новой
  заявки, accept/reject callback и повтор failed delivery.

## Процессы и наблюдаемость

- [ ] Миграции применены до переключения трафика.
- [ ] Запущены API, `worker:outbox` и `worker:cleanup`; настроен автоматический
  restart и graceful SIGTERM.
- [ ] `/health` используется для liveness, `/ready` — для readiness.
- [ ] Алерт срабатывает на 503 readiness, stale heartbeat, рост failed outbox и
  ошибки PostgreSQL/storage. Telegram outage не перезапускает API.
- [ ] Сроки хранения и rate limits согласованы с ожидаемой нагрузкой.
- [ ] Логи не содержат cookies, bearer/action/tracking tokens, телефоны или chat id.

## Приёмка

- [ ] `npm ci --prefix client && npm ci --prefix server` проходит из lockfiles.
- [ ] `npm run db:migrate`, `npm run build`, `npm run lint`, `npm test` успешны.
- [ ] Мобильный checkout проверен клавиатурой и screen reader; ошибки получают
  focus, loading/error/empty состояния понятны без цвета.
- [ ] Проверено: один кошик → N продавцов → N заявок; повтор callback не создаёт
  новый audit/outbox; tracking key после TTL недействителен.
- [ ] Репозиторий просканирован на секреты, plaintext PII, выгруженные файлы и
  локальные database dumps.

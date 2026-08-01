# План реализации marketplace и подключаемых messenger-каналов

**Спецификация:** `docs/superpowers/specs/2026-08-01-marketplace-messaging-design.md`

## Технические решения

- Сохранить React 19 + Vite, Express 5 и текущую структуру `client`/`server`.
- Использовать нативный PostgreSQL в Ubuntu, без Docker.
- Доступ к PostgreSQL: `drizzle-orm` + `pg`; миграции: `drizzle-kit` с SQL-файлами в `server/drizzle`.
- Runtime-валидация API и env: `zod`.
- Тесты: Vitest; HTTP-интеграция: Supertest; UI: Testing Library + jsdom. Серверные интеграционные тесты выполняются последовательно на отдельной `hutorynok_test` базе.
- Telegram: `grammy`; локально long polling, production-ready контракт допускает webhook.
- Загрузки: `multer` в память + `sharp` для проверки, преобразования и удаления метаданных.
- Безопасность HTTP: `helmet`, `express-rate-limit`, `cookie-parser`; криптография токенов и PII — встроенный `node:crypto`.
- Все ID доменных сущностей — UUID, генерируемые приложением. Деньги — integer kopecks; количество товара в MVP — целое число.

## Этап 0. Локальная инфраструктура и безопасная конфигурация

### PostgreSQL

1. Установить `postgresql` и `postgresql-contrib` штатными пакетами Ubuntu после отдельного подтверждения системной команды.
2. Создать роли и базы `hutorynok` и `hutorynok_test`; пароль хранить только в локальном `server/.env`.
3. Проверить доступ командами `pg_isready` и `psql "$DATABASE_URL" -c 'select 1'`.

### Конфигурация репозитория

- Дополнить `server/.env.example`: `DATABASE_URL`, `TEST_DATABASE_URL`, `SESSION_SECRET`, `PII_ENCRYPTION_KEY`, `DEV_IDENTITY_ENABLED`, `PUBLIC_API_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `STORAGE_DRIVER`, `LOCAL_UPLOAD_DIR`.
- Дополнить `.gitignore` локальными upload-каталогами, тестовыми артефактами и coverage.
- Добавить root/server/client команды `test`, `test:server`, `test:client`, `db:generate`, `db:migrate`, `db:seed`, `worker:dev`.
- Добавить валидатор env, который завершает запуск с понятной ошибкой при отсутствии обязательных значений и запрещает `development` identity/local storage в production.

### Проверка этапа

- Unit-тесты валидатора env: development defaults, отсутствующий ключ шифрования, запрет небезопасных production-драйверов.
- `npm run build`, `npm run lint`, пустой набор миграций и подключение к обеим базам проходят.

## Этап 1. PostgreSQL-схема и слой данных

### Схема

Создать миграции для:

- `sellers`: provider, provider subject, status `active|blocked`, slug, store name, description, region;
- `seller_sessions`: seller, token hash, expiry, revoked timestamp;
- `seller_public_contacts`: type, label, value, sort order;
- `seller_delivery_options`: type `nova_poshta|pickup|arrangement`, instructions, active;
- `categories`: существующие десять категорий с фиксированными numeric ID/slug;
- `products`: UUID, seller, category, name, description, price kopecks, unit, minimum integer quantity, state `available|hidden`, timestamps;
- `product_images`: product, storage key, alt text, sort order;
- `channel_link_intents`: provider, target kind, browser secret hash, encrypted confirmed destination, status, expiry, consumed timestamp;
- `channel_connections`: seller, provider, encrypted destination, destination fingerprint, primary/active flags;
- `checkout_groups`: encrypted buyer name/phone/channel destination, provider, tracking token hash, timestamps;
- `seller_applications`: group, seller, status, amount kopecks, timestamps;
- `application_items`: product reference plus immutable name, unit price, quantity and line total snapshots;
- `delivery_selections`: application, delivery type, immutable encrypted details/instructions snapshot;
- `outbox_events` и `outbox_attempts`: aggregate, event type, state, attempts, scheduling and idempotency data;
- минимальный `audit_events` для seller/product/application state changes.

### Инварианты базы

- Unique: `(identity_provider, provider_subject)`, seller slug, one seller connection per provider, one application per `(checkout_group, seller)`, outbox idempotency key.
- Check constraints: неотрицательная цена, положительные quantity/minimum, сумма строки равна сохранённому расчёту на уровне сервиса, допустимые enum-значения.
- Partial unique index гарантирует не более одного primary-канала продавца.
- Foreign keys не каскадно удаляют application snapshots и audit; удаление товара переводится в soft-delete/hidden.

### Репозитории и транзакции

- Создать единый database module, transaction helper и репозитории по доменным модулям.
- Реализовать AES-256-GCM envelope для обратимо нужных PII и SHA-256/HMAC для session/tracking/browser tokens.
- Seed переносит текущие категории, изображения и мок-товары в БД и привязывает их к демонстрационному development-продавцу.

### Проверка этапа

- Миграции применяются на чистой и уже мигрированной базе.
- Repository-тесты проверяют unique/FK/check constraints, транзакционный rollback, шифрование/расшифровку и отсутствие plaintext PII в строках БД.
- Seed идемпотентен и возвращает каталог с теми же 12 товарами.

## Этап 2. Identity и сессии продавца

### Контракт

- Ввести `IdentityProvider` и реестр провайдеров: `isAvailable`, `begin`, `complete`.
- Нормализованный результат содержит только provider, opaque subject и verification timestamp.
- `DevelopmentIdentityProvider` создаёт/выбирает тестового продавца только при `NODE_ENV !== production` и `DEV_IDENTITY_ENABLED=true`.
- Добавить конфигурационный slot для будущего `DiiaIdentityProvider`, но не имитировать настоящий протокол и не принимать production-вход без реальных credentials.

### HTTP и сессии

- Реализовать start/callback, current session и logout endpoints.
- После успешного identity callback найти/создать seller и выдать случайную серверную сессию в `httpOnly`, `SameSite=Lax`, production `Secure` cookie.
- Middleware `requireSeller` загружает активного продавца по хешу сессии; blocked/revoked/expired sessions отклоняются.
- Добавить CSRF-защиту state-changing cookie-authenticated endpoints через double-submit token/custom header.

### UI

- Добавить seller sign-in, onboarding guard и development account selector с явной пометкой «Только локальная разработка».
- Добавить seller layout/navigation и logout.

### Проверка этапа

- Тесты provider contract, production hard-stop, session rotation/expiry/revocation, CSRF, blocked seller и доступ к чужому seller ID.
- UI-тесты входа, восстановления сессии, redirect в onboarding и logout.

## Этап 3. Профиль магазина, контакты и доставка

### Backend

- CRUD собственного store profile с уникальным нормализованным slug.
- CRUD публичных контактов: обязательна минимум одна валидная запись перед завершением onboarding. Для URL разрешать только `https`, `tel` и утверждённые messenger schemes; текст экранируется при выводе.
- CRUD delivery options; активный способ требует понятных инструкций. Nova Poshta в MVP хранит текстовые инструкции и не вызывает внешний API.
- Public storefront endpoint возвращает профиль, публичные контакты, активные способы доставки и товары, но не identity subject, channel destinations или сессии.

### UI

- Onboarding wizard: магазин -> публичный контакт -> доставка -> messenger connection.
- Публичная витрина продавца и ссылка на неё из карточки товара.
- Настройки профиля, контактов и доставки в кабинете.

### Проверка этапа

- Валидация slug/contact/delivery, ownership и запрет завершения onboarding без контакта.
- Публичный response snapshot гарантирует отсутствие закрытых полей.
- UI-тесты onboarding и storefront.

## Этап 4. FileStorageAdapter и управление товарами

### Storage

- Ввести `FileStorageAdapter` с `put`, `delete`, `getPublicUrl` и registry по `STORAGE_DRIVER`.
- `LocalFileStorageAdapter` пишет только в настроенный каталог вне source tree и отдаёт файлы через отдельный static route.
- Обработка изображения: MIME определяется по содержимому; лимиты количества/байтов/пикселей; поворот по orientation; конвертация в WebP; генерация thumbnail/medium/large; EXIF удаляется.
- При ошибке БД удалить только объекты текущей незавершённой загрузки. Удаление товара ставит storage cleanup в outbox, чтобы не терять ссылки при временном файловом сбое.

### Catalog

- Заменить mock product routes на PostgreSQL repositories и UUID product IDs.
- Сохранить фильтры/поиск/сортировку, отдавая integer `priceKopecks` и готовые image URLs.
- Seller product CRUD проверяет владельца, onboarding, активный channel и валидные images/category/unit/minimum quantity.
- Товар публикуется сразу. При отсутствии seller channel он остаётся видимым с `acceptingApplications=false` и не добавляется в новую корзину.

### Client

- Обновить Product/types/API/pages под UUID, price formatting и seller summary.
- Создать seller product list/editor с upload preview, reorder и hide/unhide.
- Кнопка «Пожаловаться» показывает локализованный toast «Функция появится позже».

### Проверка этапа

- Общий contract suite для storage, traversal protection, fake MIME, oversized image, metadata stripping и orphan cleanup.
- Product ownership, немедленная публикация, hidden state, seller eligibility и текущие catalog filters.
- Regression: главная, категории и product detail продолжают работать с seeded PostgreSQL catalog.

## Этап 5. MessagingChannelAdapter, Telegram и outbox

### Общий messaging module

- Ввести normalized `ChannelMessage`, `ChannelAction` и `MessagingChannelAdapter`: metadata/capabilities, link initiation/confirmation, callback verification, send, decode action.
- Registry включает только адаптеры с валидной конфигурацией; API отдаёт доступные каналы и default provider.
- Создать link-intent service с 15-минутным одноразовым browser token. Seller intent привязан к authenticated seller; buyer intent до checkout привязан к browser secret.

### Telegram

- Создать бота через BotFather вне кода; token хранить только в env.
- Deep link `/start <short-token>` подтверждает link intent и сохраняет encrypted `chatId` плюс fingerprint.
- Seller connection UI опрашивает intent status, позволяет выбрать primary и отключить канал.
- Buyer checkout опрашивает intent до `confirmed`; неподтверждённый/просроченный intent нельзя использовать.
- Structured notifications: новая заявка, accepted/rejected/cancelled/completed, сводка checkout и ошибка доставки. Seller message содержит opaque inline action tokens, а не application ID/PII в callback data.

### Outbox worker

- Worker claim использует `FOR UPDATE SKIP LOCKED`, lease timeout и bounded batches.
- Event payload хранит только aggregate/event identifiers; worker загружает актуальные данные и расшифровывает destination непосредственно перед отправкой.
- Retry: bounded exponential backoff с jitter, максимальное число попыток из config; permanent errors сразу `failed`.
- Action-token service хранит короткие хешированные одноразовые/идемпотентные tokens, actor scope и expiry и вызывает общий application service.

### Проверка этапа

- Adapter contract suite запускается на fake adapter и Telegram adapter boundary mocks.
- Link expiry/replay/wrong actor, signature or bot secret rejection, primary uniqueness и final-channel behavior.
- Outbox commit atomicity, retry scheduling, worker lease recovery, duplicate delivery/idempotency и permanent failure.

## Этап 6. Корзина, групповой checkout и tracking

### Cart

- Изменить cart item на `{ productId, sellerId, quantity, productSnapshot }`; сохранить в versioned `localStorage` и безопасно сбрасывать несовместимую старую версию.
- Группировать отображение и subtotal по seller; убрать существующий фиктивный налог `+10%` и надпись о всегда бесплатной доставке.
- При загрузке checkout запросить серверную preflight-проверку, актуальные цены, eligibility продавца и delivery options.

### Checkout API

- `POST /api/checkout/validate` возвращает нормализованные seller groups и структурированные line/group errors без создания записей.
- `POST /api/checkout` принимает buyer fields, confirmed buyer link intent и per-seller delivery selections.
- В одной транзакции повторно проверить всё, consume link intent, создать group/applications/items/delivery snapshots/tracking hash и outbox events.
- Вернуть group ID и raw tracking token один раз; сохранить его в `sessionStorage` и отправить buyer summary через outbox.
- После успешного создания удалить из cart только принятые сервером позиции; при ошибке корзина остаётся.

### Tracking

- Token-protected group endpoint возвращает безопасные seller/application summaries и публичные store contacts, но не seller private channels/identity.
- Buyer `cancel` требует tracking token или подтверждённый order-scoped channel и допускается только из `new`.
- Tracking page показывает независимые статусы, доставку, суммы и доступные действия каждой заявки.

### Проверка этапа

- 1 seller -> 1 application; N sellers -> N applications; duplicate seller lines collapse into one application.
- Любая invalid/changed/hidden line, отсутствующий channel или delivery откатывает всю операцию.
- Server price authority, immutable item/delivery snapshots, integer totals, link-intent single consumption и tracking token isolation.
- Cart migration/persistence, grouped UI, failure preservation и selective clear on success.

## Этап 7. Обработка заявок и синхронизация интерфейсов

### Domain service

- Единый application transition service обслуживает dashboard, Telegram и buyer tracking.
- Реализовать матрицу `new -> accepted|rejected|cancelled`, `accepted -> completed`; остальные переходы возвращают current state и typed conflict.
- Conditional SQL update/row lock защищает от одновременных действий. Успешный переход пишет audit и outbox events в одной транзакции.

### Seller dashboard

- Список с фильтрами по статусу/дате, detail view со snapshot items/delivery/buyer contact и действиями согласно состоянию.
- Кабинет и Telegram показывают одну серверную версию статуса; после действия UI инвалидирует React Query cache.
- Dashboard показывает channel health и failed outbox events; explicit retry создаёт новую delivery attempt с тем же logical idempotency key.

### Notifications

- Seller получает новую заявку и итог каждого допустимого действия.
- Buyer получает сводку создания и каждое изменение по seller application.
- Сообщения не содержат passport/identity data; телефон покупателя включается только там, где нужен продавцу для обработки заявки, и не попадает в callback payload/logs.

### Проверка этапа

- Полная transition table, duplicate Telegram click, dashboard/Telegram race, blocked seller и чужая application.
- Audit/outbox создаются ровно для победившего перехода.
- UI и bot boundary tests подтверждают одинаковый итоговый status.

## Этап 8. Локализация, безопасность и эксплуатация

### UX и локализация

- Добавить новые ключи для украинского, английского и немецкого; украинский остаётся основным продуктовым текстом.
- Унифицировать money/unit/status formatting и доступные labels.
- Добавить loading/empty/error states, mobile grouped checkout и доступные focus/error summaries.

### Hardening

- Настроить Helmet/CSP с allowlist Google/Diia/Telegram только когда соответствующие adapters включены.
- Rate limits по IP и seller/session для auth, link intents, uploads, product create, checkout, tracking и actions.
- Redaction middleware/logging запрещает plaintext cookies, tokens, phone и chat destinations.
- Установить TTL cleanup jobs для sessions, link intents, action tokens и старых tracking credentials; сроки сделать явной конфигурацией и задокументировать.
- Добавить health/readiness: процесс, PostgreSQL, worker heartbeat, storage driver; внешний Telegram outage не делает основной API unready.

### Документация

- Обновить README: native PostgreSQL setup, миграции/seed, server/client/worker процессы, Telegram BotFather, development seller flow, тесты и ограничения MVP.
- Описать adapter extension guides для нового identity, messaging и file storage provider.
- Добавить production checklist: Diia partnership, S3 driver, HTTPS, secrets, backups, abuse blocking/admin minimum и privacy/retention rules.

### Финальная проверка

- На чистой `hutorynok_test` базе проходят unit, repository, API, adapter-contract и UI tests.
- `npm run build`, `npm run lint`, `npm test` успешны.
- Ручной acceptance из спецификации проходит с двумя development sellers и Telegram test bot.
- Проверить repository на committed secrets, plaintext test PII, upload artifacts и случайные DB credentials.

## Порядок небольших коммитов

1. `chore: add database and test foundations`
2. `feat: add marketplace schema and seed data`
3. `feat: add seller identity and sessions`
4. `feat: add seller profiles contacts and delivery`
5. `feat: add storage adapter and seller catalog`
6. `feat: add messaging adapters and telegram outbox`
7. `feat: add multi-seller checkout and tracking`
8. `feat: add application workflow and notifications`
9. `chore: harden marketplace and document setup`

Каждый коммит должен включать тесты своего поведения и оставлять build/lint/test зелёными. Установка PostgreSQL, создание Telegram-бота и получение будущих доступов Дії являются отдельными внешними действиями и не должны смешиваться с коммитами исходного кода.

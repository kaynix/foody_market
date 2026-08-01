# Добавление messenger-адаптера

Бизнес-логика не зависит от Telegram. Новый канал реализует интерфейс
`MessagingChannelAdapter` из `server/src/messaging/types.ts` и регистрируется в
`createMessagingRegistry`.

## Контракт

Адаптер обязан:

1. объявить стабильный `provider` и возможности в `metadata`;
2. создать ссылку привязки из непрозрачного одноразового provider token;
3. преобразовать входящий webhook/update в `link_confirmation` или `action`;
4. отправить текст и, если поддерживается, кнопки действий;
5. принимать `idempotencyKey` — повторная доставка не должна создавать
   пользователю дубликат, если API провайдера позволяет дедупликацию;
6. классифицировать необратимые ошибки как `PermanentChannelError`.

Destination (chat/user id) нельзя писать в логи или хранить открытым текстом.
Сервис link intent сам шифрует destination и сохраняет только fingerprint для
сопоставления callback. Никогда не помещайте provider token/action token в URL
клиента, audit metadata или сообщение ошибки.

## Последовательность добавления

1. Создайте `server/src/messaging/<provider>.ts` с transport-интерфейсом — это
   позволяет тестировать без реальной сети.
2. Добавьте валидируемые переменные в `config/env.ts` и `.env.example`.
3. Регистрируйте адаптер только при полном наборе credentials. Telegram остаётся
   каналом по умолчанию, если он подключён.
4. Добавьте webhook route с проверкой подписи/секретного заголовка до decode.
5. Напишите contract-тесты: deep link, malformed update, link confirmation,
   action, retryable/permanent send error и отсутствие секретов в ошибке.
6. Обновите production checklist и политику CSP/сетевой allowlist инфраструктуры.

Viber, WhatsApp или Signal не должны добавлять условия в checkout/application
services: вся провайдер-специфика остаётся внутри адаптера и HTTP transport.

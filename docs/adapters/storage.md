# Добавление файлового хранилища

Обработка изображений зависит только от `FileStorageAdapter` из
`server/src/storage/types.ts`: `put`, `delete`, `getPublicUrl`. Готовы два
драйвера: local для разработки и S3-compatible для production.

## S3-compatible настройка

```dotenv
STORAGE_DRIVER=s3
S3_REGION=auto
S3_BUCKET=hutorynok-images
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_PUBLIC_URL=https://cdn.example.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=false
```

Для AWS endpoint можно не задавать, а credentials можно получить через IAM
role. Bucket/CDN должен публично отдавать объекты только на чтение. Приложению
нужны `PutObject` и `DeleteObject` только для настроенного bucket; list и доступ
к другим bucket не требуются.

## Требования к новому драйверу

- ключ рассматривается как непрозрачный относительный путь; `..`, абсолютные
  пути и backslash отклоняются;
- запись либо завершается полностью, либо бросает ошибку;
- delete идемпотентен для отсутствующего объекта;
- публичный URL кодирует каждый сегмент ключа;
- credentials никогда не попадают в URL, БД и логи;
- нужны contract-тесты URL/path traversal и transport-тесты put/delete.

`ProductImageProcessor` уже валидирует реальный MIME, пиксели, размер, анимацию,
создаёт WebP-варианты и удаляет ранее загруженные варианты при частичной ошибке.

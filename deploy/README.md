# Deploy

Конвейер копирует шаблон `constr-todo-web`: GitHub Actions по `push: master`
тригерит SSH-скрипт, который на сервере делает `git pull`, `docker build`,
рестарт контейнера и health-check с авто-rollback на предыдущий образ.
TLS терминируется на host nginx (см. `nginx/hr-todo-web.conf`), контейнер
слушает только loopback на `127.0.0.1:3005 → 3004`.

## Repo secrets

В Settings → Secrets and variables → Actions:

| Имя                    | Что                                                                     |
| ---------------------- | ----------------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`   | Токен бота для уведомлений                                              |
| `TELEGRAM_CHAT_ID`     | Чат/канал, куда летят сообщения о деплое                                |
| `DEPLOY_HOST`          | Хост сервера (например, `hr.example.com`)                               |
| `DEPLOY_USER`          | SSH-юзер (с правом `sudo docker ...` без пароля)                        |
| `DEPLOY_SSH_KEY`       | Приватный SSH-ключ (PEM/OpenSSH) для входа                              |
| `DEPLOY_PATH`          | Родительский каталог на сервере, внутри которого склонирован репозиторий как `hr-todo-web` |
| `HRWEB_API_URL`        | URL бэка, на который проксирует server.js (например, `http://localhost:3008`) |
| `HOST_PORT`            | (опционально) хост-порт; по умолчанию `3005`                           |
| `DEPLOY_DOMAIN`        | (опционально) домен для ссылки в сообщении об успехе, например `hr.example.com` |

## First-time bootstrap (сервер)

```bash
# под $DEPLOY_USER
mkdir -p "$DEPLOY_PATH"
cd "$DEPLOY_PATH"
git clone https://github.com/<owner>/<repo>.git hr-todo-web
cd hr-todo-web

# первый сборка/запуск — дальше всё делает workflow
sudo docker build -t hr-todo-web:latest .
sudo docker run -d \
  --name hr-todo-web \
  --restart unless-stopped \
  -p 127.0.0.1:3005:3004 \
  -e HTTP_PORT=3004 \
  -e API_URL="http://localhost:3008" \
  hr-todo-web:latest

# nginx
sudo cp deploy/nginx/hr-todo-web.conf /etc/nginx/sites-available/hr-todo-web
sudo sed -i 's|<DOMAIN>|hr.example.com|g'                     /etc/nginx/sites-available/hr-todo-web
sudo sed -i 's|<CERT_DIR>|/etc/letsencrypt/live/hr.example.com|g' /etc/nginx/sites-available/hr-todo-web
sudo ln -sf /etc/nginx/sites-available/hr-todo-web /etc/nginx/sites-enabled/hr-todo-web
sudo nginx -t && sudo systemctl reload nginx

# certbot, если ещё нет сертификата
sudo certbot --nginx -d hr.example.com
```

## Что делает workflow

1. Уведомление **start** → Telegram.
2. SSH на сервер, `git reset --hard origin/master`.
3. Тегаем текущий `hr-todo-web:latest` как `:prev` (для отката).
4. `docker build --no-cache -t hr-todo-web:latest .`.
5. Стопаем/удаляем контейнер, поднимаем новый из `:latest`.
6. 5 раз с интервалом 3 с дёргаем `/__health` (эндпоинт в `server.js`).
7. Если health не прошёл → откатываемся на `:prev` и валим job → **failure** в TG.
8. Если ок → **success** в TG со ссылкой на `https://$DEPLOY_DOMAIN`.

## Локальный запуск

```bash
make build && make run        # 127.0.0.1:3005 → 3004
make logs                     # хвост логов
make stop rm                  # остановить и удалить
make compose-up               # альтернатива через docker compose
```

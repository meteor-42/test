# 🔒 XMR Tor Paywall

Анонимный paywall сервис с оплатой через Monero для работы в сети Tor.

---

## 🚀 Быстрый старт

### Требования
- Linux сервер (CentOS 8+ / RHEL 8+ / Rocky Linux 8+)
- Node.js 14+
- Tor
- Monero Wallet RPC
- **Готовый кошелек Monero (адрес + seed фраза)**
- **Готовый Tor Hidden Service (hostname + ключи)**

### Установка

Скрипт установки теперь поддерживает импорт существующего кошелька и Tor hidden service.

```bash
# 1. Клонировать репозиторий
git clone https://github.com/meteor-42/xmr.git
cd xmr

# 2. Подготовить данные для импорта
# Разместите файлы в следующих директориях:
# - ~/.monero-wallet/payment-wallet (файл кошелька)
# - ~/.monero-wallet/payment-wallet.keys (ключи кошелька)
# - ~/tor-backup/hostname (onion адрес)
# - ~/tor-backup/hs_ed25519_secret_key (секретный ключ Tor)
# - ~/tor-backup/hs_ed25519_public_key (публичный ключ Tor)

# 3. Запустить установку
sudo bash install.sh

# Скрипт спросит:
# - Seed фразу кошелька (25 слов)
# - Пароль кошелька
# - Путь к backup файлам Tor (если есть)

# 4. Настроить .env файл
nano .env

# 5. Перезапустить сервисы
sudo systemctl restart monero-wallet-rpc
sudo systemctl restart xmr-paywall
```

**Готово!** Сервер запущен и доступен через Tor.

---

## 📖 Импорт существующего кошелька

### Способ 1: Через seed фразу (рекомендуется)

```bash
# Восстановить кошелек из seed
monero-wallet-cli --generate-from-seed ~/.monero-wallet/payment-wallet

# Следуйте инструкциям:
# 1. Введите seed фразу (25 слов)
# 2. Введите пароль для кошелька
# 3. Дождитесь синхронизации
```

### Способ 2: Через готовые файлы кошелька

```bash
# Скопировать существующий кошелек
mkdir -p ~/.monero-wallet
cp /path/to/backup/payment-wallet ~/.monero-wallet/
cp /path/to/backup/payment-wallet.keys ~/.monero-wallet/
chmod 600 ~/.monero-wallet/*
```

### Получить адрес кошелька

```bash
monero-wallet-cli --wallet-file ~/.monero-wallet/payment-wallet
# В консоли: address
# Скопируйте адрес и вставьте в .env
```

---

## 🧅 Импорт Tor Hidden Service

### Восстановление из backup

Если у вас есть backup Tor hidden service (hostname + ключи):

```bash
# 1. Создать директорию
sudo mkdir -p /var/lib/tor/blog_service/

# 2. Скопировать файлы
sudo cp ~/tor-backup/hostname /var/lib/tor/blog_service/
sudo cp ~/tor-backup/hs_ed25519_secret_key /var/lib/tor/blog_service/
sudo cp ~/tor-backup/hs_ed25519_public_key /var/lib/tor/blog_service/

# 3. Установить права (пользователь toranon для CentOS/RHEL)
sudo chown -R toranon:toranon /var/lib/tor/blog_service/
sudo chmod 700 /var/lib/tor/blog_service/
sudo chmod 600 /var/lib/tor/blog_service/*

# 4. Обновить torrc
sudo nano /etc/tor/torrc
```

Добавьте:
```
# XMR Paywall Hidden Service
HiddenServiceDir /var/lib/tor/blog_service/
HiddenServicePort 80 127.0.0.1:8080
```

```bash
# 5. Перезапустить Tor
sudo systemctl restart tor

# 6. Проверить onion адрес
sudo cat /var/lib/tor/blog_service/hostname
```

---

## ⚙️ Конфигурация .env

Ключевые параметры, которые **обязательно** нужно изменить:

```env
# Onion адрес вашего hidden service
ONION_ADDRESS=ваш-адрес.onion

# Monero адрес для приема платежей (основной адрес из кошелька)
XMR_ADDRESS=49YUQe...

# Цена доступа в XMR
XMR_PAYMENT_AMOUNT=0.1

# Контактные данные
CONTACT_EMAIL=ваш-email@proton.me
GPG_FINGERPRINT=ваш-gpg-fingerprint

# Monero RPC (локальный)
XMR_RPC_URL=http://127.0.0.1:18083/json_rpc
XMR_ACCOUNT_INDEX=0
XMR_CONFIRMATIONS=2
```

Полный список параметров смотрите в файле `.env`

---

## 🏗️ Архитектура

```
┌─────────────┐
│   Tor       │  Hidden Service на порту 80
│   Network   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  server.js  │  HTTP сервер (0.0.0.0:8080)
│             │  • Paywall страница
│             │  • Проверка доступа
│             │  • Раздача контента
└──────┬──────┘
       │
       ▼
┌──────────────┐
│xmr-manager.js│  Объединённый модуль
│              │  • Проверка токенов
│              │  • Мониторинг платежей
│              │  • Управление БД
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Monero RPC   │
│ :18083       │
└──────────────┘
```

---

## 🔐 Безопасность

### ✅ Реализовано
- Работа только через Tor
- Проверка платежей через Monero RPC
- Генерация уникальных subaddress для каждого платежа
- Токены доступа для авторизованных пользователей
- Rate limiting
- No-cache заголовки

### ⚠️ Рекомендации
- Регулярное резервное копирование seed фразы (НЕ на сервере!)
- Регулярное резервное копирование Tor ключей
- Регулярный вывод средств с платежного кошелька
- Мониторинг логов на подозрительную активность

---

## 📊 Как это работает

1. **Пользователь заходит на .onion сайт**
   - Видит paywall с уникальным ACCESS-кодом
   - Получает Monero subaddress для оплаты

2. **Отправляет платеж**
   - Переводит XMR на указанный адрес
   - Ждет подтверждения (обычно 1-2 минуты)

3. **Мониторинг платежа**
   - `xmr-manager.js` каждые 15 секунд проверяет входящие транзакции
   - При достаточном количестве подтверждений генерирует access token

4. **Получение доступа**
   - Пользователь вводит свой ACCESS-код
   - Система проверяет статус платежа
   - При успехе выдает токен и редиректит на контент

5. **Доступ к контенту**
   - Токен автоматически добавляется ко всем ссылкам
   - Доступ активен пока не удален из БД

---

## 🛠️ Структура проекта

```
xmr/
├── server.js              # Основной HTTP сервер
├── xmr-manager.js         # Объединённый модуль (payments + monitoring + auth)
├── rate-limiter.js        # Rate limiting
├── .env                   # Конфигурация (НЕ коммитить!)
├── package.json           # Зависимости
├── payments.json          # База платежей (генерируется)
├── install.sh             # Скрипт установки с импортом
├── public/
│   ├── main.css          # Стили
│   ├── templates/        # HTML шаблоны
│   └── downloads/        # Файлы для скачивания
└── README.md             # Этот файл
```

### Оптимизация кода

**Устранены файлы-дубликаты:**
- ❌ `auth.js` - объединён в `xmr-manager.js`
- ❌ `payments-manager.js` - объединён в `xmr-manager.js`
- ❌ `xmr-monitor.js` - объединён в `xmr-manager.js`

**Новый модуль `xmr-manager.js` включает:**
- Мониторинг платежей через Monero RPC
- Управление базой данных платежей
- Проверку токенов доступа
- Очистку старых pending платежей

---

## 📈 Мониторинг

### Логи
```bash
# Логи приложения
sudo journalctl -u xmr-paywall -f

# Логи Tor
sudo journalctl -u tor -f

# Логи Monero RPC
tail -f /var/log/monero-wallet-rpc.log
```

### Статус сервисов
```bash
sudo systemctl status xmr-paywall
sudo systemctl status tor
sudo systemctl status monero-wallet-rpc
```

### База платежей
```bash
# Просмотр всех платежей
cat payments.json | jq

# Только подтвержденные
cat payments.json | jq 'to_entries | map(select(.value.status == "confirmed"))'

# Количество pending платежей
cat payments.json | jq 'to_entries | map(select(.value.status == "pending")) | length'
```

---

## ⚡ Быстрые команды

### Управление сервисами
```bash
# Запуск
sudo systemctl start tor monero-wallet-rpc xmr-paywall

# Остановка
sudo systemctl stop xmr-paywall monero-wallet-rpc tor

# Перезапуск
sudo systemctl restart xmr-paywall

# Статус
sudo systemctl status xmr-paywall
```

### Проверка работоспособности
```bash
# Получить onion адрес
sudo cat /var/lib/tor/blog_service/hostname

# Проверить RPC подключение
curl -X POST http://127.0.0.1:18083/json_rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"0","method":"get_balance","params":{"account_index":0}}'

# Тест через Tor
torsocks curl http://ваш-адрес.onion
```

---

## 💾 Резервное копирование

### Backup кошелька
```bash
# КРИТИЧНО: Сохраните seed фразу в безопасном месте!
monero-wallet-cli --wallet-file ~/.monero-wallet/payment-wallet
# В консоли: seed

# Backup файлов кошелька
mkdir -p ~/backups/monero-$(date +%Y%m%d)
cp ~/.monero-wallet/payment-wallet ~/backups/monero-$(date +%Y%m%d)/
cp ~/.monero-wallet/payment-wallet.keys ~/backups/monero-$(date +%Y%m%d)/
```

### Backup Tor hidden service
```bash
# Backup ключей Tor
mkdir -p ~/backups/tor-$(date +%Y%m%d)
sudo cp /var/lib/tor/blog_service/hostname ~/backups/tor-$(date +%Y%m%d)/
sudo cp /var/lib/tor/blog_service/hs_ed25519_secret_key ~/backups/tor-$(date +%Y%m%d)/
sudo cp /var/lib/tor/blog_service/hs_ed25519_public_key ~/backups/tor-$(date +%Y%m%d)/
sudo chown $USER:$USER ~/backups/tor-$(date +%Y%m%d)/*
```

### Автоматический backup
```bash
# Создать скрипт
sudo nano /usr/local/bin/xmr-backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/xmr"
mkdir -p "$BACKUP_DIR"

# Backup критичных файлов
tar -czf "$BACKUP_DIR/xmr-backup-$DATE.tar.gz" \
    -C /var/www/xmr \
    .env payments.json

# Удалить старые (>30 дней)
find "$BACKUP_DIR" -name "xmr-backup-*.tar.gz" -mtime +30 -delete
```

```bash
# Сделать исполняемым
sudo chmod +x /usr/local/bin/xmr-backup.sh

# Добавить в cron (ежедневно в 3:00)
sudo crontab -e
# Добавить: 0 3 * * * /usr/local/bin/xmr-backup.sh
```

---

## 🔧 Возможные проблемы

| Проблема | Решение |
|----------|---------|
| RPC не отвечает | `sudo systemctl restart monero-wallet-rpc` |
| Onion недоступен | `sudo systemctl restart tor` |
| Платежи не подтверждаются | Проверить синхронизацию blockchain |
| Ошибки в логах | `sudo journalctl -u xmr-paywall -n 100` |
| Кошелек не синхронизируется | Проверить daemon connection в логах RPC |

### Диагностика

```bash
# Проверка портов
sudo netstat -tulpn | grep -E "8080|18083"

# Проверка процессов
ps aux | grep -E "node|monero|tor"

# Локальный тест
curl http://127.0.0.1:8080

# Полная диагностика
for svc in tor monero-wallet-rpc xmr-paywall; do
    echo "=== $svc ==="
    sudo systemctl status $svc | grep Active
done
```

---

## 🔐 Настройка безопасности

### Firewall
```bash
# Настройка firewalld (CentOS/RHEL)
sudo systemctl enable firewalld
sudo systemctl start firewalld

# Закрыть порты 8080 и 18083 (должны быть доступны только локально)
sudo firewall-cmd --permanent --remove-port=8080/tcp
sudo firewall-cmd --permanent --remove-port=18083/tcp
sudo firewall-cmd --reload

# Проверка
sudo firewall-cmd --list-all
```

### Права доступа
```bash
cd /var/www/xmr
chmod 600 .env
chmod 600 payments.json
chmod 600 ~/.monero-wallet/*
```

### SELinux (CentOS/RHEL)
```bash
sudo semanage port -a -t http_port_t -p tcp 8080
sudo setsebool -P httpd_can_network_connect 1
```

---

## 📜 Лицензия

MIT License - свободное использование

---

## ⚠️ Disclaimer

Этот проект предоставляется "как есть" только для образовательных целей.

**Важно**:
- Используйте только для легальных целей
- Соблюдайте законы вашей юрисдикции
- Авторы не несут ответственности за использование ПО
- Криптовалютные операции могут быть регулируемы в вашей стране
- **ВСЕГДА храните seed фразу в безопасном месте** (НЕ на сервере!)
- **Регулярно делайте backup Tor ключей**

---

## 🔗 Полезные ссылки

- [Monero Official](https://www.getmonero.org/)
- [Tor Project](https://www.torproject.org/)
- [Monero RPC Docs](https://www.getmonero.org/resources/developer-guides/wallet-rpc.html)
- [Tor Hidden Services Guide](https://community.torproject.org/onion-services/)

---

**Stay anonymous. Stay secure.** 🔒

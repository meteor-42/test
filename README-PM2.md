# XMR Tor Paywall - PM2 Version

Анонимный сервис платного доступа с приёмом платежей в Monero через Tor с управлением процессами через PM2.

## Изменения в этой версии

- **Управление процессами:** systemd заменён на PM2
- **Логирование:** Emoji заменены на ASCII префиксы (🔒 → `[SERVER]`, ✅ → `[OK]`, ❌ → `[ERROR]`)

---

## Системные требования

- **ОС:** CentOS/RHEL/Rocky Linux 8+
- **Node.js:** 14.0.0+
- **RAM:** Минимум 2GB
- **Disk:** 20GB+ (для синхронизации Monero)
- **Root доступ** для установки

---

## Подготовительные работы

### 1. Подготовка сервера

```bash
# Обновление системы
sudo dnf update -y

# Установка базовых пакетов
sudo dnf install -y git wget curl tar bzip2 jq
```

### 2. Подготовка Monero кошелька (опционально)

Если у вас уже есть кошелёк Monero:

**Вариант A: Сохраните seed фразу (25 слов)**
- Она понадобится при установке для восстановления кошелька

**Вариант B: Сохраните файлы кошелька**
```bash
# Скопируйте эти файлы в безопасное место:
~/.monero-wallet/payment-wallet
~/.monero-wallet/payment-wallet.keys
```

### 3. Подготовка Tor Hidden Service (опционально)

Если у вас уже есть onion адрес:

```bash
# Сохраните эти файлы:
/var/lib/tor/your_service/hostname
/var/lib/tor/your_service/hs_ed25519_secret_key
/var/lib/tor/your_service/hs_ed25519_public_key
```

---

## Быстрая установка

### Автоматическая установка

```bash
# Клонировать репозиторий
git clone https://github.com/meteor-42/xmr.git
cd xmr

# Запустить скрипт установки
sudo bash install-pm2.sh
```

Скрипт автоматически:
1. Установит Node.js и PM2
2. Установит Tor и Monero Wallet RPC
3. Настроит кошелёк (импорт или создание нового)
4. Настроит Tor Hidden Service
5. Запустит сервисы через PM2

---

## Ручная установка

### Шаг 1: Установка зависимостей

```bash
# Установка Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# Установка PM2
sudo npm install -g pm2

# Установка Tor
sudo dnf install -y epel-release tor

# Установка Monero Wallet RPC
cd /tmp
wget https://downloads.getmonero.org/cli/linux64 -O monero.tar.bz2
tar -xjf monero.tar.bz2
sudo find . -name "monero-wallet-rpc" -exec cp {} /usr/local/bin/ \;
sudo find . -name "monero-wallet-cli" -exec cp {} /usr/local/bin/ \;
sudo chmod +x /usr/local/bin/monero-wallet-*
rm -rf monero* linux64
```

### Шаг 2: Создание/импорт Monero кошелька

**Создать новый кошелёк:**
```bash
mkdir -p ~/.monero-wallet
monero-wallet-cli --generate-new-wallet ~/.monero-wallet/payment-wallet
# Сохраните seed фразу в безопасном месте!
```

**Импортировать из seed фразы:**
```bash
mkdir -p ~/.monero-wallet
monero-wallet-cli --generate-from-seed ~/.monero-wallet/payment-wallet
```

**Импортировать из файлов:**
```bash
mkdir -p ~/.monero-wallet
cp /путь/к/backup/payment-wallet* ~/.monero-wallet/
chmod 600 ~/.monero-wallet/payment-wallet*
```

**Получить адрес кошелька:**
```bash
monero-wallet-cli --wallet-file ~/.monero-wallet/payment-wallet
# В консоли кошелька введите: address
# Скопируйте адрес (начинается с "4")
```

### Шаг 3: Настройка Tor Hidden Service

**Настроить torrc:**
```bash
sudo tee -a /etc/tor/torrc << EOF

# XMR Paywall Hidden Service
HiddenServiceDir /var/lib/tor/blog_service/
HiddenServicePort 80 127.0.0.1:8080
EOF
```

**Импорт существующего Hidden Service (опционально):**
```bash
sudo mkdir -p /var/lib/tor/blog_service
sudo cp /путь/к/backup/hostname /var/lib/tor/blog_service/
sudo cp /путь/к/backup/hs_ed25519_* /var/lib/tor/blog_service/
sudo chown -R toranon:toranon /var/lib/tor/blog_service  # или tor:tor
sudo chmod 700 /var/lib/tor/blog_service
sudo chmod 600 /var/lib/tor/blog_service/*
```

**Запустить Tor:**
```bash
sudo systemctl enable tor
sudo systemctl start tor
sleep 5

# Получить onion адрес
sudo cat /var/lib/tor/blog_service/hostname
```

### Шаг 4: Установка приложения

```bash
# Клонировать репозиторий
git clone https://github.com/meteor-42/xmr.git
cd xmr

# Установить зависимости
npm install
```

### Шаг 5: Настройка .env

```bash
nano .env
```

Основные параметры:
```env
# Monero Configuration
XMR_ADDRESS=ваш_monero_адрес_начинающийся_с_4
XMR_PAYMENT_AMOUNT=0.01
XMR_RPC_URL=http://127.0.0.1:18083/json_rpc
XMR_CONFIRMATIONS=2

# Tor Configuration
ONION_ADDRESS=ваш_адрес.onion

# Contact Information
CONTACT_EMAIL=ваш@email.onion
GPG_FINGERPRINT=ваш_gpg_fingerprint
KEYSERVER_URL=http://ваш_keyserver.onion

# Site Metadata
SITE_TITLE=Ваше название
SITE_DESCRIPTION=Описание вашего сайта
```

### Шаг 6: Настройка PM2 Ecosystem

```bash
nano ecosystem.config.js
```

Обновите:
- `args` в `monero-wallet-rpc`: укажите пароль вашего кошелька
- Пути к файлам кошелька

```javascript
module.exports = {
  apps: [
    {
      name: 'monero-wallet-rpc',
      script: '/usr/local/bin/monero-wallet-rpc',
      args: '--wallet-file /home/user/.monero-wallet/payment-wallet --password "YOUR_PASSWORD" --rpc-bind-port 18083 --rpc-bind-ip 127.0.0.1 --disable-rpc-login --daemon-address node.moneroworld.com:18089 --trusted-daemon',
      interpreter: 'none',
      autorestart: true,
      // ... остальные настройки
    },
    {
      name: 'xmr-paywall',
      script: 'server.js',
      // ... остальные настройки
    }
  ]
};
```

### Шаг 7: Запуск сервисов

```bash
# Запустить сервисы
pm2 start ecosystem.config.js

# Сохранить список процессов
pm2 save

# Настроить автозапуск при загрузке системы
pm2 startup
# Выполните команду, которую выдаст pm2 startup
```

### Шаг 8: Проверка

```bash
# Проверить статус
pm2 status

# Просмотр логов
pm2 logs

# Проверить работу сервера
curl http://127.0.0.1:8080/health

# Проверить onion адрес
sudo cat /var/lib/tor/blog_service/hostname
```

---

## Управление сервисами

### Основные команды

```bash
# Просмотр статуса
pm2 status

# Просмотр логов
pm2 logs

# Просмотр логов конкретного сервиса
pm2 logs xmr-paywall
pm2 logs monero-wallet-rpc

# Перезапуск всех сервисов
pm2 restart all

# Перезапуск конкретного сервиса
pm2 restart xmr-paywall

# Остановка всех сервисов
pm2 stop all

# Удаление всех сервисов из PM2
pm2 delete all
```

### NPM скрипты

```bash
npm start        # Запустить сервисы
npm stop         # Остановить сервисы
npm restart      # Перезапустить сервисы
npm run logs     # Просмотр логов
npm run status   # Просмотр статуса
```

### Мониторинг

```bash
# Интерактивный мониторинг
pm2 monit

# Подробная информация
pm2 show xmr-paywall
```

---

## Настройка Firewall

```bash
# Закрыть порты (доступ только через Tor)
sudo firewall-cmd --permanent --remove-port=8080/tcp
sudo firewall-cmd --permanent --remove-port=18083/tcp
sudo firewall-cmd --reload
```

---

## Резервное копирование

### Автоматический backup скрипт

Создаётся автоматически при установке: `/usr/local/bin/xmr-backup.sh`

```bash
# Выполнить backup вручную
sudo /usr/local/bin/xmr-backup.sh

# Добавить в crontab для автоматического backup
crontab -e
# Добавить строку:
0 3 * * * /usr/local/bin/xmr-backup.sh
```

### Что нужно сохранять

1. **Seed фраза кошелька** (КРИТИЧЕСКИ ВАЖНО!)
   - Храните в безопасном месте, НЕ на сервере

2. **Файлы кошелька:**
   ```bash
   ~/.monero-wallet/payment-wallet
   ~/.monero-wallet/payment-wallet.keys
   ```

3. **Tor ключи:**
   ```bash
   /var/lib/tor/blog_service/hostname
   /var/lib/tor/blog_service/hs_ed25519_secret_key
   /var/lib/tor/blog_service/hs_ed25519_public_key
   ```

4. **Конфигурация:**
   ```bash
   .env
   ecosystem.config.js
   payments.json
   ```

---

## Обновление

```bash
# Остановить сервисы
pm2 stop all

# Обновить код
git pull

# Установить зависимости
npm install

# Перезапустить сервисы
pm2 restart all

# Сохранить
pm2 save
```

---

## Troubleshooting

### Сервисы не запускаются

```bash
# Проверить логи
pm2 logs --err

# Проверить конфигурацию
pm2 show xmr-paywall

# Полный перезапуск
pm2 delete all
pm2 start ecosystem.config.js
```

### Monero RPC не подключается

```bash
# Проверить статус
pm2 logs monero-wallet-rpc

# Проверить пароль в ecosystem.config.js
nano ecosystem.config.js

# Перезапустить
pm2 restart monero-wallet-rpc
```

### Платежи не подтверждаются

```bash
# Проверить RPC подключение
curl -X POST http://127.0.0.1:18083/json_rpc -d '{"jsonrpc":"2.0","id":"0","method":"get_balance"}' -H 'Content-Type: application/json'

# Проверить логи мониторинга
pm2 logs xmr-paywall | grep MONITOR

# Проверить файл платежей
cat payments.json
```

### PM2 не запускается при перезагрузке

```bash
# Настроить startup
pm2 startup
# Выполнить команду, которую выдаст PM2

# Сохранить список процессов
pm2 save
```

---

## Префиксы логов

| Префикс | Значение |
|---------|----------|
| `[SERVER]` | Статус сервера |
| `[OK]` | Успешная операция |
| `[ERROR]` | Ошибка |
| `[WARNING]` | Предупреждение |
| `[XMR]` | Monero операции |
| `[TOR]` | Tor операции |
| `[DB]` | База данных |
| `[MONITOR]` | Мониторинг платежей |
| `[INFO]` | Информация |
| `[INIT]` | Инициализация |

---

## Безопасность

### Обязательно

- ✓ Никогда не публикуйте `.env` файл
- ✓ Никогда не публикуйте `ecosystem.config.js` (содержит пароль)
- ✓ Храните seed фразу в безопасном месте (НЕ на сервере!)
- ✓ Регулярно делайте backup Tor ключей
- ✓ Регулярно выводите средства с платёжного кошелька
- ✓ Используйте сильный пароль для кошелька

### Рекомендуется

- Настройте fail2ban
- Используйте SELinux в enforcing режиме
- Регулярно обновляйте систему
- Мониторьте логи на подозрительную активность
- Используйте отдельный кошелёк только для платежей

---

## Структура файлов

```
xmr/
├── ecosystem.config.js       # PM2 конфигурация
├── install-pm2.sh           # Скрипт установки
├── server.js                # Основной сервер
├── xmr-monitor.js           # Мониторинг платежей
├── rate-limiter.js          # Rate limiting
├── package.json             # NPM зависимости
├── .env                     # Конфигурация (создать вручную)
├── payments.json            # База платежей (создаётся автоматически)
└── public/                  # Публичные файлы
    ├── main.css
    ├── templates/
    │   └── paywall.html
    └── downloads/           # Файлы для скачивания
```

---

## FAQ

**Q: Какая версия Monero поддерживается?**
A: Последняя стабильная версия Monero CLI (скрипт скачивает автоматически)

**Q: Можно ли использовать другой remote node?**
A: Да, измените `--daemon-address` в `ecosystem.config.js`

**Q: Сколько времени занимает подтверждение платежа?**
A: Обычно 1-2 минуты после достижения требуемого количества подтверждений (по умолчанию 2)

**Q: Можно ли изменить цену?**
A: Да, измените `XMR_PAYMENT_AMOUNT` в `.env` файле

**Q: Как изменить порт сервера?**
A: Измените `PORT` в `.env` и обновите `HiddenServicePort` в `/etc/tor/torrc`

**Q: Можно ли использовать на Ubuntu/Debian?**
A: Да, но измените команды `dnf` на `apt` и адаптируйте скрипт установки

---

## Поддержка

Для вопросов и проблем:
- Проверьте логи: `pm2 logs`
- Проверьте статус: `pm2 status`
- Проверьте конфигурацию: `.env` и `ecosystem.config.js`

---

## Лицензия

MIT License

## Автор

Original: ZeroTrails
PM2 Migration: Custom

---

**Stay anonymous. Stay secure.** 🔒

# 🧅 Запуск XMR Paywall в сети Tor

Полная инструкция по развертыванию анонимного paywall сервиса с оплатой через Monero в сети Tor.

---

## 📋 Требования для работы в Tor

### 1. **Системные требования**
- Linux сервер (CentOS 8+ / Rocky Linux 8+ / RHEL 8+ рекомендуется)
- Минимум 2GB RAM
- 20GB свободного места на диске
- Root или sudo доступ

### 2. **Необходимое программное обеспечение**

#### A. Tor Browser / Tor Service
```bash
# Установка Tor на CentOS/RHEL
sudo dnf update
sudo dnf install tor -y

# Проверка статуса
sudo systemctl status tor
```

#### B. Node.js (v14+)
```bash
# Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo dnf install -y nodejs

# Проверка версии
node --version
npm --version
```

#### C. Monero Wallet RPC
```bash
# Скачать Monero CLI с официального сайта
wget https://downloads.getmonero.org/cli/linux64

# Распаковать архив
tar -xvf linux64

# Переместить в /usr/local/bin
sudo mv monero-x86_64-linux-gnu-*/monero* /usr/local/bin/

# Проверка
monero-wallet-rpc --version
```

---

## 🚀 Установка и настройка

### Шаг 1: Клонирование проекта
```bash
cd /var/www/
git clone https://github.com/meteor-42/xmr.git
cd xmr
npm install
```

### Шаг 2: Создание и настройка Monero кошелька

#### Создать новый кошелек
```bash
# Создать директорию для кошелька
mkdir -p ~/.monero-wallet

# Создать кошелек
monero-wallet-cli --generate-new-wallet ~/.monero-wallet/payment-wallet

# Следуйте инструкциям:
# 1. Установите пароль
# 2. Выберите язык
# 3. ОБЯЗАТЕЛЬНО сохраните seed phrase (25 слов) в безопасном месте!
```

#### Получить адрес кошелька
```bash
# Запустить кошелек
monero-wallet-cli --wallet-file ~/.monero-wallet/payment-wallet

# В консоли кошелька введите команды:
address  # Показать основной адрес
seed     # Показать seed (храните в безопасности!)
exit     # Выйти
```

#### Запустить Monero Wallet RPC
```bash
# Создать systemd сервис
sudo nano /etc/systemd/system/monero-wallet-rpc.service
```

Вставьте следующее содержимое:
```ini
[Unit]
Description=Monero Wallet RPC
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME
ExecStart=/usr/local/bin/monero-wallet-rpc \
    --wallet-file /home/YOUR_USERNAME/.monero-wallet/payment-wallet \
    --password 'YOUR_WALLET_PASSWORD' \
    --rpc-bind-port 18083 \
    --rpc-bind-ip 127.0.0.1 \
    --disable-rpc-login \
    --daemon-address node.moneroworld.com:18089 \
    --trusted-daemon \
    --log-file /var/log/monero-wallet-rpc.log
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**⚠️ ВАЖНО**: Замените `YOUR_USERNAME` и `YOUR_WALLET_PASSWORD`!

```bash
# Запустить сервис
sudo systemctl daemon-reload
sudo systemctl enable monero-wallet-rpc
sudo systemctl start monero-wallet-rpc

# Проверить статус
sudo systemctl status monero-wallet-rpc
sudo tail -f /var/log/monero-wallet-rpc.log
```

### Шаг 3: Настройка Tor Hidden Service

#### Редактировать конфигурацию Tor
```bash
sudo nano /etc/tor/torrc
```

Добавьте в конец файла:
```
# Hidden Service для XMR Paywall
HiddenServiceDir /var/lib/tor/web/
HiddenServicePort 80 127.0.0.1:8080
```

#### Перезапустить Tor
```bash
sudo systemctl restart tor

# Подождать несколько секунд, затем получить onion адрес
sudo cat /var/lib/tor/web/hostname
```

**Сохраните полученный .onion адрес!** Это будет ваш анонимный адрес сайта.

### Шаг 4: Настройка .env файла

```bash
cd /var/www/xmr
nano .env
```

Обновите следующие параметры:

```env
# ОБЯЗАТЕЛЬНО ИЗМЕНИТЬ:
ONION_ADDRESS=ваш-адрес.onion  # Из предыдущего шага
XMR_ADDRESS=ваш-monero-адрес  # Основной адрес кошелька
XMR_ADDRESS=ваш-monero-адрес  # Тот же адрес

CONTACT_EMAIL=ваш-email@proton.me
GPG_FINGERPRINT=ваш-gpg-fingerprint

# Настройки цены
XMR_PRICE=1  # Цена в XMR (например, 0.1 XMR)
XMR_PRICE=1  # Должна совпадать с XMR_PRICE

# RPC настройки
XMR_RPC_URL=http://127.0.0.1:18083/json_rpc
XMR_RPC_USERNAME=  # Оставьте пустым если используете --disable-rpc-login
XMR_RPC_PASSWORD=  # Оставьте пустым если используете --disable-rpc-login
```

### Шаг 5: Создание GPG ключа (опционально)

```bash
# Генерация GPG ключа
gpg --full-generate-key

# Следуйте инструкциям, выберите:
# - Тип: RSA and RSA
# - Размер: 4096
# - Срок действия: 0 (не истекает)

# Получить fingerprint
gpg --fingerprint ваш-email@proton.me

# Экспортировать публичный ключ
gpg --armor --export ваш-email@proton.me > public/downloads/gpg-key.asc
```

### Шаг 6: Запуск приложения

#### Тестовый запуск
```bash
cd /var/www/xmr
npm install
node server.js
```

Если все работает, вы увидите:
```
🔒 Tor server running on http://0.0.0.0:8080
🌐 Configure Tor with:
HiddenServiceDir /var/lib/tor/web/
HiddenServicePort 80 0.0.0.0:8080
```

#### Создание systemd сервиса для автозапуска
```bash
sudo nano /etc/systemd/system/xmr-paywall.service
```

Вставьте:
```ini
[Unit]
Description=XMR Tor Paywall Service
After=network.target tor.service monero-wallet-rpc.service

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/var/www/xmr
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
# Активировать сервис
sudo systemctl daemon-reload
sudo systemctl enable xmr-paywall
sudo systemctl start xmr-paywall

# Проверить статус
sudo systemctl status xmr-paywall
```

---

## 🔧 Проверка работоспособности

### 1. Проверить доступность через Tor
```bash
# Установить torify/torsocks
sudo dnf install torsocks

# Проверить onion сайт
torsocks curl http://ваш-адрес.onion
```

### 2. Проверить RPC соединение
```bash
curl -X POST http://127.0.0.1:18083/json_rpc \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": "0",
    "method": "get_balance",
    "params": {"account_index": 0}
  }'
```

### 3. Мониторинг логов
```bash
# Логи приложения
sudo journalctl -u xmr-paywall -f

# Логи Tor
sudo journalctl -u tor -f

# Логи Monero RPC
sudo tail -f /var/log/monero-wallet-rpc.log
```

---

## 🛡️ Безопасность и рекомендации

### Обязательные меры безопасности:

1. **Firewall настройки**
```bash
# Разрешить только локальные подключения к RPC
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp  # SSH только если нужен
sudo ufw enable
```

2. **Резервное копирование**
```bash
# КРИТИЧНО: Регулярно делайте бэкап seed phrase и кошелька!
mkdir -p ~/backups
cp -r ~/.monero-wallet ~/backups/wallet-backup-$(date +%Y%m%d)
```

3. **Обновления**
```bash
# Регулярно обновляйте систему
sudo dnf update && sudo dnf upgrade -y
```

4. **Мониторинг файла платежей**
```bash
# Регулярно проверяйте payments.json
cat /var/www/xmr/payments.json | jq
```

### Рекомендации:

- ✅ Используйте VPS провайдера, принимающего криптовалюту
- ✅ Никогда не храните seed phrase на сервере
- ✅ Используйте отдельный email для контактов (ProtonMail)
- ✅ Регулярно выводите средства с платежного кошелька
- ✅ Мониторьте логи на подозрительную активность
- ⛔ НЕ публикуйте .env файл
- ⛔ НЕ используйте weak пароли для кошелька
- ⛔ НЕ запускайте на том же сервере другие публичные сервисы

---

## 🐛 Возможные проблемы и решения

### Проблема: "XMR_RPC_URL not set"
**Решение**: Проверьте что в `.env` установлен `XMR_RPC_URL=http://127.0.0.1:18083/json_rpc`

### Проблема: RPC не отвечает
**Решение**:
```bash
sudo systemctl status monero-wallet-rpc
sudo journalctl -u monero-wallet-rpc -n 50
```

### Проблема: Платежи не подтверждаются
**Решение**:
1. Проверьте синхронизацию blockchain
2. Убедитесь что `XMR_CONFIRMATIONS=2` (можно уменьшить до 1 для теста)
3. Проверьте что сумма платежа совпадает с `XMR_PRICE`

### Проблема: Onion сайт недоступен
**Решение**:
```bash
sudo systemctl restart tor
sudo cat /var/lib/tor/web/hostname
curl http://127.0.0.1:8080  # Проверить локально
```

---

## 📊 Структура проекта

```
xmr/
├── server.js              # Основной HTTP сервер
├── auth.js                # Контроль доступа
├── xmr-monitor.js         # Мониторинг Monero платежей
├── .env                   # Конфигурация (НЕ коммитить!)
├── package.json           # Зависимости Node.js
├── payments.json          # База данных платежей (генерируется автоматически)
└── public/
    ├── main.css          # Стили
    └── downloads/        # Файлы для скачивания (GPG ключ, гайды)
```

---

## 📝 Дополнительные ресурсы

- [Monero Documentation](https://www.getmonero.org/resources/developer-guides/)
- [Tor Project Documentation](https://community.torproject.org/onion-services/)
- [Monero RPC Documentation](https://www.getmonero.org/resources/developer-guides/wallet-rpc.html)

---

## 🤝 Поддержка

Для вопросов и поддержки используйте email из конфигурации с GPG шифрованием.

**Помните: анонимность = безопасность!** 🔒

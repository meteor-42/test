# 🚀 Руководство по развертыванию на CentOS

## 📋 Подготовка

### Требования
- CentOS 8+ / Rocky Linux 8+ / RHEL 8+
- Root или sudo доступ
- Минимум 2GB RAM
- 20GB свободного места

## ⚡ Быстрая установка (рекомендуется)

```bash
# 1. Клонировать репозиторий
git clone https://github.com/meteor-42/xmr.git
cd xmr

# 2. Запустить скрипт автоматической установки
sudo bash install-centos.sh

# 3. Настроить Monero кошелек (см. раздел ниже)

# 4. Отредактировать .env файл
nano .env

# 5. Перезапустить сервис
sudo systemctl restart xmr-paywall
```

**Готово!** Сервер запущен и доступен через Tor.

---

## 📖 Ручная установка (детально)

### Шаг 1: Установка зависимостей

```bash
# Обновить систему
sudo dnf update -y

# Установить Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# Установить Tor
sudo dnf install -y epel-release
sudo dnf install -y tor

# Установить инструменты
sudo dnf install -y wget tar bzip2 curl jq git
```

### Шаг 2: Установка Monero Wallet RPC

```bash
# Скачать Monero
cd /tmp
wget https://downloads.getmonero.org/cli/linux64 -O monero.tar.bz2

# Распаковать
tar -xjf monero.tar.bz2

# Установить
sudo cp monero-*/monero-wallet-rpc /usr/local/bin/
sudo cp monero-*/monero-wallet-cli /usr/local/bin/
sudo chmod +x /usr/local/bin/monero-wallet-*

# Проверить
monero-wallet-rpc --version
```

### Шаг 3: Создание Monero кошелька

```bash
# Создать директорию
mkdir -p ~/.monero-wallet

# Создать кошелек
monero-wallet-cli --generate-new-wallet ~/.monero-wallet/payment-wallet

# Следуйте инструкциям:
# 1. Введите пароль
# 2. Выберите язык
# 3. СОХРАНИТЕ seed phrase (25 слов)!!!

# Получить адрес
monero-wallet-cli --wallet-file ~/.monero-wallet/payment-wallet
# В консоли: address
# Сохраните адрес!
```

### Шаг 4: Настройка Monero Wallet RPC Service

```bash
# Создать systemd сервис
sudo nano /etc/systemd/system/monero-wallet-rpc.service
```

Вставьте (замените YOUR_USERNAME и YOUR_PASSWORD):

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

Запустите:

```bash
sudo systemctl daemon-reload
sudo systemctl enable monero-wallet-rpc
sudo systemctl start monero-wallet-rpc
sudo systemctl status monero-wallet-rpc
```

### Шаг 5: Настройка Tor Hidden Service

```bash
# Редактировать torrc
sudo nano /etc/tor/torrc
```

Добавьте в конец:

```
# XMR Paywall Hidden Service
HiddenServiceDir /var/lib/tor/web/
HiddenServicePort 80 127.0.0.1:8080
```

Запустите:

```bash
# Создать директорию
sudo mkdir -p /var/lib/tor/web/
sudo chown -R toranon:toranon /var/lib/tor/web/ || sudo chown -R tor:tor /var/lib/tor/web/
sudo chmod 700 /var/lib/tor/web/

# Запустить Tor
sudo systemctl enable tor
sudo systemctl restart tor

# Получить onion адрес
sleep 5
sudo cat /var/lib/tor/web/hostname
```

Сохраните полученный .onion адрес!

### Шаг 6: Установка приложения

```bash
# Клонировать репозиторий
cd /var/www
sudo git clone https://github.com/meteor-42/xmr.git
cd xmr

# Установить зависимости
npm install

# Настроить .env
nano .env
```

Обновите в .env:

```env
ONION_ADDRESS=ваш-адрес.onion  # Из предыдущего шага
XMR_ADDRESS=ваш-monero-адрес   # Из Шага 3
XMR_PRICE=0.1                  # Цена доступа в XMR
CONTACT_EMAIL=ваш@email.com    # Ваш email
GPG_FINGERPRINT=ваш-fingerprint
```

### Шаг 7: Создание systemd сервиса для приложения

```bash
sudo nano /etc/systemd/system/xmr-paywall.service
```

Вставьте (замените YOUR_USERNAME):

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

Запустите:

```bash
sudo systemctl daemon-reload
sudo systemctl enable xmr-paywall
sudo systemctl start xmr-paywall
sudo systemctl status xmr-paywall
```

---

## 🔐 Безопасность

### Firewall

```bash
# Убедиться что внешние порты закрыты
sudo firewall-cmd --permanent --remove-port=8080/tcp || true
sudo firewall-cmd --permanent --remove-port=18083/tcp || true
sudo firewall-cmd --reload
```

### Права доступа

```bash
cd /var/www/xmr
chmod 600 .env
chmod 600 payments.json
```

### SELinux (если включен)

```bash
sudo semanage port -a -t http_port_t -p tcp 8080
sudo setsebool -P httpd_can_network_connect 1
```

Подробнее см. **CENTOS_SECURITY.md**

---

## ✅ Проверка работоспособности

### Проверить сервисы

```bash
# Все сервисы
sudo systemctl status tor
sudo systemctl status monero-wallet-rpc
sudo systemctl status xmr-paywall

# Логи
sudo journalctl -u xmr-paywall -f
```

### Проверить onion сайт

```bash
# Установить torsocks
sudo dnf install -y torsocks

# Проверить
torsocks curl http://ваш-адрес.onion
```

### Проверить RPC

```bash
curl -X POST http://127.0.0.1:18083/json_rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"0","method":"get_balance","params":{"account_index":0}}'
```

---

## 📊 Мониторинг

### Логи в реальном времени

```bash
# Приложение
sudo journalctl -u xmr-paywall -f

# Monero
sudo tail -f /var/log/monero-wallet-rpc.log

# Tor
sudo journalctl -u tor -f
```

### База платежей

```bash
# Все платежи
cd /var/www/xmr
cat payments.json | jq

# Только подтвержденные
cat payments.json | jq 'to_entries | map(select(.value.status == "confirmed"))'
```

---

## 🐛 Решение проблем

### RPC не отвечает

```bash
sudo systemctl status monero-wallet-rpc
sudo journalctl -u monero-wallet-rpc -n 50
sudo systemctl restart monero-wallet-rpc
```

### Onion недоступен

```bash
sudo systemctl status tor
sudo cat /var/lib/tor/web/hostname
sudo systemctl restart tor
```

### Платежи не подтверждаются

1. Проверьте синхронизацию blockchain
2. Убедитесь что сумма >= XMR_PRICE
3. Проверьте XMR_CONFIRMATIONS (можно уменьшить до 1 для теста)

### Приложение не запускается

```bash
# Логи
sudo journalctl -u xmr-paywall -n 100

# Проверка портов
sudo netstat -tulpn | grep 8080

# Права
ls -la /var/www/xmr/.env
```

---

## 📚 Дополнительно

- **README.md** - Общая информация
- **TOR_SETUP.md** - Полная инструкция по Tor
- **CMD.md** - Шпаргалка команд
- **CENTOS_SECURITY.md** - Руководство по безопасности

---

## 🎯 Следующие шаги

1. ✅ Регулярно обновляйте систему
2. ✅ Настройте автоматические бэкапы (см. CENTOS_SECURITY.md)
3. ✅ Мониторьте логи на подозрительную активность
4. ✅ Выводите средства с платежного кошелька регулярно
5. ✅ Храните seed phrase в безопасном месте (НЕ на сервере!)

**Stay anonymous. Stay secure.** 🔒

# 🔒 XMR Tor Paywall

Анонимный paywall сервис с оплатой через Monero для работы в сети Tor.

---

## 🚀 Быстрый старт

### Требования
- Linux сервер (CentOS/RHEL)
- Node.js 14+
- Tor
- Monero Wallet RPC

### Установка
```bash
# Клонировать репозиторий
git clone https://github.com/meteor-42/xmr.git
cd xmr

# Установить зависимости
npm install

# Настроить .env файл
nano .env

# Запустить
node server.js
```

---

## 📚 Документация

### 📖 [TOR_SETUP.md](TOR_SETUP.md) - Полная инструкция по запуску в Tor
Подробное руководство по настройке:
- Установка Tor и Hidden Service
- Настройка Monero Wallet RPC
- Конфигурация .env
- Создание systemd сервисов
- Безопасность и мониторинг
- Решение проблем

---

## ⚙️ Конфигурация .env

Ключевые параметры, которые **обязательно** нужно изменить:

```env
# Onion адрес вашего hidden service
ONION_ADDRESS=ваш-адрес.onion

# Monero адрес для приема платежей
XMR_ADDRESS=ваш-monero-адрес
XMR_ADDRESS=ваш-monero-адрес

# Цена доступа в XMR
XMR_PRICE=1
XMR_PRICE=1

# Контактные данные
CONTACT_EMAIL=ваш-email@proton.me
GPG_FINGERPRINT=ваш-gpg-fingerprint
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
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│   auth.js    │  │xmr-monitor.js│
│              │  │              │
│ Проверка     │  │ Мониторинг   │
│ токенов      │  │ платежей     │
└──────────────┘  └──────┬───────┘
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
- No-cache заголовки

### ⚠️ Рекомендуется добавить
- Rate limiting (см. CODE_IMPROVEMENTS.md)
- Input validation
- Логирование подозрительной активности
- Регулярное резервное копирование

---

## 📊 Как это работает

1. **Пользователь заходит на .onion сайт**
   - Видит paywall с уникальным ACCESS-кодом
   - Получает Monero subaddress для оплаты

2. **Отправляет платеж**
   - Переводит XMR на указанный адрес
   - Ждет подтверждения (обычно 1-2 минуты)

3. **Мониторинг платежа**
   - `xmr-monitor.js` каждые 15 секунд проверяет входящие транзакции
   - При достаточном количестве подтверждений генерирует access token

4. **Получение доступа**
   - Пользователь вводит свой ACCESS-код
   - Система проверяет статус платежа
   - При успехе выдает токен и редиректит на контент

5. **Доступ к контенту**
   - Токен автоматически добавляется ко всем ссылкам
   - Доступ активен 365 дней

---

## 🛠️ Разработка

### Структура проекта
```
xmr/
├── server.js              # Основной сервер
├── auth.js                # Контроль доступа
├── xmr-monitor.js         # Мониторинг Monero
├── .env                   # Конфигурация (НЕ коммитить!)
├── package.json           # Зависимости
├── payments.json          # База платежей (генерируется)
├── public/
│   ├── main.css          # Стили
│   └── downloads/        # Файлы для скачивания
├── TOR_SETUP.md          # Инструкция по Tor
├── CODE_IMPROVEMENTS.md   # Рекомендации по коду
└── README.md             # Этот файл
```

### Локальная разработка
```bash
# Запуск без Monero RPC (используется fallback адрес)
npm start

# Доступ по http://localhost:8080
```

### Тестирование платежей
Для тестирования создайте запись в `payments.json`:
```json
{
  "TEST123": {
    "memo": "TEST123",
    "subaddress": "тестовый-адрес",
    "subaddressIndex": 999,
    "status": "confirmed",
    "access_token": "test_token",
    "created_at": 1234567890,
    "confirmed_at": 1234567890
  }
}
```

Затем используйте `ACCESS-TEST123` для входа.

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

## 🔧 Возможные проблемы

| Проблема | Решение |
|----------|---------|
| RPC не отвечает | `sudo systemctl restart monero-wallet-rpc` |
| Onion недоступен | `sudo systemctl restart tor` |
| Платежи не подтверждаются | Проверить синхронизацию blockchain |
| Ошибки в логах | `sudo journalctl -u xmr-paywall -n 100` |

Подробнее см. **TOR_SETUP.md** раздел "Возможные проблемы"

---

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменений (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

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

---

## 📞 Контакты

Для вопросов используйте email из `.env` с GPG шифрованием.

**Stay anonymous. Stay secure.** 🔒

---

## 🔗 Полезные ссылки

- [Monero Official](https://www.getmonero.org/)
- [Tor Project](https://www.torproject.org/)
- [Monero RPC Docs](https://www.getmonero.org/resources/developer-guides/wallet-rpc.html)
- [Tor Hidden Services Guide](https://community.torproject.org/onion-services/)

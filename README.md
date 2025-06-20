# crb_inventory

Проект учета компьютерной техники в ЦРБ с операционными система Windows и Astra Linux 1.7

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/KnifeP0int/crb_inventory.git/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/KnifeP0int/crb_inventory.git/actions/workflows/main.yml/badge.svg)](https://github.com/KnifeP0int/crb_inventory.git/actions)

## ✨ Особенности

- **Функция 1**: Сервер NodeJS + база данных на MySQL.
- **Функция 2**: PowerShell скрипт для Winodws.
- **Функция 3**: Bash скрипт для Astra Linux 1.7.

![Пример Web части](images/screen1.jpg)

## 🚀 Установка
Клиент (PowerShell/Bash)

Запустите скрипт вручную или через Планировщик задач (Windows) / Cron (Linux).

Предваритальено поменять ip на ip сервера
Для Windows:
powershell
.\collect_pc_windows.ps1

Если Windows 11 то выполнить сперва
Set-ExecutionPolicy unrestricted
Выбираем А 
Потом Запустить Однажды R
Set-ExecutionPolicy restricted


Для Linux:
sudo apt-get update
sudo apt-get install -y jq curl
sudo chmod +x collect_pc_data.sh
sudo sh ./collect_pc_data.sh

Сервер

Установите Node.js + MySQL.

Добавить пользователю все привелегии в MySQL
GRANT ALL PRIVILEGES ON * . * TO 'user'@'localhost';

Так же изменить пользователя и пароль с ip к MySQL серверу в файле 

В Файле .env заменить на свои ip и имя и пароль от базы данных

DB_HOST=localhost
DB_USER=prog
DB_PASSWORD='V32321111Vv'



Запустите сервер:

bash
node server.js

Проити по ссылке   http://localhost:3000/admin 
Л:admin
П:pass123

### 🧑‍💻 Разработка
Как внести свой вклад в проект?

Форкните репозиторий.
Создайте клон (git clone https://github.com/KnifeP0int/crb_inventory.git)

Создайте ветку (git checkout -b feature/AmazingFeature).

Сделайте коммит (git commit -m 'Add some AmazingFeature').

Запушьте ветку (git push origin feature/AmazingFeature).



#### 📜 Лицензия
Этот проект распространяется под лицензией MIT. Подробнее см. в файле LICENSE.
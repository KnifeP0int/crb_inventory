#!/bin/bash

# 1. Сбор данных о системе
PC_NAME=$(hostname)
CPU_INFO=$(lscpu | awk -F':' '/Имя модели/ {print $2}' | xargs)
CPU_CORES=$(nproc)
RAM_GB=$(free -g | awk '/Mem:/ {print $2}')
OS_INFO=$(cat /etc/os-release | awk -F'=' '/PRETTY_NAME/ {print $2}' | tr -d '"')

# Функция для определения типа диска (HDD/SSD)
get_disk_type() {
    local disk=$1
    local rot
    
    # Проверяем параметр вращения (1 - HDD, 0 - SSD)
    rot=$(cat /sys/block/$disk/queue/rotational 2>/dev/null)
    
    case $rot in
        1) echo "HDD" ;;
        0) echo "SSD" ;;
        *) echo "UNKNOWN" ;;
    esac
}

# Получаем информацию о дисках
DISKS=$(lsblk -d -o NAME,MODEL,SIZE,SERIAL --json | jq -c '.blockdevices[] | 
    {name: .name, model: .model, size: .size, serial: .serial, type: "'$(get_disk_type '\(.name)')'"}')

NETWORK=$(ip -j address show | jq -c '.[] | select(.addr_info) | {ifname: .ifname, mac: .address, ip: .addr_info[] | select(.family == "inet").local}')

# 2. Формирование JSON-данных
JSON_DATA=$(jq -n \
  --arg pcName "$PC_NAME" \
  --arg cpu "$CPU_INFO ($CPU_CORES cores)" \
  --arg ram "$RAM_GB GB" \
  --arg os "$OS_INFO" \
  --argjson disks "$(echo "$DISKS" | jq -s '.')" \
  --argjson network "$(echo "$NETWORK" | jq -s '.')" \
  --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  '{
    pcName: $pcName,
    cpu: $cpu,
    ram: $ram,
    os: $os,
    disks: $disks,
    network: $network,
    timestamp: $timestamp
  }')

# 3. Отправка на сервер (HTTP POST)
API_URL="http://192.168.0.120:3000/api/pc-data"
curl -X POST \
  -H "Content-Type: application/json" \
  -d "$JSON_DATA" \
  "$API_URL" || echo "Ошибка при отправке данных"
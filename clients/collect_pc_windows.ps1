# 1. Сбор данных о системе
$pcName = $env:COMPUTERNAME
$cpu = Get-WmiObject Win32_Processor | Select-Object -Property Name, NumberOfCores
$ram = [math]::Round((Get-WmiObject Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 2)
$os = (Get-WmiObject Win32_OperatingSystem).Caption

# Функция для получения информации о дисках
function Get-DiskInfo {
    try {
        $disks = Get-PhysicalDisk -ErrorAction Stop | ForEach-Object {
            $diskInfo = @{
                Model = $_.FriendlyName
                Size = [math]::Round($_.Size / 1GB, 2).ToString() + " GB"
                Serial = $_.SerialNumber
                Type = switch ($_.MediaType) {
                    'HDD' { 'HDD' }
                    'SSD' { 'SSD' }
                    'NVMe' { 'NVMe SSD' }
                    default { 
                        if ($_.FriendlyName -match 'NVMe') { 'NVMe SSD' }
                        elseif ($_.FriendlyName -match 'SSD') { 'SSD' }
                        else { 'HDD' }
                    }
                }
                Health = $_.HealthStatus.ToString()
            }
            
            try {
                $disk = Get-Disk -Number $_.DeviceNumber -ErrorAction Stop
                $diskInfo['PartitionStyle'] = $disk.PartitionStyle
                $diskInfo['BusType'] = $disk.BusType.ToString()
            } catch {
                $diskInfo['PartitionStyle'] = "Unknown"
                $diskInfo['BusType'] = "Unknown"
            }
            
            [PSCustomObject]$diskInfo
        }
        return $disks
    }
    catch {
        return $null
    }
}

# Получаем информацию о дисках
$disks = Get-DiskInfo

# Если Get-PhysicalDisk не сработал, используем резервный метод
if (-not $disks) {
    $disks = Get-WmiObject Win32_DiskDrive | Select-Object Model, Size, SerialNumber | ForEach-Object {
        [PSCustomObject]@{
            Model = $_.Model
            Size = [math]::Round($_.Size / 1GB, 2).ToString() + " GB"
            Serial = $_.SerialNumber
            Type = if ($_.Model -match 'SSD|Solid State') { 'SSD' } 
                   elseif ($_.Model -match 'NVMe') { 'NVMe SSD' }
                   else { 'HDD' }
            Health = "Unknown"
        }
    }
}

# Сетевые адаптеры - улучшенный метод
function Get-NetworkInfo {
    $adapters = @()
    
    # Метод 1: Через Get-NetAdapter (более надежный)
    if (Get-Command Get-NetAdapter -ErrorAction SilentlyContinue) {
        $adapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object {
            $ipAddress = (Get-NetIPAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress
            [PSCustomObject]@{
                IP = if ($ipAddress) { $ipAddress } else { "N/A" }
                MAC = $_.MacAddress
                Description = $_.InterfaceDescription
            }
        }
    }
    
    # Метод 2: Через WMI (если первый не сработал)
    if ($adapters.Count -eq 0) {
        $adapters = Get-WmiObject Win32_NetworkAdapterConfiguration | 
                    Where-Object { $_.IPEnabled -eq $true } | 
                    ForEach-Object {
                        $ip = ($_.IPAddress | Where-Object { $_ -notmatch ':' -and $_ -ne $null } | Select-Object -First 1)
                        [PSCustomObject]@{
                            IP = if ($ip) { $ip } else { "N/A" }
                            MAC = $_.MACAddress
                            Description = $_.Description
                        }
                    }
    }
    
    return $adapters
}

$network = Get-NetworkInfo

# 2. Формирование JSON-данных
$pcData = @{
    pcName = $pcName
    cpu = $cpu.Name + " (" + $cpu.NumberOfCores + " cores)"
    ram = "$ram GB"
    os = $os
    disks = @($disks | ForEach-Object {  # Явное создание массива с @()
        @{
            model = $_.Model
            size = $_.Size
            serial = $_.Serial
            type = $_.Type
            health = $_.Health
        }
    })
    network = @($network | ForEach-Object {  # Явное создание массива с @()
        @{
            ip = $_.IP
            mac = $_.MAC
            description = $_.Description
        }
    })
    timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
} | ConvertTo-Json -Depth 5

# 3. Отправка на сервер
$apiUrl = "http://192.168.0.120:3000/api/pc-data"
try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Body $pcData -ContentType "application/json"
 
}
catch {
   
    $pcData | Out-File "$env:TEMP\pc_info_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
}
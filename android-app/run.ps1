<#
.SYNOPSIS
  Build, install and launch Rimba Tycoon 3D app on Android device.
  Versi: v1.0.4 | Update terakhir: Sabtu, 25/07/2026 01:10 WIB
  Disalin & disesuaikan dari DASHBOARD-TANGKAPAN-NGENGAT/android-app/run.ps1.
  v1.0.1 (kecil): kalau APK debug sudah ada & belum ada source yang berubah (dicek dari
    tanggal-modifikasi file), tawarkan install langsung tanpa build ulang.
  v1.0.2 (kecil): fix "device 'a' not found" - waktu cuma 1 HP nyambung, pipeline PowerShell
    ngeratain hasil jadi teks tunggal, [0] ambil huruf pertama bukan elemen array. Fix: bungkus
    hasil pipeline pakai @() biar selalu array.
  v1.0.3 (kecil): fix "failed to stat ...: No such file or directory" pas install APK lama -
    path project ada spasi ("GAME TEBANG POHON 3D"), Start-Process -ArgumentList (array) gak
    nge-quote otomatis, path kepotong di spasi terakhir. Fix: bungkus path APK pakai tanda kutip.
  v1.0.4 (kecil): fix "adb.exe: unknown command (2)._adb-tls-connect._tcp" - device ID hasil
    Wireless Debugging (mDNS) kadang mengandung SPASI (mis. "adb-XXXX (2)._adb-tls-connect._tcp"
    kalau ada duplikat nama di jaringan). Bug sama persis kayak v1.0.3 tapi buat device ID,
    bukan path: Start-Process -ArgumentList gak nge-quote otomatis, device ID kepotong di spasi
    jadi 2 argumen terpisah -> adb salah baca argumen berikutnya sebagai command. Fix: bungkus
    device ID pakai tanda kutip juga, sama kayak path APK.
.DESCRIPTION
  Script ini akan:
  1. Mengecek IP WiFi PC/laptop dan mencari IP HP di jaringan yang sama (port 5555)
  2. Jika tidak ada -DeviceId, auto-scan network untuk menemukan HP
  3. Cek apakah APK debug lama masih up-to-date -> tawarkan install langsung
  4. Kalau tidak, konfirmasi tiap langkah lalu build, install, dan jalankan aplikasi di HP
.PARAMETER DeviceId
  IP:Port HP (contoh: 192.168.1.7:5555). Jika kosong, script akan auto-scan.
.PARAMETER PackageName
  Package name aplikasi (default: com.rimba.tycoon)
.PARAMETER Gradle
  Path ke gradlew.bat
.EXAMPLE
  .\run.ps1                           # Auto-scan & install
  .\run.ps1 -DeviceId 192.168.1.7:5555  # Manual IP
#>

param(
    [string]$DeviceId = "",
    [string]$PackageName = "com.rimba.tycoon", # Sesuaikan dengan applicationId project ini

    [string]$Gradle = ".\\gradlew.bat"
)

# ============================================================
# FUNGSI: Mendapatkan IP WiFi lokal PC
# ============================================================
function Get-LocalWiFiIP {
    try {
        $wifi = Get-NetAdapter | Where-Object { $_.Status -eq "Up" -and $_.Name -like "*Wi-Fi*" -or $_.Name -like "*Wireless*" -or $_.Name -like "*WLAN*" }
        if (-not $wifi) {
            $wifi = Get-NetAdapter | Where-Object { $_.Status -eq "Up" }
        }
        if ($wifi) {
            $ip = Get-NetIPAddress -InterfaceIndex $wifi[0].ifIndex -AddressFamily IPv4 | Select-Object -First 1
            if ($ip) { return $ip.IPAddress }
        }
    } catch {
        $ipconfig = ipconfig | Select-String "IPv4" | Select-String "192\.168" | Select-Object -First 1
        if ($ipconfig) {
            return ($ipconfig -split ":")[1].Trim()
        }
    }
    return $null
}

# ============================================================
# FUNGSI: Cek apakah port 5555 terbuka di IP tertentu
# ============================================================
function Test-Port5555 {
    param([string]$IpAddress)
    try {
        $socket = New-Object System.Net.Sockets.TcpClient
        $asyncResult = $socket.BeginConnect($IpAddress, 5555, $null, $null)
        $wait = $asyncResult.AsyncWaitHandle.WaitOne(300, $false)
        if ($wait -and $socket.Connected) {
            $socket.EndConnect($asyncResult)
            $socket.Close()
            return $true
        }
        $socket.Close()
    } catch {}
    return $false
}

# ============================================================
# FUNGSI: Scan jaringan lokal dengan ARP + port scan cepat
# ============================================================
function Find-AndroidDevicesOnNetwork {
    param([string]$Subnet)

    Write-Host ""
    Write-Host ("Memindai jaringan " + $Subnet + ".0/24 untuk perangkat Android...") -ForegroundColor Cyan
    Write-Host "   (Menggunakan ARP cache untuk deteksi cepat)" -ForegroundColor Yellow
    Write-Host ""

    # Metode 1: Ambil daftar IP dari ARP cache (instan)
    Write-Host "   Membaca ARP cache..." -ForegroundColor Cyan
    $arpOutput = arp -a | Select-String "^\s+\d+\.\d+\.\d+\.\d+" | ForEach-Object {
        $line = $_ -split '\s+'
        if ($line[1] -match "^\d+\.\d+\.\d+\.\d+$" -and $line[1] -ne "224.0.0.0" -and $line[1] -ne "239.255.255.250") {
            $line[1]
        }
    } | Where-Object { $_ -match "^$Subnet\." } | Select-Object -Unique

    if ($arpOutput.Count -gt 0) {
        Write-Host ("   Ditemukan " + $arpOutput.Count + " perangkat di ARP cache. Memeriksa port ADB (5555)...") -ForegroundColor Green
    } else {
        Write-Host "   Tidak ada perangkat di ARP cache. Mencoba scan subnet..." -ForegroundColor Yellow

        # Metode 2: Scan ping cepat (paralel via jobs)
        $pingTasks = @()
        for ($i = 1; $i -le 254; $i++) {
            $ip = $Subnet + '.' + $i
            $pingTasks += (Start-Job -ScriptBlock {
                param($ip)
                $ping = Test-Connection -ComputerName $ip -Count 1 -Quiet -ErrorAction SilentlyContinue
                if ($ping) { return $ip }
                return $null
            } -ArgumentList $ip)
        }

        Write-Host "   Menunggu hasil ping (254 host)..." -ForegroundColor Yellow
        $pingResults = $pingTasks | Wait-Job -Timeout 30 | Receive-Job
        $pingTasks | Remove-Job

        $arpOutput = $pingResults | Where-Object { $_ -ne $null }
        if ($arpOutput.Count -gt 0) {
            Write-Host ("   Ditemukan " + $arpOutput.Count + " perangkat aktif. Memeriksa port ADB (5555)...") -ForegroundColor Green
        } else {
            Write-Host "   Tidak ada perangkat aktif ditemukan." -ForegroundColor Yellow
            return @()
        }
    }

    # Cek port 5555 di setiap IP (synchronous, lebih cepat untuk jumlah sedikit)
    $foundIPs = @()
    foreach ($ip in $arpOutput) {
        Write-Host ("   Cek " + $ip + ":5555...") -ForegroundColor Gray -NoNewline
        if (Test-Port5555 -IpAddress $ip) {
            Write-Host " [TERBUKA]" -ForegroundColor Green
            $foundIPs += $ip
        } else {
            Write-Host " [TERTUTUP]" -ForegroundColor DarkGray
        }
    }

    if ($foundIPs.Count -gt 0) {
        Write-Host ""
        Write-Host "   Menemukan perangkat Android dengan ADB aktif:" -ForegroundColor Green
        foreach ($ip in $foundIPs) {
            Write-Host ("       -> " + $ip + ":5555") -ForegroundColor Green
        }
    } else {
        Write-Host ""
        Write-Host "   Tidak menemukan perangkat dengan port ADB (5555) terbuka." -ForegroundColor Yellow
        Write-Host "   Pastikan Wireless Debugging sudah diaktifkan di HP:" -ForegroundColor Yellow
        Write-Host "   Setelan > Opsi Pengembang > Wireless Debugging > Aktifkan" -ForegroundColor Yellow
    }

    return $foundIPs
}

# ============================================================
# FUNGSI: Konfirmasi dari user
# ============================================================
function Confirm-Step {
    param([string]$Message, [string]$Action = "Lanjutkan")

    Write-Host ""
    Write-Host "==================== KONFIRMASI ====================" -ForegroundColor Magenta
    Write-Host "  $Message" -ForegroundColor White
    Write-Host "  Tekan ENTER untuk $Action" -ForegroundColor Cyan
    Write-Host "  Ketik 'b' atau 'BATAL' lalu ENTER untuk membatalkan" -ForegroundColor Red
    Write-Host "====================================================" -ForegroundColor Magenta
    Write-Host ""

    $input = Read-Host ">> "
    if ($input -eq "b" -or $input -eq "B" -or $input -eq "BATAL" -or $input -eq "batal") {
        Write-Host ""
        Write-Host "DIBATALKAN oleh pengguna." -ForegroundColor Red
        exit 0
    }
}

# ============================================================
# FUNGSI: Hubungkan ke device via ADB
# ============================================================
function Connect-Device {
    param([string]$TargetDeviceId)

    Write-Host ""
    Write-Host ('Menghubungkan ke perangkat: ' + $TargetDeviceId + ' ...') -ForegroundColor Cyan
    $result = & adb connect $TargetDeviceId 2>&1
    Write-Host "   $result" -ForegroundColor Gray
    Start-Sleep -Seconds 2

    $devices = & adb devices
    if ($devices -match "$TargetDeviceId\s+device") {
        Write-Host ('   Berhasil terhubung ke ' + $TargetDeviceId) -ForegroundColor Green
        return $true
    } else {
        Write-Host ('   Gagal terhubung ke ' + $TargetDeviceId) -ForegroundColor Red
        return $false
    }
}

# ============================================================
# FUNGSI: Konfirmasi dan hapus build folder
# ============================================================
function Clear-BuildFolder {
    $appBuild = (Get-Location).Path + "\app\build"

    if (Test-Path $appBuild) {
        Confirm-Step -Message "Hapus folder build lama untuk mencegah file terkunci?" -Action "HAPUS"
        Write-Host ('Menghapus ' + $appBuild + ' ...') -ForegroundColor Cyan
        try {
            Remove-Item -LiteralPath $appBuild -Recurse -Force -ErrorAction Stop
            Write-Host "   Folder build berhasil dihapus." -ForegroundColor Green
        } catch {
            Write-Host ('   Gagal menghapus folder build: ' + $_.Exception.Message) -ForegroundColor Yellow
            Write-Host "   Coba tutup Android Studio / file explorer, lalu ulangi." -ForegroundColor Yellow
        }
    } else {
        Write-Host "   Folder build tidak ditemukan (bersih)." -ForegroundColor Gray
    }
}

# ============================================================
# FUNGSI: Hentikan Gradle daemon
# ============================================================
function Stop-GradleDaemon {
    Write-Host ""
    Write-Host "Menghentikan Gradle daemon..." -ForegroundColor Cyan
    try {
        & $Gradle --stop 2>&1 | Out-Null
        Write-Host "   Gradle daemon dihentikan." -ForegroundColor Green
    } catch {
        Write-Host ('   Gagal menghentikan Gradle daemon: ' + $_.Exception.Message) -ForegroundColor Yellow
    }
}

# ============================================================
# FUNGSI: Uninstall aplikasi lama
# ============================================================
function Uninstall-OldApp {
    param([string]$TargetDeviceId)

    Write-Host ""
    Write-Host "Menghapus versi aplikasi lama di HP..." -ForegroundColor Cyan
    Write-Host ('   Package: ' + $PackageName) -ForegroundColor Gray

    Confirm-Step -Message "Hapus aplikasi lama dari HP?" -Action "UNINSTALL"

    if ([string]::IsNullOrWhiteSpace($TargetDeviceId)) {
        & adb uninstall "$PackageName" 2>&1 | Out-Null
        & adb uninstall "$PackageName.debug" 2>&1 | Out-Null
    } else {
        & adb -s $TargetDeviceId uninstall "$PackageName" 2>&1 | Out-Null
        & adb -s $TargetDeviceId uninstall "$PackageName.debug" 2>&1 | Out-Null
    }
    Write-Host "   Selesai." -ForegroundColor Green
}

# ============================================================
# FUNGSI: Jalankan Gradle install
# ============================================================
function Invoke-GradleInstall {
    Write-Host ""
    Write-Host "Membangun (build) dan menginstall aplikasi..." -ForegroundColor Cyan
    Write-Host '   Perintah: gradlew.bat :app:installDebug --no-daemon' -ForegroundColor Gray

    Confirm-Step -Message "Proses build & install akan memakan waktu beberapa menit." -Action 'BUILD and INSTALL'

    Write-Host "Sedang membangun aplikasi. Harap tunggu..." -ForegroundColor Yellow
    Write-Host ""

    $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c gradlew.bat :app:installDebug --no-daemon" -Wait -PassThru -NoNewWindow
    return $process.ExitCode
}

# ============================================================
# FUNGSI: Cek apakah APK debug yang ada masih lebih baru dari source
# ============================================================
function Test-ApkUpToDate {
    param([string]$ApkPath)

    if (-not (Test-Path $ApkPath)) { return $false }
    $apkTime = (Get-Item $ApkPath).LastWriteTime

    $srcTimes = @()
    if (Test-Path "app\src") {
        $srcTimes += Get-ChildItem "app\src" -Recurse -File | Select-Object -ExpandProperty LastWriteTime
    }
    foreach ($f in @("app\build.gradle.kts", "build.gradle.kts", "settings.gradle.kts")) {
        if (Test-Path $f) { $srcTimes += (Get-Item $f).LastWriteTime }
    }

    if ($srcTimes.Count -eq 0) { return $true }
    $newestSrc = ($srcTimes | Measure-Object -Maximum).Maximum
    return $apkTime -gt $newestSrc
}

# ============================================================
# FUNGSI: Buka aplikasi di HP
# ============================================================
function Start-AppOnDevice {
    param([string]$TargetDeviceId)

    $Activity = "$PackageName/com.rimba.tycoon.MainActivity" # applicationId + MainActivity project ini
    Write-Host ""
    Write-Host "Membuka aplikasi di HP..." -ForegroundColor Cyan

    try {
        if ([string]::IsNullOrWhiteSpace($TargetDeviceId)) {
            Start-Process -FilePath "adb" -ArgumentList "shell", "am", "start", "-n", $Activity -WindowStyle Hidden
        } else {
            Start-Process -FilePath "adb" -ArgumentList "-s", "`"$TargetDeviceId`"", "shell", "am", "start", "-n", $Activity -WindowStyle Hidden
        }
        Write-Host "   Aplikasi terbuka di HP!" -ForegroundColor Green
        1..3 | ForEach-Object { [System.Console]::Beep(1000, 250); Start-Sleep -Milliseconds 120 }
    } catch {
        Write-Host ('   Gagal membuka aplikasi otomatis: ' + $_.Exception.Message) -ForegroundColor Yellow
    }
}

# ============================================================
# MAIN SCRIPT
# ============================================================

Clear-Host
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "      RIMBA TYCOON 3D INSTALLER" -ForegroundColor Cyan
Write-Host "  Build & Install Aplikasi ke HP Android" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# LANGKAH 1: DETEKSI IP WIFI PC
# ============================================================
Write-Host "==================== LANGKAH 1: DETEKSI JARINGAN ====================" -ForegroundColor Magenta

$localIP = Get-LocalWiFiIP
if ($localIP) {
    Write-Host ('   IP WiFi PC/Laptop: ' + $localIP) -ForegroundColor Green
    $subnetParts = $localIP -split "\."
    $subnet = $subnetParts[0] + '.' + $subnetParts[1] + '.' + $subnetParts[2]
    Write-Host ('   Subnet jaringan: ' + $subnet + '.0/24') -ForegroundColor Gray
} else {
    Write-Host "   Tidak dapat mendeteksi IP WiFi." -ForegroundColor Yellow
    Write-Host "   Pastikan PC/Laptop terhubung ke WiFi." -ForegroundColor Yellow
}

# ============================================================
# LANGKAH 2: DAPATKAN DEVICE ID
# ============================================================
Write-Host ""
Write-Host "==================== LANGKAH 2: DETEKSI PERANGKAT ANDROID ====================" -ForegroundColor Magenta

$finalDeviceId = $DeviceId

# Cek dulu apakah sudah ada device terhubung via ADB (USB atau sebelumnya)
Write-Host "   Memeriksa perangkat yang sudah terhubung via ADB..." -ForegroundColor Cyan
$existingDevices = & adb devices
$existingDeviceLines = @($existingDevices | Select-String "device$" | ForEach-Object { $_ -replace '\s+device', '' } | Where-Object { $_ -ne "List of devices attached" -and $_ -ne "" })
if ($existingDeviceLines.Count -gt 0) {
    Write-Host ("   Ditemukan perangkat yang sudah terhubung: " + ($existingDeviceLines -join ", ")) -ForegroundColor Green
    if ([string]::IsNullOrWhiteSpace($finalDeviceId)) {
        Write-Host "   Menggunakan perangkat yang sudah terhubung." -ForegroundColor Cyan
        if ($existingDeviceLines.Count -eq 1) {
            $finalDeviceId = $existingDeviceLines[0]
        } else {
            while ($true) {
                Write-Host "   Pilih perangkat:" -ForegroundColor Yellow
                for ($i = 0; $i -lt $existingDeviceLines.Count; $i++) {
                    Write-Host ('       [' + ($i+1) + '] ' + $existingDeviceLines[$i]) -ForegroundColor White
                }
                $Host.UI.RawUI.FlushInputBuffer()
                $selection = Read-Host ">> Pilih nomor (1-$($existingDeviceLines.Count))"
                $idx = ($selection -as [int]) - 1
                if ($idx -ge 0 -and $idx -lt $existingDeviceLines.Count) {
                    $finalDeviceId = $existingDeviceLines[$idx]
                    break
                }
                Write-Host "   Pilihan tidak valid, coba lagi." -ForegroundColor Yellow
            }
        }
    }
}

# Kalau belum ada device dan perlu scan
if ([string]::IsNullOrWhiteSpace($finalDeviceId) -and $localIP) {
    Write-Host "   Mode auto-scan (tidak ada -DeviceId, tidak ada device terhubung)." -ForegroundColor Cyan
    Write-Host "   PASTIKAN Wireless Debugging AKTIF di HP dan HP di jaringan SAMA." -ForegroundColor Yellow
    Write-Host "   Setelan > Opsi Pengembang > Wireless Debugging > AKTIFKAN" -ForegroundColor Yellow
    Write-Host "   (Pairing code hanya perlu sekali, selanjutnya langsung connect)" -ForegroundColor Yellow
    Write-Host ""

    Confirm-Step -Message "Mulai memindai jaringan untuk perangkat Android?" -Action "SCAN"

    $foundDevices = @(Find-AndroidDevicesOnNetwork -Subnet $subnet)

    if ($foundDevices.Count -eq 1) {
        $finalDeviceId = $foundDevices[0] + ':5555'
        Write-Host ""
        Write-Host ('   Perangkat terdeteksi: ' + $finalDeviceId) -ForegroundColor Green
    }
    elseif ($foundDevices.Count -gt 1) {
        Write-Host ""
        Write-Host "   Ditemukan beberapa perangkat. Pilih salah satu:" -ForegroundColor Yellow
        for ($i = 0; $i -lt $foundDevices.Count; $i++) {
            Write-Host ('       [' + ($i+1) + '] ' + $foundDevices[$i] + ':5555') -ForegroundColor White
        }
        Write-Host ""
        while ($true) {
            $Host.UI.RawUI.FlushInputBuffer()
            $selection = Read-Host ">> Pilih nomor (1-$($foundDevices.Count))"
            $idx = ($selection -as [int]) - 1
            if ($idx -ge 0 -and $idx -lt $foundDevices.Count) {
                $finalDeviceId = $foundDevices[$idx] + ':5555'
                break
            }
            Write-Host "   Pilihan tidak valid, coba lagi." -ForegroundColor Yellow
        }
    }
    else {
        Write-Host ""
        Write-Host "   Tidak dapat menemukan HP secara otomatis." -ForegroundColor Red
        Write-Host ""
        Write-Host "   Silahkan lakukan salah satu:" -ForegroundColor Yellow
        Write-Host "   1. Colok HP via USB (USB Debugging harus aktif)" -ForegroundColor White
        Write-Host "   2. Jalankan ulang dengan IP manual:" -ForegroundColor White
        Write-Host "      .\run.ps1 -DeviceId 192.168.x.x:5555" -ForegroundColor Cyan
        Write-Host "   3. Pastikan Wireless Debugging sudah AKTIF di HP" -ForegroundColor White
        Write-Host ""
        exit 1
    }
}

# Hubungkan ke device jika menggunakan WiFi
if (-not [string]::IsNullOrWhiteSpace($finalDeviceId) -and $finalDeviceId -match ":5555$") {
    $connected = Connect-Device -TargetDeviceId $finalDeviceId
    if (-not $connected) {
        Write-Host "Gagal terhubung ke perangkat. Periksa kembali." -ForegroundColor Red
        exit 1
    }
}

# Verifikasi ADB
Write-Host ""
Write-Host "Memeriksa koneksi ADB..." -ForegroundColor Cyan
$connectedDevices = & adb devices
if ($connectedDevices -match "\bdevice\b") {
    Write-Host "   Perangkat terdeteksi oleh ADB!" -ForegroundColor Green
} else {
    Write-Host "   GAGAL: Tidak ada perangkat Android yang terdeteksi!" -ForegroundColor Red
    Write-Host "   Pastikan:" -ForegroundColor Yellow
    Write-Host "   - USB Debugging atau Wireless Debugging AKTIF di HP" -ForegroundColor Yellow
    Write-Host "   - HP terhubung ke jaringan yang sama (jika WiFi)" -ForegroundColor Yellow
    Write-Host "   - Kabel USB berfungsi (jika pakai USB)" -ForegroundColor Yellow
    exit 1
}

# ============================================================
# LANGKAH 3: CEK APK LAMA (skip build kalau masih up-to-date)
# ============================================================
$apkPath = Join-Path (Get-Location).Path "app\build\outputs\apk\debug\app-debug.apk"
$useExistingApk = $false

if (Test-ApkUpToDate -ApkPath $apkPath) {
    Write-Host ""
    Write-Host "==================== LANGKAH 3: APK LAMA DITEMUKAN ====================" -ForegroundColor Magenta
    Write-Host ("   Sudah ada APK debug & belum ada source yang berubah:") -ForegroundColor Green
    Write-Host ("   " + $apkPath) -ForegroundColor Gray
    Write-Host ""
    Write-Host "   [1] Install APK ini langsung (cepat, tanpa build ulang)" -ForegroundColor White
    Write-Host "   [2] Build ulang dari source" -ForegroundColor White
    Write-Host "   [b] Batal" -ForegroundColor White
    $Host.UI.RawUI.FlushInputBuffer()
    $choice = Read-Host ">> Pilih (1/2/b)"
    if ($choice -eq "b" -or $choice -eq "B") {
        Write-Host ""
        Write-Host "DIBATALKAN oleh pengguna." -ForegroundColor Red
        exit 0
    }
    $useExistingApk = ($choice -eq "1")
}

if ($useExistingApk) {
    # ============================================================
    # INSTALL LANGSUNG (tanpa build)
    # ============================================================
    Write-Host ""
    Write-Host "==================== INSTALL APK LAMA ====================" -ForegroundColor Magenta
    Confirm-Step -Message "Install APK yang sudah ada ke HP?" -Action "INSTALL"

    $installArgs = @("install", "-r", "`"$apkPath`"")
    if (-not [string]::IsNullOrWhiteSpace($finalDeviceId)) { $installArgs = @("-s", "`"$finalDeviceId`"") + $installArgs }
    $proc = Start-Process -FilePath "adb" -ArgumentList $installArgs -Wait -PassThru -NoNewWindow

    if ($proc.ExitCode -eq 0) {
        Write-Host ""
        Write-Host "====================================================" -ForegroundColor Green
        Write-Host "   INSTALL BERHASIL!" -ForegroundColor Green
        Write-Host "====================================================" -ForegroundColor Green

        Start-AppOnDevice -TargetDeviceId $finalDeviceId

        Write-Host ""
        Write-Host "Selesai! Anda dapat menutup terminal ini." -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "====================================================" -ForegroundColor Red
        Write-Host "   INSTALL GAGAL!" -ForegroundColor Red
        Write-Host "====================================================" -ForegroundColor Red
        [System.Console]::Beep(300, 1500)
    }
} else {
    # ============================================================
    # LANGKAH 3b: PERSIAPAN BUILD
    # ============================================================
    Write-Host ""
    Write-Host "==================== LANGKAH 3: PERSIAPAN BUILD ====================" -ForegroundColor Magenta

    Stop-GradleDaemon
    Clear-BuildFolder
    Uninstall-OldApp -TargetDeviceId $finalDeviceId

    # ============================================================
    # LANGKAH 4: BUILD & INSTALL
    # ============================================================
    Write-Host ""
    Write-Host "==================== LANGKAH 4: BUILD and INSTALL ====================" -ForegroundColor Magenta

    $buildSuccess = Invoke-GradleInstall

    # ============================================================
    # LANGKAH 5: SELESAI
    # ============================================================
    if ($buildSuccess -eq 0) {
        Write-Host ""
        Write-Host "====================================================" -ForegroundColor Green
        Write-Host "   BUILD and INSTALL BERHASIL!" -ForegroundColor Green
        Write-Host "====================================================" -ForegroundColor Green

        Start-AppOnDevice -TargetDeviceId $finalDeviceId

        Write-Host ""
        Write-Host "Selesai! Anda dapat menutup terminal ini." -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "====================================================" -ForegroundColor Red
        Write-Host "   BUILD GAGAL!" -ForegroundColor Red
        Write-Host "====================================================" -ForegroundColor Red

        [System.Console]::Beep(300, 1500)
        Write-Host ""
        Write-Host "Periksa error di atas untuk mengetahui penyebab kegagalan." -ForegroundColor Yellow
        Write-Host "Beberapa penyebab umum:" -ForegroundColor Yellow
        Write-Host "  - Koneksi internet terputus (gagal download dependensi Gradle)" -ForegroundColor Yellow
        Write-Host "  - Ada error kode yang perlu diperbaiki" -ForegroundColor Yellow
    }
}

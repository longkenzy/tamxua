@echo off
title Tat Tam Xua Order System
echo ====================================================
echo  DANG DUNG HE THONG DAT MON TAM XUA ORDER
echo ====================================================
echo.

if exist "server.pid" (
    set /p PID=<server.pid
    echo [THONG BAO] Dang dung tien trinh Node.js voi PID %PID%...
    taskkill /f /pid %PID% >nul 2>&1
    del server.pid
)

:: Giai phong cong 3000 va dong System Tray dang chay ngam (neu co)
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'Name=\"powershell.exe\"' | Where-Object { $_.CommandLine -like '*tray.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }" >nul 2>&1

echo [THONG BAO] Da tat Server va don dep he thong thanh cong!

:end
echo.
echo Cua so nay se tu dong dong sau 3 giay...
ping 127.0.0.1 -n 4 >nul

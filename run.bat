@echo off
title Khoi dong Tam Xua Order System
echo ====================================================
echo  DANG KHOI DONG HE THONG DAT MON TAM XUA ORDER
echo ====================================================
echo.

:: Kiem tra Node.js da duoc cai dat chua
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js tren may tinh!
    echo Vui long tai va cai dat Node.js tai: https://nodejs.org/
    echo.
    pause
    exit /b
)

:: Tu dong cai dat cac thu vien neu chua co (trong truong hop khach hang giai nen file trang)
if not exist "node_modules" (
    echo [THONG BAO] Dang tu dong tai va cai dat cac thu vien node_modules...
    call npm install
)

echo [THONG BAO] Dang khoi dong Server va mo ung dung tren trinh duyet...
:: Cho 2 giay de Server khoi dong, sau do tu dong mo trang web dat mon
start /b cmd /c "ping 127.0.0.1 -n 3 >nul && start http://localhost:3000"

:: Khoi dong Server Node.js
node server.js

pause

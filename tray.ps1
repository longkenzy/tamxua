Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Lay thu muc chua script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrEmpty($scriptDir)) {
    $scriptDir = Get-Location
}

# Duong dan cac tep tin
$icoPath = Join-Path $scriptDir "public\images\logo.ico"
$serverScript = Join-Path $scriptDir "server.js"
$pidFile = Join-Path $scriptDir "server.pid"

# Kiem tra neu file icon khong ton tai
if (-not (Test-Path $icoPath)) {
    # Neu chua co logo.ico, tao tam bang cach copy tu logo.png neu script convert chua chay
    $icoPath = Join-Path $scriptDir "public\images\logo.ico"
}

# Khoi tao NotifyIcon trong o System Tray
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Icon = New-Object System.Drawing.Icon($icoPath)
$notifyIcon.Text = "Tam Xua Order - He Thong Dat Mon"
$notifyIcon.Visible = $true

# Khoi tao Context Menu (Menu chuot phai)
$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

$openBrowserItem = New-Object System.Windows.Forms.ToolStripMenuItem("Mo Trang Dat Mon (Browser)")
$restartItem = New-Object System.Windows.Forms.ToolStripMenuItem("Khoi Dong Lai (Restart Server)")
$stopItem = New-Object System.Windows.Forms.ToolStripMenuItem("Dung Hoat Dong (Stop / Exit)")

[void]$contextMenu.Items.Add($openBrowserItem)
[void]$contextMenu.Items.Add("-") # Separator
[void]$contextMenu.Items.Add($restartItem)
[void]$contextMenu.Items.Add($stopItem)

$notifyIcon.ContextMenuStrip = $contextMenu

# Bien toan cuc quan ly tien trinh Node.js
$global:nodeProcess = $null

function Start-Server {
    # Neu server dang chay roi thi khong chay them
    if ($global:nodeProcess -and -not $global:nodeProcess.HasExited) {
        return
    }
    
    $nodePath = "node"
    $resolvedPath = Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
    if ($resolvedPath) {
        $nodePath = $resolvedPath
    } elseif (Test-Path "C:\Program Files\nodejs\node.exe") {
        $nodePath = "C:\Program Files\nodejs\node.exe"
    }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $nodePath
    $psi.Arguments = "`"$serverScript`""
    $psi.WorkingDirectory = $scriptDir
    $psi.CreateNoWindow = $true       # An cua so đen CMD
    $psi.UseShellExecute = $false
    
    try {
        $global:nodeProcess = [System.Diagnostics.Process]::Start($psi)
    } catch {
        $_ | Out-File (Join-Path $scriptDir "server_launch_error.txt")
    }
    
    # Ghi PID ra file de dong bo voi cac file stop.bat khac neu can
    if ($global:nodeProcess) {
        $global:nodeProcess.Id | Out-File $pidFile -Force
    }
}

function Stop-Server {
    # 1. Dung qua tien trinh ghi nhan trong phien
    if ($global:nodeProcess -and -not $global:nodeProcess.HasExited) {
        try {
            $global:nodeProcess.Kill()
        } catch {}
    }
    
    # 2. Doc va dung qua file server.pid de phong truong hop mat phien
    if (Test-Path $pidFile) {
        try {
            $savedPid = Get-Content $pidFile -Raw
            if ($savedPid) {
                $savedPid = $savedPid.Trim()
                Stop-Process -Id ([int]$savedPid) -Force -ErrorAction SilentlyContinue
            }
        } catch {}
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
    
    # 3. Quet va giai phong bat ky tien trinh nao dang chiem giu cong 3000
    try {
        $conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
        if ($conn) {
            foreach ($c in $conn) {
                Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {}
}

# Su kien click menu
$openBrowserItem.Add_Click({
    Start-Process "http://localhost:3000"
})

$restartItem.Add_Click({
    $notifyIcon.ShowBalloonTip(2000, "Tam Xua Order", "Dang khoi dong lai may chu...", [System.Windows.Forms.ToolTipIcon]::Info)
    Stop-Server
    Start-Sleep -Milliseconds 800
    Start-Server
    $notifyIcon.ShowBalloonTip(2000, "Tam Xua Order", "May chu da duoc khoi dong lai thanh cong!", [System.Windows.Forms.ToolTipIcon]::Info)
})

$stopItem.Add_Click({
    Stop-Server
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
    [System.Windows.Forms.Application]::Exit()
    exit
})

# Click dup vao bieu tuong logo o System Tray de mo nhanh trang web
$notifyIcon.Add_DoubleClick({
    Start-Process "http://localhost:3000"
})

# Khoi chay server va mo trinh duyet ngay khi chay script
Start-Server
$notifyIcon.ShowBalloonTip(3000, "Tam Xua Order", "He thong dang khoi dong va chay ngam...", [System.Windows.Forms.ToolTipIcon]::Info)

Start-Sleep -Seconds 1
Start-Process "http://localhost:3000"

# Chay vong lap Windows Message Loop
[System.Windows.Forms.Application]::Run()

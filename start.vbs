Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
strPath = FSO.GetParentFolderName(WScript.ScriptFullName)
' Chay file tray.ps1 qua PowerShell o che do an hoan toan
cmd = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File " & Chr(34) & strPath & "\tray.ps1" & Chr(34)
WshShell.Run cmd, 0, False

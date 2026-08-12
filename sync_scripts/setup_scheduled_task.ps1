# =====================================================
# 工厂排产跟进 - 定时同步任务配置脚本
#
# 功能：创建Windows计划任务，每天定时获取飞书数据并同步到网站
#
# 使用方式：以管理员身份运行 PowerShell，执行：
#   powershell -ExecutionPolicy Bypass -File setup_scheduled_task.ps1
# =====================================================

$taskName = "AIRX_工厂排产数据同步"
$batPath = "F:\TRAE SOLO CN\6a6af8dfe5bf7c0ed727a0ba\sync_scripts\auto_sync.bat"
$startTime = "10:00"  # 每天10:00执行

Write-Host "=" * 60
Write-Host "工厂排产跟进 - 定时同步任务配置"
Write-Host "=" * 60
Write-Host ""
Write-Host "  任务名称: $taskName"
Write-Host "  执行脚本: $batPath"
Write-Host "  执行时间: 每天 $startTime"
Write-Host ""

# 检查脚本是否存在
if (-not (Test-Path $batPath)) {
    Write-Host "❌ 找不到批处理脚本: $batPath" -ForegroundColor Red
    Write-Host "   请确保已将 auto_sync.bat 放到正确位置" -ForegroundColor Yellow
    exit 1
}

# 检查是否已有同名任务
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "⚠️ 已存在同名任务，将先删除再创建..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# 创建定时任务
$action = New-ScheduledTaskAction -Execute $batPath
$trigger = New-ScheduledTaskTrigger -Daily -At $startTime
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "每天定时获取飞书工厂排产数据并同步到airxchina.com.cn网站" | Out-Null

Write-Host "✅ 定时任务创建成功!" -ForegroundColor Green
Write-Host ""
Write-Host "  下次执行时间: 明天 $startTime"
Write-Host ""
Write-Host "  管理命令:"
Write-Host "    查看状态: Get-ScheduledTask -TaskName '$taskName'"
Write-Host "    立即执行: Start-ScheduledTask -TaskName '$taskName'"
Write-Host "    暂停任务: Disable-ScheduledTask -TaskName '$taskName'"
Write-Host "    恢复任务: Enable-ScheduledTask -TaskName '$taskName'"
Write-Host "    删除任务: Unregister-ScheduledTask -TaskName '$taskName'"
Write-Host ""

# 询问是否立即执行一次
$runNow = Read-Host "是否立即执行一次测试？(y/n)"
if ($runNow -eq 'y' -or $runNow -eq 'Y') {
    Write-Host ""
    Write-Host "正在执行..." -ForegroundColor Cyan
    Start-ScheduledTask -TaskName $taskName
    Start-Sleep -Seconds 3
    $taskInfo = Get-ScheduledTask -TaskName $taskName
    $taskInfo | Select-Object TaskName, State, LastRunTime, LastTaskResult | Format-List
}

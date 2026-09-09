<#
.SYNOPSIS
  사자성어 이야기를 Windows 작업 스케줄러에 등록한다. 하루 한 번(기본 10:00).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1
  powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1 -Time 08:30
  powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1 -Unregister
#>
[CmdletBinding()]
param(
  [string]$TaskName = 'Sajaseongeo-Daily',
  [string]$Time = '10:00',
  [switch]$Unregister
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$Root = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $Root 'scripts\run-scheduled.ps1'

if ($Unregister) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "등록 해제했다: $TaskName"
  } else {
    Write-Host "등록된 작업이 없다: $TaskName"
  }
  return
}
if (-not (Test-Path -LiteralPath $runner)) { throw "실행기를 찾지 못했다: $runner" }

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $runner) `
  -WorkingDirectory $Root
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1) -RestartCount 1 -RestartInterval (New-TimeSpan -Minutes 10)
$principal = New-ScheduledTaskPrincipal -UserId ('{0}\{1}' -f $env:USERDOMAIN, $env:USERNAME) -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
  -Description '사자성어 이야기: 매일 한 편을 생성해 저장소에 커밋한다.' -Force | Out-Null

Write-Host "등록 완료: $TaskName ($Time)"
Write-Host "확인:      Get-ScheduledTask -TaskName '$TaskName' | Get-ScheduledTaskInfo"
Write-Host "즉시 실행: Start-ScheduledTask -TaskName '$TaskName'"

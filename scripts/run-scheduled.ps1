<#
.SYNOPSIS
  사자성어 이야기 — 예약 실행기. 작업 스케줄러가 하루 한 번 부른다.

.DESCRIPTION
  오늘 날짜로 이미 한 편이 나왔으면 건너뛰고, 아니면 한 편 생성한다.
  마감 시각(config.json의 cutoffHour, 기본 23시)을 넘기면 그날 분은 접는다.
  실패하면 5분 뒤 한 번만 다시 시도한다.

.PARAMETER Force
  오늘 편수와 마감 시각을 무시하고 한 편 생성한다.
#>
[CmdletBinding()]
param([switch]$Force)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

$logDir = Join-Path $Root 'logs'
if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile = Join-Path $logDir ((Get-Date -Format 'yyyy-MM') + '.log')
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-Log {
  param([string]$Message)
  $line = '{0} | {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  [System.IO.File]::AppendAllText($logFile, $line + [Environment]::NewLine, $utf8NoBom)
  Write-Host $line
}

$config = Get-Content -LiteralPath (Join-Path $Root 'config.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$postsPerDay = 1
$cutoffHour = 23
if ($config.PSObject.Properties['postsPerDay']) { $postsPerDay = [int]$config.postsPerDay }
if ($config.PSObject.Properties['cutoffHour']) { $cutoffHour = [int]$config.cutoffHour }

function Resolve-GitBash {
  $candidates = @(
    (Join-Path $env:ProgramFiles 'Git\bin\bash.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Git\bin\bash.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Git\bin\bash.exe'),
    'C:\Program Files\Git\bin\bash.exe'
  )
  foreach ($p in $candidates) { if ($p -and (Test-Path -LiteralPath $p)) { return $p } }
  $found = Get-Command bash.exe -ErrorAction SilentlyContinue
  if ($found -and $found.Source -notmatch '\\System32\\') { return $found.Source }
  return $null
}
$bash = Resolve-GitBash
if (-not $bash) { Write-Log 'ABORT | Git Bash(bash.exe)를 찾지 못했다.'; exit 1 }
$generator = (Join-Path $Root 'scripts\generate-idiom.sh') -replace '\\', '/'

function Get-TodayCount {
  $today = Get-Date -Format 'yyyy-MM-dd'
  $dir = Join-Path $Root 'data\idioms'
  if (-not (Test-Path -LiteralPath $dir)) { return 0 }
  $n = 0
  foreach ($f in Get-ChildItem -Path $dir -Filter '*.json' -File) {
    $raw = [System.IO.File]::ReadAllText($f.FullName)
    if ($raw -match ('"date":\s*"' + $today + '"')) { $n++ }
  }
  return $n
}

$todayCount = Get-TodayCount
if ($Force) {
  $needed = 1
} else {
  if ((Get-Date).Hour -ge $cutoffHour) {
    Write-Log ("SKIP | 마감 {0}시가 지나 오늘 분은 접는다 (오늘 {1}/{2}편)" -f $cutoffHour, $todayCount, $postsPerDay)
    exit 0
  }
  $needed = $postsPerDay - $todayCount
}
if ($needed -le 0) {
  Write-Log ("SKIP | 오늘 목표를 이미 채웠다 ({0}/{1}편)" -f $todayCount, $postsPerDay)
  exit 0
}

Write-Log ("RUN | 시작 — 오늘 {0}/{1}편, 이번에 {2}편" -f $todayCount, $postsPerDay, $needed)

function Invoke-Generate {
  & $bash $generator | Out-Host
  return ($LASTEXITCODE -eq 0)
}

$made = 0
for ($i = 1; $i -le $needed; $i++) {
  if (Invoke-Generate) { $made++; continue }
  Write-Log 'RETRY | 실패. 5분 뒤 한 번만 다시 시도한다.'
  Start-Sleep -Seconds 300
  if (Invoke-Generate) { $made++; continue }
  Write-Log 'ABORT | 재시도도 실패했다. 로그만 남기고 끝낸다.'
  Write-Log ("RUN | 종료 — 이번 실행 {0}편 생성" -f $made)
  exit 1
}
Write-Log ("RUN | 종료 — 이번 실행 {0}편 생성 (오늘 누적 {1}편)" -f $made, (Get-TodayCount))
exit 0

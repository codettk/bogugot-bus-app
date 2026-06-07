# bogugot-bus-app 매일 아침 자동 실행 스크립트
# Windows 작업 스케줄러에서 호출됨 (매일 7:00 AM)
# 등록 방법: 아래 "작업 스케줄러 등록" 섹션 참고

$ProjectDir = "c:\dev\codettk\bogugot-bus-app"
$LogDir = "$ProjectDir\logs"
$LogFile = "$LogDir\morning-run-$(Get-Date -Format 'yyyy-MM-dd').log"
$EnvFile = "$ProjectDir\.env"

# 로그 디렉토리 생성
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
}

function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    "$timestamp $Message" | Tee-Object -FilePath $LogFile -Append
}

Write-Log "=== 아침 자동화 시작 ==="
Write-Log "프로젝트: $ProjectDir"

# .env 파일 로드
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), 'Process')
        }
    }
    Write-Log ".env 파일 로드 완료"
} else {
    Write-Log "경고: .env 파일이 없습니다 — $EnvFile"
}

# Claude Code CLI 존재 확인
$ClaudePath = (Get-Command claude -ErrorAction SilentlyContinue).Source
if (-not $ClaudePath) {
    Write-Log "오류: claude CLI를 찾을 수 없습니다. PATH를 확인하세요."
    exit 1
}
Write-Log "Claude CLI: $ClaudePath"

# 이미 오늘 실행된 pending 결정이 있는지 확인
# (사용자가 답변 안 했으면 재실행하지 않음)
$Today = Get-Date -Format 'yyyy-MM-dd'
$CheckPending = @"
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  const result = await client.query(
    "SELECT COUNT(*) as cnt FROM pm_decisions WHERE run_date = \$1 AND status = 'pending'",
    ['$Today']
  );
  console.log(result.rows[0].cnt);
  await client.end();
}).catch(() => { console.log('0'); process.exit(0); });
"@

Set-Location $ProjectDir
$PendingCount = "0"
try {
    $PendingCount = node -e $CheckPending 2>$null
} catch {
    $PendingCount = "0"
}

if ($PendingCount -gt 0) {
    Write-Log "오늘 ($Today) 아직 답변 대기 중인 질문이 있습니다. 워크플로우를 건너뜁니다."
    Write-Log "→ /admin/pm 페이지에서 질문에 답변하면 자동으로 재시작됩니다."
    exit 0
}

# daily-planning 워크플로우 실행
Write-Log "daily-planning 워크플로우 시작..."
$DateArg = "{`"date`":`"$Today`"}"

try {
    & claude --workflow daily-planning --args $DateArg 2>&1 | Tee-Object -FilePath $LogFile -Append
    $ExitCode = $LASTEXITCODE
    Write-Log "워크플로우 종료 (exit code: $ExitCode)"
} catch {
    Write-Log "오류: $($_.Exception.Message)"
    exit 1
}

Write-Log "=== 아침 자동화 종료 ==="

<#
.SYNOPSIS
  Windows 작업 스케줄러 등록 방법 (PowerShell 관리자 권한으로 실행)

  $Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NonInteractive -WindowStyle Hidden -File `"c:\dev\codettk\bogugot-bus-app\scripts\morning-run.ps1`""

  $Trigger = New-ScheduledTaskTrigger -Daily -At "07:00AM"

  $Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -RestartCount 1 `
    -RestartInterval (New-TimeSpan -Minutes 10)

  Register-ScheduledTask `
    -TaskName "BogugotBusApp-MorningRun" `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -RunLevel Highest `
    -Force

  Write-Host "작업 스케줄러 등록 완료"
#>

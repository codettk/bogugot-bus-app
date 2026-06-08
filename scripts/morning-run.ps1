# bogugot-bus-app 매일 아침 자동 실행 스크립트
# Windows 작업 스케줄러에서 호출됨 (매일 7:00 AM)
# 등록 방법: 아래 "작업 스케줄러 등록" 섹션 참고

$ProjectDir = "c:\dev\codettk\bogugot-bus-app"
$LogDir = "$ProjectDir\logs"
$LogFile = "$LogDir\morning-run-$(Get-Date -Format 'yyyy-MM-dd').log"
$EnvFile = "$ProjectDir\.env"

# UTF-8 인코딩 강제 (Windows PowerShell 5.1에서 한글 로그/출력 깨짐 방지)
# claude.exe(UTF-8 출력)를 올바르게 캡처하고 로그도 UTF-8로 기록한다.
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

# 로그 디렉토리 생성
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
}

function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "$timestamp $Message"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
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

try {
    & claude -p "/daily-planning" --dangerously-skip-permissions 2>&1 | ForEach-Object {
        Write-Host $_
        Add-Content -Path $LogFile -Value $_ -Encoding UTF8
    }
    $ExitCode = $LASTEXITCODE
    Write-Log "워크플로우 종료 (exit code: $ExitCode)"
} catch {
    Write-Log "오류: $($_.Exception.Message)"
    exit 1
}

# 워크플로우 종료 후 잔여 worktree 정리 (안전망)
# implement-feature는 단일 통합 브랜치 순차 빌드로 전환되어 worktree를 만들지 않지만,
# 과거 잔여물이나 예외 상황 대비로 prune을 유지한다.
Write-Log "worktree 정리 중..."
try {
    & git -C $ProjectDir worktree prune 2>&1 | Out-Null

    $WtDir = "$ProjectDir\.claude\worktrees"
    if (Test-Path $WtDir) {
        Get-ChildItem $WtDir -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            try { Remove-Item $_.FullName -Recurse -Force -ErrorAction Stop } catch {}
        }
        $Remaining = (Get-ChildItem $WtDir -Directory -ErrorAction SilentlyContinue).Count
        if ($Remaining -gt 0) {
            Write-Log "  주의: worktree 폴더 $Remaining개가 잠겨 삭제되지 않음 (실행 중인 프로세스 확인 필요)"
        }
    }

    # 통합 후 남은 worktree-wf_* 브랜치 삭제 (병합된 커밋은 통합 브랜치에 보존됨)
    $StaleBranches = & git -C $ProjectDir branch --format '%(refname:short)' 2>$null |
        Where-Object { $_ -like 'worktree-wf_*' }
    foreach ($b in $StaleBranches) { & git -C $ProjectDir branch -D $b 2>&1 | Out-Null }

    Write-Log "worktree 정리 완료"
} catch {
    Write-Log "worktree 정리 중 경고: $($_.Exception.Message)"
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

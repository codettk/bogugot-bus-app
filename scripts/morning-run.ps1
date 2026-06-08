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

try {
    & claude -p "/daily-planning" --dangerously-skip-permissions 2>&1 | Tee-Object -FilePath $LogFile -Append
    $ExitCode = $LASTEXITCODE
    Write-Log "워크플로우 종료 (exit code: $ExitCode)"
} catch {
    Write-Log "오류: $($_.Exception.Message)"
    exit 1
}

# 워크플로우 종료 후 잔여 worktree 정리 (디스크 누적 방지)
# implement-feature가 isolation:'worktree'로 만든 격리 작업트리는 변경이 있으면
# 자동 삭제되지 않으므로, 통합(병합) 단계가 끝난 뒤 여기서 일괄 정리한다.
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

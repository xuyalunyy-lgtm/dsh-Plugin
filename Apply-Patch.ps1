param(
  [ValidateSet('Apply','Rollback')][string]$Action = 'Apply',
  [string]$Plan = (Join-Path $PSScriptRoot 'staging\release-0.2.1-rc.3-reviewed\plan.json')
)
$ErrorActionPreference = 'Stop'
$planPath = (Resolve-Path -LiteralPath $Plan).Path
$config = Get-Content -LiteralPath $planPath -Raw | ConvertFrom-Json
if ($config.schema -ne 1) { throw 'Unsupported patch plan' }
$target = [IO.Path]::GetFullPath([string]$config.target)
$executable = [IO.Path]::GetFullPath([string]$config.executable)
$archive = [IO.Path]::GetFullPath([string]$config.archive)
$backup = [IO.Path]::GetFullPath([string]$config.backup)
$expectedTarget = 'D:\deepseekH\resources\app.asar'
$expectedExe = 'D:\deepseekH\DeepSeek Harness.exe'
$expectedArchive = Join-Path $PSScriptRoot 'staging\release-0.2.1-rc.3-reviewed\app.asar'
$expectedBackup = 'D:\deepseekH\resources\app.asar.safe-restart-04b32e3a8728.bak'
if ($target -ne $expectedTarget -or $executable -ne $expectedExe -or $archive -ne $expectedArchive -or $backup -ne $expectedBackup) { throw 'Patch plan paths do not match the reviewed installation' }
if ($config.originalSha256 -ne '04b32e3a872826ba15cfb2081c6a929a8d4ecaa65e09a2543e5a6b30e2eff1f0') { throw 'Unknown baseline hash' }
. (Join-Path $PSScriptRoot 'Patch-Files.ps1')
Assert-DesktopPatchFile $executable
function Assert-Stopped {
  $running = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue
  foreach ($process in $running) {
    $processPath = $process.Path
    if ([string]::IsNullOrEmpty($processPath) -or $processPath -eq $executable) {
      throw 'DeepSeek Harness is still running. Choose Application > Exit (do not only close to tray), then retry. No processes were stopped.'
    }
  }
}
$result = Invoke-DesktopArchivePatch -Action $Action -Target $target -Archive $archive -Backup $backup -OriginalHash $config.originalSha256 -PatchedHash $config.patchedSha256 -CheckStopped { Assert-Stopped }
Write-Host $result

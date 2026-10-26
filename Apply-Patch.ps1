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
function Get-Hash([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Assert-Regular([string]$Path) {
  $item = Get-Item -LiteralPath $Path
  if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Not a regular file: $Path" }
}
function Assert-Stopped {
  $running = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue
  foreach ($process in $running) {
    $processPath = $process.Path
    if ([string]::IsNullOrEmpty($processPath) -or $processPath -eq $executable) {
      throw 'DeepSeek Harness is still running. Choose Application > Exit (do not only close to tray), then retry. No processes were stopped.'
    }
  }
}
Assert-Regular $target
Assert-Regular $executable
Assert-Stopped
$currentHash = Get-Hash $target
if ($Action -eq 'Apply') {
  Assert-Regular $archive
  if ((Get-Hash $archive) -ne $config.patchedSha256) { throw 'Staged patch checksum mismatch' }
  if ($currentHash -eq $config.patchedSha256) { Write-Host 'Patch is already installed.'; exit 0 }
  if ($currentHash -ne $config.originalSha256) { throw 'Installation changed; refusing to overwrite it' }
  if (Test-Path -LiteralPath $backup) {
    Assert-Regular $backup
    if ((Get-Hash $backup) -ne $config.originalSha256) { throw 'Existing backup checksum mismatch' }
  } else {
    Copy-Item -LiteralPath $target -Destination $backup
    if ((Get-Hash $backup) -ne $config.originalSha256) { throw 'Backup verification failed; installation unchanged' }
  }
  $source = $archive; $expectedFinal = [string]$config.patchedSha256
} else {
  Assert-Regular $backup
  if ((Get-Hash $backup) -ne $config.originalSha256) { throw 'Backup checksum mismatch' }
  if ($currentHash -eq $config.originalSha256) { Write-Host 'Original version is already restored.'; exit 0 }
  if ($currentHash -ne $config.patchedSha256) { throw 'Installation changed; refusing rollback over another version' }
  $source = $backup; $expectedFinal = [string]$config.originalSha256
}
$temporary = Join-Path (Split-Path -Parent $target) ('app.asar.safe-restart-' + [guid]::NewGuid().ToString('N') + '.tmp')
$confirmedTemporary = [IO.Path]::GetFullPath($temporary)
if ((Split-Path -Parent $confirmedTemporary) -ne (Split-Path -Parent $target) -or (Test-Path -LiteralPath $confirmedTemporary)) { throw 'Unsafe temporary destination' }
try {
  Copy-Item -LiteralPath $source -Destination $confirmedTemporary
  if ((Get-Hash $confirmedTemporary) -ne $expectedFinal) { throw 'Temporary file checksum mismatch' }
  Assert-Stopped
  if ((Get-Hash $target) -ne $currentHash) { throw 'Installation changed during preparation' }
  # Both absolute paths were checked above. Atomic replacement never modifies the EXE or unpacked assets.
  [IO.File]::Replace($confirmedTemporary, $target, $null)
  if ((Get-Hash $target) -ne $expectedFinal) { throw 'Installed checksum mismatch; use Rollback and retain the backup' }
  Write-Host "$Action succeeded. Launch DeepSeek Harness normally. The installer did not start or stop the app."
} finally {
  # Only this invocation's checked, unique temporary file may be removed.
  if (Test-Path -LiteralPath $confirmedTemporary) { Remove-Item -LiteralPath $confirmedTemporary -Force }
}

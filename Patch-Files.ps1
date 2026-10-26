# File operations shared by the fixed-path installer and isolated real-file tests.
function Get-DesktopPatchHash([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}
function Assert-DesktopPatchFile([string]$Path) {
  $item = Get-Item -LiteralPath $Path -ErrorAction Stop
  if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Not a regular file: $Path" }
}
function Invoke-DesktopArchivePatch {
  param(
    [Parameter(Mandatory)][ValidateSet('Apply','Rollback')][string]$Action,
    [Parameter(Mandatory)][string]$Target,
    [Parameter(Mandatory)][string]$Archive,
    [Parameter(Mandatory)][string]$Backup,
    [Parameter(Mandatory)][string]$OriginalHash,
    [Parameter(Mandatory)][string]$PatchedHash,
    [Parameter(Mandatory)][scriptblock]$CheckStopped
  )
  $targetPath = [IO.Path]::GetFullPath($Target)
  $archivePath = [IO.Path]::GetFullPath($Archive)
  $backupPath = [IO.Path]::GetFullPath($Backup)
  if ($targetPath -eq $archivePath -or $targetPath -eq $backupPath -or $archivePath -eq $backupPath) { throw 'Patch paths must be distinct' }
  if ($OriginalHash -notmatch '^[a-fA-F0-9]{64}$' -or $PatchedHash -notmatch '^[a-fA-F0-9]{64}$' -or $OriginalHash -eq $PatchedHash) { throw 'Invalid patch checksums' }
  Assert-DesktopPatchFile $targetPath
  $currentHash = Get-DesktopPatchHash $targetPath
  # Read-only no-op checks precede backup, staged-file and process requirements.
  if ($Action -eq 'Rollback' -and $currentHash -eq $OriginalHash) {
    return 'Original version is already restored. No rollback or backup is needed.'
  }
  if ($Action -eq 'Apply' -and $currentHash -eq $PatchedHash) {
    return 'Patch is already installed. No files were changed.'
  }
  if ($Action -eq 'Apply') {
    if ($currentHash -ne $OriginalHash) { throw 'Installation changed; refusing to overwrite it' }
    Assert-DesktopPatchFile $archivePath
    if ((Get-DesktopPatchHash $archivePath) -ne $PatchedHash) { throw 'Staged patch checksum mismatch' }
    & $CheckStopped
    if (Test-Path -LiteralPath $backupPath) {
      Assert-DesktopPatchFile $backupPath
      if ((Get-DesktopPatchHash $backupPath) -ne $OriginalHash) { throw 'Existing backup checksum mismatch' }
    } else {
      [IO.File]::Copy($targetPath, $backupPath, $false)
      if ((Get-DesktopPatchHash $backupPath) -ne $OriginalHash) { throw 'Backup verification failed; installation unchanged' }
    }
    $sourcePath = $archivePath
    $expectedFinal = $PatchedHash
  } else {
    if ($currentHash -ne $PatchedHash) { throw 'Installation changed; refusing rollback over another version' }
    if (!(Test-Path -LiteralPath $backupPath)) { throw 'Rollback backup is missing. Installation was not modified; recover the verified original backup before retrying.' }
    Assert-DesktopPatchFile $backupPath
    if ((Get-DesktopPatchHash $backupPath) -ne $OriginalHash) { throw 'Backup checksum mismatch' }
    & $CheckStopped
    $sourcePath = $backupPath
    $expectedFinal = $OriginalHash
  }
  $parent = Split-Path -Parent $targetPath
  $temporaryPath = [IO.Path]::GetFullPath((Join-Path $parent ('app.asar.safe-restart-' + [guid]::NewGuid().ToString('N') + '.tmp')))
  if ((Split-Path -Parent $temporaryPath) -ne $parent -or (Test-Path -LiteralPath $temporaryPath)) { throw 'Unsafe temporary destination' }
  try {
    [IO.File]::Copy($sourcePath, $temporaryPath, $false)
    Assert-DesktopPatchFile $temporaryPath
    if ((Get-DesktopPatchHash $temporaryPath) -ne $expectedFinal) { throw 'Temporary file checksum mismatch' }
    & $CheckStopped
    if ((Get-DesktopPatchHash $targetPath) -ne $currentHash) { throw 'Installation changed during preparation' }
    # NullString passes a genuine null System.String to .NET. PowerShell $null
    # is coerced to an empty string here and causes File.Replace to reject path.
    [IO.File]::Replace($temporaryPath, $targetPath, [NullString]::Value)
    if ((Get-DesktopPatchHash $targetPath) -ne $expectedFinal) { throw 'Installed checksum mismatch; use Rollback and retain the backup' }
    return "$Action succeeded. Launch DeepSeek Harness normally. The installer did not start or stop the app."
  } finally {
    # The unique absolute temporary path was checked above; never remove target or backup.
    if (Test-Path -LiteralPath $temporaryPath) {
      Assert-DesktopPatchFile $temporaryPath
      [IO.File]::Delete($temporaryPath)
    }
  }
}

param([Parameter(Mandatory)][string]$TestRoot)
$ErrorActionPreference = 'Stop'
. (Join-Path (Split-Path -Parent $PSScriptRoot) 'Patch-Files.ps1')
$root = [IO.Path]::GetFullPath($TestRoot)
if (!(Test-Path -LiteralPath $root) -or !(Split-Path -Leaf $root).StartsWith('dsh-patch-files-')) { throw 'Unsafe test directory' }
$target = Join-Path $root 'app.asar'
$archive = Join-Path $root 'staged.asar'
$backup = Join-Path $root 'backup.asar'
[IO.File]::WriteAllText($target,'original bytes')
[IO.File]::WriteAllText($archive,'patched bytes')
$originalHash = Get-DesktopPatchHash $target
$patchedHash = Get-DesktopPatchHash $archive
$script:checks = 0
$normalCheck = { $script:checks++ }
function Invoke-TestPatch([string]$Action,[scriptblock]$Check = $normalCheck) {
  return Invoke-DesktopArchivePatch -Action $Action -Target $target -Archive $archive -Backup $backup -OriginalHash $originalHash -PatchedHash $patchedHash -CheckStopped $Check
}
function Equal($Actual,$Expected,[string]$Message) { if ($Actual -ne $Expected) { throw "Assertion failed: $Message -- $Actual != $Expected" } }
function Fails([scriptblock]$Operation,[string]$Message) {
  $failed = $false
  try { & $Operation | Out-Null } catch { if ($_.Exception.Message -notlike $Message) { throw }; $failed = $true }
  if (!$failed) { throw "Expected rejection: $Message" }
}
# Regression: uninstalled Rollback must be read-only and not require a nonexistent backup.
$message = Invoke-TestPatch 'Rollback' { throw 'must not inspect processes for no-op' }
Equal ($message -like 'Original version is already restored.*') $true 'noop rollback'
Equal (Test-Path -LiteralPath $backup) $false 'no artificial backup'
# Regression: genuine File.Replace runs through PowerShell; this fails with old $null code.
$message = Invoke-TestPatch 'Apply'
Equal ($message -like 'Apply succeeded.*') $true 'apply result'
Equal (Get-DesktopPatchHash $target) $patchedHash 'actual installed bytes'
Equal (Get-DesktopPatchHash $backup) $originalHash 'backup bytes'
Equal $script:checks 2 'process checks before backup and replace'
$message = Invoke-TestPatch 'Apply' { throw 'must not inspect processes for no-op' }
Equal ($message -like 'Patch is already installed.*') $true 'repeat apply'
$message = Invoke-TestPatch 'Rollback'
Equal ($message -like 'Rollback succeeded.*') $true 'actual rollback'
Equal (Get-DesktopPatchHash $target) $originalHash 'restored bytes'
Equal (Get-DesktopPatchHash $backup) $originalHash 'retained backup'
$message = Invoke-TestPatch 'Rollback' { throw 'must not inspect processes for no-op' }
Equal ($message -like 'Original version is already restored.*') $true 'repeat rollback'
# Missing/corrupt recovery materials and changed versions must fail without target writes.
[IO.File]::WriteAllText($target,'patched bytes')
[IO.File]::Delete($backup)
Fails { Invoke-TestPatch 'Rollback' } 'Rollback backup is missing.*'
Equal (Get-DesktopPatchHash $target) $patchedHash 'missing backup does not change target'
[IO.File]::WriteAllText($backup,'bad backup')
Fails { Invoke-TestPatch 'Rollback' } 'Backup checksum mismatch'
[IO.File]::WriteAllText($target,'updated elsewhere')
Fails { Invoke-TestPatch 'Rollback' } 'Installation changed; refusing rollback over another version'
Fails { Invoke-TestPatch 'Apply' } 'Installation changed; refusing to overwrite it'
# A running app refuses before backup, then refuses again immediately before Replace.
[IO.File]::WriteAllText($target,'original bytes')
[IO.File]::WriteAllText($backup,'original bytes')
Fails { Invoke-TestPatch 'Apply' { throw 'running-app' } } 'running-app'
Equal (Get-DesktopPatchHash $target) $originalHash 'running guard leaves target'
$script:secondChecks=0
Fails { Invoke-TestPatch 'Apply' { $script:secondChecks++; if ($script:secondChecks -eq 2) { throw 'restarted-app' } } } 'restarted-app'
Equal (Get-DesktopPatchHash $target) $originalHash 'second guard leaves target'
Equal @(Get-ChildItem -LiteralPath $root -Filter '*.tmp').Count 0 'temp cleaned after failure'
# Target is rechecked after copying staging and the final process guard.
$script:thirdChecks=0
Fails { Invoke-TestPatch 'Apply' { $script:thirdChecks++; if($script:thirdChecks -eq 2) { [IO.File]::WriteAllText($target,'changed during preparation') } } } 'Installation changed during preparation'
Equal ([IO.File]::ReadAllText($target)) 'changed during preparation' 'concurrent update retained'
Equal @(Get-ChildItem -LiteralPath $root -Filter '*.tmp').Count 0 'temporary cleaned'
Write-Output 'PATCH_FILES_TESTS_PASSED'

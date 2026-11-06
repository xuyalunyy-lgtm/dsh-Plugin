param(
  [string]$Plan = (Join-Path $PSScriptRoot 'staging\plan.json'),
  [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$spec = Get-Content -LiteralPath (Resolve-Path -LiteralPath $Plan) -Raw | ConvertFrom-Json
$target = [IO.Path]::GetFullPath($spec.target)
$candidate = [IO.Path]::GetFullPath($spec.archive)
$settingsPath = [IO.Path]::GetFullPath($spec.settingsPath)
$baselineHash = '12b95a06a6cd37bfe7d0505e8a23afa3e7b26d42e7d5c078b10463e96c13a008'
$candidateHash = 'd3a21eeeb96cc3fe7e844f5c773db0ad1abbdd9c2f1bcf6c4f2d387ffd5575a0'
if ($spec.version -ne 1 -or $spec.kind -ne 'dsh-desktop-update-policy' -or $spec.status -ne 'candidate-not-installed' -or $spec.desktopVersion -ne '0.2.2-rc.1' -or $spec.buildCommit -ne 'c59d10aff167ad7eefead4b3a9082fb57c8fbfe8' -or $spec.defaultUpdatesEnabled -ne $false) { throw 'Unsupported update-policy plan' }
if ($target -ne 'D:\xuyl\tool\dsh_app\resources\app.asar' -or $settingsPath -ne 'C:\Users\Administrator\AppData\Roaming\@deepseek-ai\dsh-desktop\desktop\settings.json') { throw 'Unexpected installation or settings path' }
if ($spec.originalArchiveSha256 -ne $baselineHash -or $spec.sha256 -ne $candidateHash) { throw 'Plan hashes differ from the reviewed candidate' }
if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $baselineHash) { throw 'Installed archive changed; review before installing' }
if ((Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash -ne $candidateHash) { throw 'Candidate hash mismatch' }
if (Test-Path -LiteralPath $settingsPath) {
  $settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json -AsHashtable
  if ($settings -isnot [System.Collections.IDictionary]) { throw 'Desktop settings must be a JSON object' }
} else { $settings = @{} }
if (-not $settings.Contains('updates')) { $settings['updates'] = @{} }
if ($settings['updates'] -isnot [System.Collections.IDictionary]) { throw 'Desktop updates settings must be a JSON object' }
$settings['updates']['enabled'] = $false
$settingsJson = ($settings | ConvertTo-Json -Depth 100) + "`n"
$installRoot = Split-Path (Split-Path $target -Parent) -Parent
$running = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($installRoot + '\', [StringComparison]::OrdinalIgnoreCase) })
if ($CheckOnly) {
  Write-Output ('归档、构建和候选哈希检查通过。运行中 DSH 进程：' + $running.Count)
  Write-Output '仅检查，未替换程序或修改设置。安装前必须完全退出 DSH。'
  return
}
if ($running.Count) { throw '请先通过应用菜单完全退出 DSH（包括托盘），再从外部 PowerShell 7 安装。不会强制结束进程。' }
$temp = $target + '.update-policy-install.tmp'
$settingsTemp = $settingsPath + '.update-policy-install.tmp'
if ((Test-Path -LiteralPath $temp) -or (Test-Path -LiteralPath $settingsTemp)) { throw 'Installation temporary file already exists; inspect it before retrying' }
Copy-Item -LiteralPath $candidate -Destination $temp
if ((Get-FileHash -LiteralPath $temp -Algorithm SHA256).Hash -ne $candidateHash) { throw 'Copied candidate hash mismatch' }
New-Item -ItemType Directory -Path (Split-Path $settingsPath -Parent) -Force | Out-Null
[IO.File]::WriteAllText($settingsTemp, $settingsJson, [Text.UTF8Encoding]::new($false))
# Both exact absolute destinations were validated above. Preserve all other settings.
[IO.File]::Move($settingsTemp, $settingsPath, $true)
[IO.File]::Move($temp, $target, $true)
Write-Output '更新禁用补丁已安装，updates.enabled=false。请启动原 DSH 应用，核对菜单“更新已禁用”和更新检查不再出现。'
Write-Output ('已安装归档 SHA256：' + (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash)

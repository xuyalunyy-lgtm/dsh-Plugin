param([Parameter(Mandatory=$true)][string]$Plan)
$ErrorActionPreference='Stop'
$spec=Get-Content -LiteralPath (Resolve-Path -LiteralPath $Plan) -Raw | ConvertFrom-Json
$target=[IO.Path]::GetFullPath($spec.target)
$candidate=[IO.Path]::GetFullPath($spec.archive)
if($spec.version -ne 1 -or $spec.desktopVersion -ne '0.2.2-rc.1' -or $spec.buildCommit -ne 'c59d10aff167ad7eefead4b3a9082fb57c8fbfe8'){throw 'Unsupported patch plan'}
if($target -ne 'D:\xuyl\tool\dsh_app\resources\app.asar'){throw 'Unexpected installation target'}
$installRoot=Split-Path (Split-Path $target -Parent) -Parent
$running=Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($installRoot+'\',[StringComparison]::OrdinalIgnoreCase) }
if($running){throw '请先通过应用菜单完全退出 DSH（包括托盘），再从外部 PowerShell 安装。不会强制结束进程。'}
if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $spec.originalArchiveSha256){throw 'Installed archive changed; refusing overwrite'}
if((Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash -ne $spec.sha256){throw 'Candidate hash mismatch'}
$temp=$target+'.purge-install.tmp'
if(Test-Path -LiteralPath $temp){throw 'Installation temporary file already exists; inspect before retry'}
Copy-Item -LiteralPath $candidate -Destination $temp
if((Get-FileHash -LiteralPath $temp -Algorithm SHA256).Hash -ne $spec.sha256){throw 'Copied archive hash mismatch'}
# Exact absolute destination was validated above; retain the installed unpacked tree.
[IO.File]::Move($temp,$target,$true)
Write-Output '补丁已安装。请启动原 DSH 应用，在新建的验证会话上确认删除效果。'

#Requires -Version 5.1
# 无 Node 时的交互式拉取、暂存区裁剪、提交与推送（与 git-push.mjs 流程对齐）
$ErrorActionPreference = "Stop"

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]] $GitArgs,
    [switch] $Inherit
  )
  if ($Inherit) {
    & git @GitArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
  else {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $out = & git @GitArgs 2>&1
    $ErrorActionPreference = $prev
    if ($LASTEXITCODE -ne 0) {
      Write-Host ($out | Out-String)
      exit $LASTEXITCODE
    }
    return (($out | ForEach-Object { $_.ToString() }) -join "`n").TrimEnd()
  }
}

$rootProbe = & git rev-parse --show-toplevel 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "当前目录不是 Git 仓库。"
  exit 1
}
$root = ($rootProbe | Out-String).Trim()
Set-Location $root

$branch = Invoke-Git @("branch", "--show-current")
if (-not $branch) {
  Write-Host "无法获取当前分支（可能处于分离 HEAD）。"
  exit 1
}

Write-Host ""
Write-Host "仓库根目录: $root"
Write-Host "当前分支: $branch"
Write-Host ""
Write-Host (Invoke-Git @("status", "-sb"))
Write-Host ""

$noPull = $args -contains "--no-pull"
if (-not $noPull) {
  $pull = Read-Host "是否执行 git pull --rebase --autostash --no-tags？(Y/n)"
  if ($pull -eq "" -or $pull -match '^[Yy]') {
    Invoke-Git @("pull", "--rebase", "--autostash", "--no-tags") -Inherit
    Write-Host ""
  }
}

Invoke-Git @("add", "-A")

function Get-StagedPaths {
  $s = Invoke-Git @("diff", "--cached", "--name-only")
  if (-not $s) { return @() }
  return @($s -split "`n" | Where-Object { $_ })
}

function Get-AddablePaths {
  $mod = Invoke-Git @("diff", "--name-only")
  $un = Invoke-Git @("ls-files", "--others", "--exclude-standard")
  $a = if ($mod) { @($mod -split "`n" | Where-Object { $_ }) } else { @() }
  $b = if ($un) { @($un -split "`n" | Where-Object { $_ }) } else { @() }
  return @($a + $b | Select-Object -Unique | Sort-Object)
}

function Read-IndexPick {
  param([string[]]$Paths, [string]$Prompt)
  if ($Paths.Count -eq 0) { return @() }
  for ($i = 0; $i -lt $Paths.Count; $i++) {
    Write-Host ("{0,3}: {1}" -f ($i + 1), $Paths[$i])
  }
  $line = Read-Host $Prompt
  if (-not $line.Trim()) { return @() }
  $nums = @(
    $line -split "[,\s]+" |
    Where-Object { $_ } |
    ForEach-Object {
      $n = 0
      if ([int]::TryParse($_, [ref]$n)) { $n }
    }
  )
  $picked = @()
  foreach ($n in $nums) {
    if ($n -ge 1 -and $n -le $Paths.Count) {
      $picked += $Paths[$n - 1]
    }
  }
  return $picked
}

$initial = Get-StagedPaths
if ($initial.Count -eq 0) {
  Write-Host "暂存区为空，无需提交。"
  exit 0
}

$exclude = Read-IndexPick -Paths $initial -Prompt "输入要从暂存区移除的文件编号（逗号或空格分隔），留空表示不移除"
foreach ($f in $exclude) {
  Invoke-Git @("restore", "--staged", "--", $f)
}

$adjust = Read-Host "是否继续调整暂存区？(y/N)"
while ($adjust -match '^[Yy]') {
  Write-Host "1) 从暂存区剔除  2) 加入暂存区  3) 完成"
  $op = Read-Host "选择 (1-3)"
  if ($op -eq "3") { break }
  if ($op -eq "1") {
    $cur = Get-StagedPaths
    $pick = Read-IndexPick -Paths $cur -Prompt "要移除的编号，留空跳过"
    foreach ($f in $pick) { Invoke-Git @("restore", "--staged", "--", $f) }
  }
  elseif ($op -eq "2") {
    $addable = Get-AddablePaths
    $pick = Read-IndexPick -Paths $addable -Prompt "要加入的编号，留空跳过"
    foreach ($f in $pick) { Invoke-Git @("add", "--", $f) }
  }
  Write-Host (Invoke-Git @("status", "-sb"))
  Write-Host ""
  $adjust = Read-Host "继续调整暂存区？(y/N)"
}

$final = Get-StagedPaths
if ($final.Count -eq 0) {
  Write-Host "暂存区为空，已取消提交。"
  exit 1
}

Write-Host ""
Write-Host "即将提交的文件："
foreach ($f in $final) { Write-Host "  $f" }
Write-Host ""
Invoke-Git @("--no-pager", "diff", "--cached", "--stat") -Inherit
Write-Host ""

$msg = Read-Host "提交说明（如 feat(scope): subject）"
if (-not $msg.Trim()) {
  Write-Host "提交说明不能为空。"
  exit 1
}

Write-Host "提交完成后：1) 推送到 origin  2) 仅本地提交，不推送"
$delivery = Read-Host "选择 (1/2，默认 1)"
if ($delivery -eq "2") {
  $afterCommit = "local"
}
else {
  $afterCommit = "push"
}

$ok = Read-Host "使用以上说明执行提交？(Y/n)"
if ($ok -match '^[Nn]') {
  Write-Host "已取消提交。"
  exit 0
}

Invoke-Git @("commit", "-m", $msg.Trim())

if ($afterCommit -eq "local") {
  Write-Host ""
  Write-Host "已完成本地提交，未执行 git push。"
  Write-Host "需要推送时可执行：git push origin $branch"
  Write-Host (Invoke-Git @("status", "-sb"))
  exit 0
}

$push = Read-Host "确认推送到 origin $branch ？(Y/n)"
if ($push -match '^[Nn]') {
  Write-Host "已取消推送；提交仅存在于本地。"
  Write-Host "稍后可执行：git push origin $branch"
  Write-Host (Invoke-Git @("status", "-sb"))
  exit 0
}

$upstreamProbe = & git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null
if ($LASTEXITCODE -eq 0) {
  Invoke-Git @("push", "origin", $branch) -Inherit
}
else {
  Invoke-Git @("push", "-u", "origin", $branch) -Inherit
}
Write-Host ""
Write-Host (Invoke-Git @("status", "-sb"))

param([switch]$Production)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if ($nodeCommand) {
    $nodeDirectory = Split-Path -Parent $nodeCommand.Source
} else {
    $portableNode = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot '.tools') -Directory -Filter 'node-*-win-x64' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if (-not $portableNode) { throw 'Install Node.js 22 LTS or newer, then run this script again: https://nodejs.org/' }
    $nodeDirectory = $portableNode.FullName
}
$env:PATH = $nodeDirectory + ';' + $env:PATH
$npmPath = Join-Path $nodeDirectory 'npm.cmd'
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules'))) {
    & $npmPath ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
if ($Production) {
    & $npmPath run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
    & $npmPath run preview -- --port 4173
} else {
    & $npmPath run dev -- --port 5173
}

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()

Get-ChildItem -LiteralPath $root -Recurse -Filter *.js | ForEach-Object {
  $output = & node --check $_.FullName 2>&1
  if ($LASTEXITCODE -ne 0) { $failures.Add("JS syntax: $($_.FullName)`n$output") }
}

Get-ChildItem -LiteralPath $root -Recurse -Filter *.json | ForEach-Object {
  try { Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null }
  catch { $failures.Add("JSON parse: $($_.FullName)`n$($_.Exception.Message)") }
}

Get-ChildItem -LiteralPath $root -Recurse -File -Include *.html,*.css,*.js | ForEach-Object {
  $file = $_
  $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
  if ($null -eq $content) { $content = '' }
  $matches = [regex]::Matches($content, '(?:src|href)\s*=\s*["'']([^"'']+)["'']')
  foreach ($match in $matches) {
    $path = $match.Groups[1].Value
    if ($path -match '^(?:https?:|data:|mailto:|javascript:|#)') { continue }
    if ($path -match '[${}]') { continue }
    $clean = ($path -split '[?#]')[0]
    if (-not $clean) { continue }
    $candidate = Join-Path $file.DirectoryName $clean
    if (-not (Test-Path -LiteralPath $candidate)) { $failures.Add("Missing asset: $($file.FullName): $path") }
  }
}

# JSON review records use the repository-relative asset paths stored in their
# sourceRefs fields. Validate those separately from HTML/JS relative URLs.
$reviewRoot = Get-ChildItem -LiteralPath (Join-Path $root 'tools') -Directory |
  ForEach-Object { Join-Path $_.FullName 'reviews' } |
  Where-Object { Test-Path -LiteralPath $_ } |
  Select-Object -First 1
if ($reviewRoot) {
Get-ChildItem -LiteralPath $reviewRoot -Recurse -Filter *.json | ForEach-Object {
  $file = $_
  try { $json = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json }
  catch { return }
  $raw = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
  foreach ($match in [regex]::Matches($raw, '"asset"\s*:\s*"([^"]+)"')) {
    $asset = $match.Groups[1].Value.Trim()
    $candidates = @(
      (Join-Path $reviewRoot $asset),
      (Join-Path $root $asset),
      (Join-Path $root ('tools\公考工具箱\' + $asset)),
      (Join-Path $root ('tools\公考工具箱\' + ($asset -replace '^reviews/', ''))),
      (Join-Path $reviewRoot ($asset -replace '^reviews/', ''))
    )
    if (-not ($candidates | Where-Object { Test-Path -LiteralPath $_ })) { $failures.Add("Missing review asset: $($file.FullName): $asset") }
  }
}
}

if ($failures.Count) {
  $failures | ForEach-Object { Write-Error $_ }
  exit 1
}
Write-Output 'Site checks passed: JavaScript, JSON, and literal local asset references.'

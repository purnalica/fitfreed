function Remove-ValidatedApplicationData {
  param(
    [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$Directory,
    [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$Description
  )

  for ($attempt = 0; $attempt -lt 300; $attempt += 1) {
    if (-not (Test-Path -LiteralPath $Directory)) { return }
    $root = Get-Item -LiteralPath $Directory -Force -ErrorAction Stop
    if (($root.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "$Description root is a reparse point"
    }
    $reparsePoints = @(Get-ChildItem -LiteralPath $Directory -Recurse -Force -ErrorAction Stop |
      Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 })
    if ($reparsePoints.Count -ne 0) {
      throw "$Description contains a reparse point"
    }
    try {
      Remove-Item -LiteralPath $Directory -Recurse -Force -ErrorAction Stop
    } catch {
    }
    if (-not (Test-Path -LiteralPath $Directory)) { return }
    if ($attempt -lt 299) { Start-Sleep -Milliseconds 100 }
  }
  throw "$Description remains after bounded cleanup"
}

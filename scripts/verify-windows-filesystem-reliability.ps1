Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Windows filesystem reliability verification requires an elevated disposable runner"
}

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$systemTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
$workingDirectory = Join-Path $systemTemp ("fitfreed-windows-filesystem-" + [Guid]::NewGuid().ToString("N"))
$vhdPath = Join-Path $workingDirectory "isolated.vhdx"
$diskpartScript = Join-Path $workingDirectory "diskpart.txt"
$driveLetter = $null
$driveRoot = $null

function Assert-OwnedWorkingDirectory {
  $resolved = [IO.Path]::GetFullPath($workingDirectory)
  if ([IO.Path]::GetDirectoryName($resolved) -ne $systemTemp) {
    throw "filesystem admission working directory escaped the system temporary root"
  }
  if (-not [IO.Path]::GetFileName($resolved).StartsWith("fitfreed-windows-filesystem-", [StringComparison]::Ordinal)) {
    throw "filesystem admission working directory has an invalid identity"
  }
  if (Test-Path -LiteralPath $resolved) {
    $item = Get-Item -LiteralPath $resolved -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "filesystem admission working directory is a reparse point"
    }
  }
}

function Invoke-Diskpart([string[]]$Commands) {
  Set-Content -LiteralPath $diskpartScript -Value ($Commands + "exit") -Encoding ascii
  & diskpart.exe /s $diskpartScript | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "diskpart rejected the isolated-volume operation" }
}

function Wait-ForDrive([bool]$Present) {
  for ($attempt = 0; $attempt -lt 100; $attempt += 1) {
    if ((Test-Path -LiteralPath $driveRoot) -eq $Present) { return }
    Start-Sleep -Milliseconds 100
  }
  throw "isolated NTFS drive did not reach the expected state"
}

New-Item -ItemType Directory -Path $workingDirectory | Out-Null
Assert-OwnedWorkingDirectory

try {
  $usedLetters = @(Get-PSDrive -PSProvider FileSystem | ForEach-Object { $_.Name.ToUpperInvariant() })
  $driveLetter = @("Z", "Y", "X", "W", "V", "U", "T", "S", "R") |
    Where-Object { $usedLetters -notcontains $_ } |
    Select-Object -First 1
  if ($null -eq $driveLetter) { throw "no isolated drive letter is available" }
  $driveRoot = "${driveLetter}:\"

  Invoke-Diskpart @(
    "create vdisk file=`"$vhdPath`" maximum=64 type=expandable",
    "select vdisk file=`"$vhdPath`"",
    "attach vdisk",
    "create partition primary",
    "format fs=ntfs label=`"FitFreedAdmission`" quick",
    "assign letter=$driveLetter"
  )
  Wait-ForDrive $true

  $volume = Get-Volume -DriveLetter $driveLetter
  if ($volume.FileSystem -ne "NTFS") { throw "isolated volume is not NTFS" }
  if ($volume.Size -lt 48MB -or $volume.Size -gt 80MB) {
    throw "isolated NTFS volume is outside the admitted capacity boundary"
  }
  New-Item -ItemType File -Path (Join-Path $driveRoot ".fitfreed-isolated-filesystem") | Out-Null

  $env:FITFREED_WINDOWS_FILESYSTEM_TEST_ROOT = $driveRoot
  if ([String]::IsNullOrWhiteSpace($env:CARGO_BUILD_JOBS)) { $env:CARGO_BUILD_JOBS = "8" }
  & cargo.exe test `
    --manifest-path (Join-Path $repositoryRoot "src-tauri/Cargo.toml") `
    --release `
    --lib `
    infrastructure::tests::recovers_from_windows_disk_exhaustion_without_losing_committed_history `
    -- `
    --ignored `
    --exact
  if ($LASTEXITCODE -ne 0) { throw "Windows disk-exhaustion recovery test failed" }
} finally {
  Remove-Item Env:FITFREED_WINDOWS_FILESYSTEM_TEST_ROOT -ErrorAction SilentlyContinue
  if ($null -ne $driveRoot -and (Test-Path -LiteralPath $vhdPath)) {
    Invoke-Diskpart @(
      "select vdisk file=`"$vhdPath`"",
      "detach vdisk"
    )
    Wait-ForDrive $false
  }
  Assert-OwnedWorkingDirectory
  if (Test-Path -LiteralPath $workingDirectory) {
    Remove-Item -LiteralPath $workingDirectory -Recurse -Force
  }
}

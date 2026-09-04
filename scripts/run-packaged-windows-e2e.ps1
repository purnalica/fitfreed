param(
  [Parameter(Mandatory = $true)][ValidateSet("preflight", "install", "remove")][string]$Action,
  [Parameter(Mandatory = $true)][string]$PackagePath,
  [Parameter(Mandatory = $true)][string]$ExpectedVersion,
  [Parameter(Mandatory = $true)][string]$ExpectedProductName,
  [Parameter(Mandatory = $true)][string]$ExpectedExecutable,
  [Parameter(Mandatory = $true)][string]$ExpectedIdentifier
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Assert-Equal([object]$Actual, [object]$Expected, [string]$Message) {
  if ($Actual -ne $Expected) { throw $Message }
}

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

Assert-Equal $ExpectedProductName "fitfreed-e2e" "test package product identity differs"
Assert-Equal $ExpectedExecutable "fitfreed-e2e.exe" "test package executable identity differs"
Assert-Equal $ExpectedIdentifier "org.fitfreed.desktop.e2e" "test package application identity differs"

$installDirectory = Join-Path $env:LOCALAPPDATA $ExpectedProductName
$registryPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$ExpectedProductName"
$startMenuShortcut = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$ExpectedProductName.lnk"
$desktopDirectory = [Environment]::GetFolderPath([Environment+SpecialFolder]::Desktop)
$desktopShortcut = Join-Path $desktopDirectory "$ExpectedProductName.lnk"
$executablePath = Join-Path $installDirectory $ExpectedExecutable
$uninstallerPath = Join-Path $installDirectory "uninstall.exe"
$roamingDataDirectory = Join-Path $env:APPDATA $ExpectedIdentifier
$localDataDirectory = Join-Path $env:LOCALAPPDATA $ExpectedIdentifier
$sentinelPath = Join-Path $roamingDataDirectory "package-removal-sentinel"
$sentinel = "isolated-package-removal-must-preserve-application-data"

function Assert-PackageAbsent {
  Assert-True (-not (Test-Path -LiteralPath $installDirectory)) "isolated installation directory already exists"
  Assert-True (-not (Test-Path -LiteralPath $registryPath)) "isolated package registration already exists"
  Assert-True (-not (Test-Path -LiteralPath $startMenuShortcut)) "isolated Start Menu shortcut already exists"
  Assert-True (-not (Test-Path -LiteralPath $desktopShortcut)) "isolated desktop shortcut already exists"
  Assert-True (-not (Test-Path -LiteralPath $roamingDataDirectory)) "isolated roaming application data already exists"
  Assert-True (-not (Test-Path -LiteralPath $localDataDirectory)) "isolated local application data already exists"
}

function Wait-UntilRemoved {
  for ($attempt = 0; $attempt -lt 300; $attempt += 1) {
    if (
      -not (Test-Path -LiteralPath $installDirectory) -and
      -not (Test-Path -LiteralPath $registryPath) -and
      -not (Test-Path -LiteralPath $startMenuShortcut) -and
      -not (Test-Path -LiteralPath $desktopShortcut)
    ) { return }
    Start-Sleep -Milliseconds 100
  }
  throw "isolated package-owned state remains after removal"
}

function Remove-IsolatedApplicationData([string]$Directory) {
  if (-not (Test-Path -LiteralPath $Directory)) { return }
  $reparsePoints = @(Get-ChildItem -LiteralPath $Directory -Recurse -Force |
    Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 })
  Assert-Equal $reparsePoints.Count 0 "isolated application data contains a reparse point"
  Remove-Item -LiteralPath $Directory -Recurse -Force
  Assert-True (-not (Test-Path -LiteralPath $Directory)) "isolated application data remains after cleanup"
}

if ($Action -eq "preflight") {
  Assert-True (Test-Path -LiteralPath $PackagePath -PathType Leaf) "isolated setup is absent"
  Assert-PackageAbsent
  exit 0
}

if ($Action -eq "install") {
  Assert-True (Test-Path -LiteralPath $PackagePath -PathType Leaf) "isolated setup is absent"
  Assert-PackageAbsent
  New-Item -ItemType Directory -Path $roamingDataDirectory | Out-Null
  [IO.File]::WriteAllText($sentinelPath, $sentinel, [Text.Encoding]::ASCII)

  $installer = Start-Process -FilePath $PackagePath -ArgumentList "/S" -Wait -PassThru
  Assert-Equal $installer.ExitCode 0 "isolated setup returned a failure"
  Assert-True (Test-Path -LiteralPath $registryPath) "isolated package registration is absent"
  Assert-True (Test-Path -LiteralPath $executablePath -PathType Leaf) "isolated executable is absent"
  Assert-True (Test-Path -LiteralPath $uninstallerPath -PathType Leaf) "isolated uninstaller is absent"
  Assert-True (Test-Path -LiteralPath $startMenuShortcut -PathType Leaf) "isolated Start Menu shortcut is absent"
  Assert-True (Test-Path -LiteralPath $desktopShortcut -PathType Leaf) "isolated desktop shortcut is absent"

  $registration = Get-ItemProperty -LiteralPath $registryPath
  Assert-Equal $registration.DisplayName $ExpectedProductName "isolated registered name differs"
  Assert-Equal $registration.DisplayVersion $ExpectedVersion "isolated registered version differs"
  Assert-Equal $registration.MainBinaryName $ExpectedExecutable "isolated registered executable differs"
  Assert-Equal $registration.InstallLocation.Trim('"') $installDirectory "isolated install directory differs"
  Assert-Equal $registration.UninstallString.Trim('"') $uninstallerPath "isolated uninstaller differs"

  $executableVersion = (Get-Item -LiteralPath $executablePath).VersionInfo
  Assert-Equal $executableVersion.ProductName $ExpectedProductName "isolated executable product name differs"
  Assert-Equal $executableVersion.FileVersion $ExpectedVersion "isolated executable version differs"
  Assert-Equal (Get-AuthenticodeSignature -FilePath $executablePath).Status.ToString() "NotSigned" "isolated executable must be unsigned"
  exit 0
}

if (Test-Path -LiteralPath $uninstallerPath -PathType Leaf) {
  $uninstaller = Start-Process -FilePath $uninstallerPath -ArgumentList "/S" -Wait -PassThru
  Assert-Equal $uninstaller.ExitCode 0 "isolated uninstaller returned a failure"
}
Wait-UntilRemoved
Assert-True (Test-Path -LiteralPath $sentinelPath -PathType Leaf) "package removal deleted isolated application data"
Assert-Equal (Get-Content -LiteralPath $sentinelPath -Raw) $sentinel "isolated application data changed"
Remove-IsolatedApplicationData $roamingDataDirectory
Remove-IsolatedApplicationData $localDataDirectory

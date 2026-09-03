param(
  [Parameter(Mandatory = $true)][string]$PackagePath,
  [Parameter(Mandatory = $true)][string]$ExpectedVersion,
  [Parameter(Mandatory = $true)][string]$ExpectedProductName,
  [Parameter(Mandatory = $true)][string]$ExpectedPublisher,
  [Parameter(Mandatory = $true)][string]$ExpectedHomepage,
  [Parameter(Mandatory = $true)][string]$ExpectedExecutable,
  [Parameter(Mandatory = $true)][string]$ExpectedIdentifier
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$phase = "precondition"
$installDirectory = Join-Path $env:LOCALAPPDATA $ExpectedProductName
$registryRelativePath = "Software\Microsoft\Windows\CurrentVersion\Uninstall\$ExpectedProductName"
$registryPath = "HKCU:\$registryRelativePath"
$startMenuShortcut = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$ExpectedProductName.lnk"
$desktopDirectory = [Environment]::GetFolderPath([Environment+SpecialFolder]::Desktop)
$desktopShortcut = Join-Path $desktopDirectory "$ExpectedProductName.lnk"
$executablePath = Join-Path $installDirectory $ExpectedExecutable
$uninstallerPath = Join-Path $installDirectory "uninstall.exe"
$applicationDataDirectory = Join-Path $env:APPDATA $ExpectedIdentifier
$sentinelPath = Join-Path $applicationDataDirectory "package-removal-sentinel"
$sentinel = "package-removal-must-preserve-application-data"
$installationStarted = $false

function Assert-Equal([object]$Actual, [object]$Expected, [string]$Message) {
  if ($Actual -ne $Expected) { throw $Message }
}

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function Get-SignatureStatus([string]$Path) {
  return (Get-AuthenticodeSignature -FilePath $Path).Status.ToString()
}

function Get-ShortcutTarget([string]$Path) {
  $shell = New-Object -ComObject WScript.Shell
  try {
    return $shell.CreateShortcut($Path).TargetPath
  } finally {
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
  }
}

function Wait-UntilRemoved([string[]]$Paths, [string]$RegistryLocation) {
  for ($attempt = 0; $attempt -lt 300; $attempt += 1) {
    $remainingPath = @($Paths | Where-Object { Test-Path -LiteralPath $_ })
    if ($remainingPath.Count -eq 0 -and -not (Test-Path -LiteralPath $RegistryLocation)) { return }
    Start-Sleep -Milliseconds 100
  }
  throw "package-owned state remains after removal"
}

function Find-WebView2Version {
  $locations = @(
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
  )
  foreach ($location in $locations) {
    if (Test-Path -LiteralPath $location) {
      $properties = Get-ItemProperty -LiteralPath $location -Name "pv" -ErrorAction SilentlyContinue
      if ($null -ne $properties -and -not [string]::IsNullOrWhiteSpace($properties.pv)) {
        return $properties.pv
      }
    }
  }
  return $null
}

try {
  Assert-True (Test-Path -LiteralPath $PackagePath -PathType Leaf) "setup is absent"
  Assert-True (-not (Test-Path -LiteralPath $installDirectory)) "installation directory already exists"
  Assert-True (-not (Test-Path -LiteralPath $registryPath)) "registration already exists"
  Assert-True (-not (Test-Path -LiteralPath $applicationDataDirectory)) "application data already exists"
  Assert-True (-not (Test-Path -LiteralPath $startMenuShortcut)) "Start Menu shortcut already exists"
  Assert-True (-not (Test-Path -LiteralPath $desktopShortcut)) "desktop shortcut already exists"
  Assert-Equal (Get-SignatureStatus $PackagePath) "NotSigned" "ordinary setup must be unsigned"

  New-Item -ItemType Directory -Path $applicationDataDirectory | Out-Null
  [IO.File]::WriteAllText($sentinelPath, $sentinel, [Text.Encoding]::ASCII)

  $phase = "installation"
  $installationStarted = $true
  $installer = Start-Process -FilePath $PackagePath -ArgumentList "/S" -Wait -PassThru
  Assert-Equal $installer.ExitCode 0 "setup returned a failure"

  $phase = "registry-identity"
  Assert-True (Test-Path -LiteralPath $registryPath) "Add or Remove Programs registration is absent"
  $registration = Get-ItemProperty -LiteralPath $registryPath
  Assert-Equal $registration.DisplayName $ExpectedProductName "registered display name differs"
  Assert-Equal $registration.DisplayVersion $ExpectedVersion "registered version differs"
  Assert-Equal $registration.Publisher $ExpectedPublisher "registered publisher differs"
  Assert-Equal $registration.URLInfoAbout $ExpectedHomepage "registered homepage differs"
  Assert-Equal $registration.URLUpdateInfo $ExpectedHomepage "registered update page differs"
  Assert-Equal $registration.HelpLink $ExpectedHomepage "registered help page differs"
  Assert-Equal $registration.NoModify 1 "registered modification policy differs"
  Assert-Equal $registration.NoRepair 1 "registered repair policy differs"
  Assert-Equal $registration.MainBinaryName $ExpectedExecutable "registered executable differs"
  Assert-Equal $registration.InstallLocation.Trim('"') $installDirectory "registered install directory differs"
  Assert-Equal $registration.UninstallString.Trim('"') $uninstallerPath "registered uninstaller differs"

  $phase = "installed-files"
  Assert-True (Test-Path -LiteralPath $executablePath -PathType Leaf) "installed executable is absent"
  Assert-True (Test-Path -LiteralPath $uninstallerPath -PathType Leaf) "installed uninstaller is absent"
  $executableVersion = (Get-Item -LiteralPath $executablePath).VersionInfo
  Assert-Equal $executableVersion.ProductName $ExpectedProductName "executable product name differs"
  Assert-Equal $executableVersion.FileDescription $ExpectedProductName "executable description differs"
  Assert-Equal $executableVersion.FileVersion $ExpectedVersion "executable file version differs"
  Assert-Equal $executableVersion.ProductVersion $ExpectedVersion "executable product version differs"
  $executableSignatureStatus = Get-SignatureStatus $executablePath
  $uninstallerSignatureStatus = Get-SignatureStatus $uninstallerPath
  Assert-Equal $executableSignatureStatus "NotSigned" "ordinary executable must be unsigned"
  Assert-Equal $uninstallerSignatureStatus "NotSigned" "ordinary uninstaller must be unsigned"
  $unsupportedInstalledEntries = @(Get-ChildItem -LiteralPath $installDirectory -Recurse -Force |
    Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 })
  Assert-Equal $unsupportedInstalledEntries.Count 0 "installed package contains a reparse point"
  $installedEntries = @(Get-ChildItem -LiteralPath $installDirectory -Recurse -File -Force |
    ForEach-Object {
      $relativePath = $_.FullName.Substring($installDirectory.Length + 1).Replace("\", "/")
      [ordered]@{
        sortKey = [BitConverter]::ToString([Text.Encoding]::UTF8.GetBytes($relativePath)).Replace("-", "")
        entry = [ordered]@{
          path = $relativePath
          size = $_.Length
          sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
      }
    } | Sort-Object -Property sortKey | ForEach-Object { $_.entry })

  $phase = "shortcuts"
  Assert-True (Test-Path -LiteralPath $startMenuShortcut -PathType Leaf) "Start Menu shortcut is absent"
  Assert-True (Test-Path -LiteralPath $desktopShortcut -PathType Leaf) "desktop shortcut is absent"
  Assert-Equal (Get-ShortcutTarget $startMenuShortcut) $executablePath "Start Menu target differs"
  Assert-Equal (Get-ShortcutTarget $desktopShortcut) $executablePath "desktop target differs"

  $phase = "webview-runtime"
  $webView2Version = Find-WebView2Version
  Assert-True (-not [string]::IsNullOrWhiteSpace($webView2Version)) "WebView2 is unavailable"

  $phase = "removal"
  $uninstaller = Start-Process -FilePath $uninstallerPath -ArgumentList "/S" -Wait -PassThru
  Assert-Equal $uninstaller.ExitCode 0 "uninstaller returned a failure"
  Wait-UntilRemoved @($installDirectory, $startMenuShortcut, $desktopShortcut) $registryPath
  $installationStarted = $false

  $phase = "application-data-preservation"
  Assert-True (Test-Path -LiteralPath $sentinelPath -PathType Leaf) "application data was removed"
  Assert-Equal (Get-Content -LiteralPath $sentinelPath -Raw) $sentinel "application data changed"

  $evidence = [ordered]@{
    schemaVersion = 1
    platform = "windows"
    architecture = "x86_64"
    packageFormat = "nsis"
    installMode = "currentUser"
    package = [ordered]@{
      productName = $ExpectedProductName
      version = $ExpectedVersion
      fileDescription = (Get-Item -LiteralPath $PackagePath).VersionInfo.FileDescription
      fileVersion = (Get-Item -LiteralPath $PackagePath).VersionInfo.FileVersion
      productVersion = (Get-Item -LiteralPath $PackagePath).VersionInfo.ProductVersion
      signatureStatus = Get-SignatureStatus $PackagePath
    }
    installation = [ordered]@{
      applicationDataDirectory = "%APPDATA%\$ExpectedIdentifier"
      publisher = $ExpectedPublisher
      homepage = $ExpectedHomepage
      installDirectory = "%LOCALAPPDATA%\$ExpectedProductName"
      executable = $ExpectedExecutable
      uninstaller = "uninstall.exe"
      uninstallRegistry = "HKCU\$registryRelativePath"
      startMenuShortcut = "%APPDATA%\Microsoft\Windows\Start Menu\Programs\$ExpectedProductName.lnk"
      desktopShortcut = "%USERPROFILE%\Desktop\$ExpectedProductName.lnk"
      executableSignatureStatus = $executableSignatureStatus
      uninstallerSignatureStatus = $uninstallerSignatureStatus
      installedEntries = $installedEntries
      webview2Available = $true
    }
    removal = [ordered]@{
      packageFilesRemoved = -not (Test-Path -LiteralPath $installDirectory)
      registrationRemoved = -not (Test-Path -LiteralPath $registryPath)
      shortcutsRemoved = -not (Test-Path -LiteralPath $startMenuShortcut) -and -not (Test-Path -LiteralPath $desktopShortcut)
      applicationDataPreserved = Test-Path -LiteralPath $sentinelPath -PathType Leaf
    }
  }
  $evidence | ConvertTo-Json -Depth 5 -Compress
} catch {
  [Console]::Error.WriteLine("FITFREED_PHASE=$phase")
  exit 1
} finally {
  if ($installationStarted -and (Test-Path -LiteralPath $uninstallerPath -PathType Leaf)) {
    try {
      $cleanup = Start-Process -FilePath $uninstallerPath -ArgumentList "/S" -Wait -PassThru
      Wait-UntilRemoved @($installDirectory, $startMenuShortcut, $desktopShortcut) $registryPath
    } catch {
      [Console]::Error.WriteLine("FITFREED_CLEANUP=incomplete")
    }
  }
  if (Test-Path -LiteralPath $sentinelPath -PathType Leaf) {
    Remove-Item -LiteralPath $sentinelPath -Force
  }
  if (Test-Path -LiteralPath $applicationDataDirectory -PathType Container) {
    $remaining = @(Get-ChildItem -LiteralPath $applicationDataDirectory -Force)
    if ($remaining.Count -eq 0) { Remove-Item -LiteralPath $applicationDataDirectory }
  }
}

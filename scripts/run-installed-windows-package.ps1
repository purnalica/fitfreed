param(
  [Parameter(Mandatory = $true)][ValidateSet("preflight", "install", "query", "remove", "reset-data", "verify-data")][string]$Action,
  [string]$PackagePath = "",
  [string]$ExpectedVersion = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$productName = "FitFreed"
$publisher = "FitFreed contributors"
$homepage = "https://fitfreed.org/"
$executableName = "fitfreed.exe"
$identifier = "org.fitfreed.desktop"
$roamingRoot = [Environment]::GetFolderPath([Environment+SpecialFolder]::ApplicationData)
$localRoot = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
if ([String]::IsNullOrWhiteSpace($roamingRoot)) { throw "current-user roaming data root is unavailable" }
if ([String]::IsNullOrWhiteSpace($localRoot)) { throw "current-user local data root is unavailable" }
$installDirectory = Join-Path $localRoot $productName
$executablePath = Join-Path $installDirectory $executableName
$uninstallerPath = Join-Path $installDirectory "uninstall.exe"
$registryPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\FitFreed"
$startMenuShortcut = Join-Path $roamingRoot "Microsoft\Windows\Start Menu\Programs\FitFreed.lnk"
$desktopShortcut = Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::Desktop)) "FitFreed.lnk"
$roamingDataDirectory = Join-Path $roamingRoot $identifier
$localDataDirectory = Join-Path $localRoot $identifier

function Assert-Equal([object]$Actual, [object]$Expected, [string]$Message) {
  if ($Actual -ne $Expected) { throw $Message }
}

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function Assert-ProductionStateAbsent {
  Assert-True (-not (Test-Path -LiteralPath $installDirectory)) "FitFreed installation already exists"
  Assert-True (-not (Test-Path -LiteralPath $registryPath)) "FitFreed registration already exists"
  Assert-True (-not (Test-Path -LiteralPath $startMenuShortcut)) "FitFreed Start Menu shortcut already exists"
  Assert-True (-not (Test-Path -LiteralPath $desktopShortcut)) "FitFreed desktop shortcut already exists"
  Assert-True (-not (Test-Path -LiteralPath $roamingDataDirectory)) "FitFreed roaming data already exists"
  Assert-True (-not (Test-Path -LiteralPath $localDataDirectory)) "FitFreed local data already exists"
}

function Get-InstalledVersion {
  Assert-True (Test-Path -LiteralPath $registryPath) "FitFreed registration is absent"
  Assert-True (Test-Path -LiteralPath $executablePath -PathType Leaf) "FitFreed executable is absent"
  Assert-True (Test-Path -LiteralPath $uninstallerPath -PathType Leaf) "FitFreed uninstaller is absent"
  $registration = Get-ItemProperty -LiteralPath $registryPath
  Assert-Equal $registration.DisplayName $productName "registered product name differs"
  Assert-Equal $registration.Publisher $publisher "registered publisher differs"
  Assert-Equal $registration.URLInfoAbout $homepage "registered homepage differs"
  Assert-Equal $registration.MainBinaryName $executableName "registered executable differs"
  Assert-Equal $registration.InstallLocation.Trim('"') $installDirectory "registered install directory differs"
  Assert-Equal $registration.UninstallString.Trim('"') $uninstallerPath "registered uninstaller differs"
  $version = [string]$registration.DisplayVersion
  Assert-True ($version -match '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$') "registered version is invalid"
  $binary = (Get-Item -LiteralPath $executablePath).VersionInfo
  Assert-Equal $binary.ProductName $productName "installed product name differs"
  Assert-Equal $binary.FileVersion $version "installed file version differs"
  Assert-Equal $binary.ProductVersion $version "installed product version differs"
  return $version
}

function Stop-OwnedProcesses {
  $installed = [IO.Path]::GetFullPath($executablePath)
  $recoveryPrefix = [IO.Path]::GetFullPath((Join-Path $roamingDataDirectory "update-recovery\attempts")) + "\"
  $comparer = [StringComparer]::OrdinalIgnoreCase
  $processes = @(Get-CimInstance Win32_Process | Where-Object {
    if ($null -eq $_.ExecutablePath) { return $false }
    $candidate = [IO.Path]::GetFullPath($_.ExecutablePath)
    return $comparer.Equals($candidate, $installed) -or (
      $candidate.StartsWith($recoveryPrefix, [StringComparison]::OrdinalIgnoreCase) -and
      $candidate.EndsWith("\previous\runnable\fitfreed.exe", [StringComparison]::OrdinalIgnoreCase)
    )
  })
  foreach ($process in $processes) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
  for ($attempt = 0; $attempt -lt 100; $attempt += 1) {
    $remaining = @(Get-CimInstance Win32_Process | Where-Object {
      if ($null -eq $_.ExecutablePath) { return $false }
      $candidate = [IO.Path]::GetFullPath($_.ExecutablePath)
      return $comparer.Equals($candidate, $installed) -or (
        $candidate.StartsWith($recoveryPrefix, [StringComparison]::OrdinalIgnoreCase) -and
        $candidate.EndsWith("\previous\runnable\fitfreed.exe", [StringComparison]::OrdinalIgnoreCase)
      )
    })
    if ($remaining.Count -eq 0) { return }
    Start-Sleep -Milliseconds 100
  }
  throw "owned FitFreed processes remain"
}

function Wait-UntilPackageRemoved {
  for ($attempt = 0; $attempt -lt 300; $attempt += 1) {
    if (
      -not (Test-Path -LiteralPath $installDirectory) -and
      -not (Test-Path -LiteralPath $registryPath) -and
      -not (Test-Path -LiteralPath $startMenuShortcut) -and
      -not (Test-Path -LiteralPath $desktopShortcut)
    ) { return }
    Start-Sleep -Milliseconds 100
  }
  throw "FitFreed package-owned state remains after removal"
}

function Remove-OwnedData([string]$Directory) {
  if (-not (Test-Path -LiteralPath $Directory)) { return }
  $root = Get-Item -LiteralPath $Directory -Force
  Assert-True (($root.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) "application data root is a reparse point"
  $reparsePoints = @(Get-ChildItem -LiteralPath $Directory -Recurse -Force |
    Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 })
  Assert-Equal $reparsePoints.Count 0 "application data contains a reparse point"
  Remove-Item -LiteralPath $Directory -Recurse -Force
  Assert-True (-not (Test-Path -LiteralPath $Directory)) "application data remains after cleanup"
}

function Assert-PrivateAcl([string]$Path, [bool]$Directory) {
  $item = Get-Item -LiteralPath $Path -Force
  Assert-True (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) "private data is a reparse point"
  $acl = Get-Acl -LiteralPath $Path
  $currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $ownerSid = (([Security.Principal.NTAccount]$acl.Owner).Translate(
      [Security.Principal.SecurityIdentifier]
    )).Value
  Assert-Equal $ownerSid $currentSid "private data owner differs"
  Assert-True $acl.AreAccessRulesProtected "private data ACL inherits external entries"
  $rules = @($acl.GetAccessRules(
    $true,
    $false,
    [Security.Principal.SecurityIdentifier]
  ))
  Assert-Equal $rules.Count 3 "private data ACL entry count differs"
  $expectedSids = @(
    $currentSid,
    ([Security.Principal.SecurityIdentifier]::new(
        [Security.Principal.WellKnownSidType]::LocalSystemSid,
        $null
      )).Value,
    ([Security.Principal.SecurityIdentifier]::new(
        [Security.Principal.WellKnownSidType]::BuiltinAdministratorsSid,
        $null
      )).Value
  )
  $seen = @{}
  foreach ($rule in $rules) {
    Assert-Equal $rule.AccessControlType ([Security.AccessControl.AccessControlType]::Allow) "private data ACL contains a deny entry"
    Assert-Equal ([int]$rule.FileSystemRights) ([int][Security.AccessControl.FileSystemRights]::FullControl) "private data ACL is not full control"
    Assert-True ($expectedSids -contains $rule.IdentityReference.Value) "private data ACL contains an unexpected identity"
    Assert-True (-not $seen.ContainsKey($rule.IdentityReference.Value)) "private data ACL contains a duplicate identity"
    $seen[$rule.IdentityReference.Value] = $true
    if ($Directory) {
      $expectedInheritance = [Security.AccessControl.InheritanceFlags](
        [int][Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
        [int][Security.AccessControl.InheritanceFlags]::ObjectInherit
      )
      Assert-Equal $rule.InheritanceFlags $expectedInheritance "private directory ACL inheritance differs"
    } else {
      Assert-Equal $rule.InheritanceFlags ([Security.AccessControl.InheritanceFlags]::None) "private file ACL inheritance differs"
    }
    Assert-Equal $rule.PropagationFlags ([Security.AccessControl.PropagationFlags]::None) "private data ACL propagation differs"
  }
}

if ($Action -eq "preflight") {
  Assert-ProductionStateAbsent
  exit 0
}

if ($Action -eq "install") {
  Assert-True ($ExpectedVersion -match '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$') "expected version is invalid"
  Assert-True (Test-Path -LiteralPath $PackagePath -PathType Leaf) "setup is absent"
  Assert-Equal (Split-Path -Leaf $PackagePath) "FitFreed_${ExpectedVersion}_x64-setup.exe" "setup name differs"
  Assert-ProductionStateAbsent
  $installer = Start-Process -FilePath $PackagePath -ArgumentList "/S" -Wait -PassThru
  Assert-Equal $installer.ExitCode 0 "setup returned a failure"
  Assert-Equal (Get-InstalledVersion) $ExpectedVersion "installed version differs"
  exit 0
}

if ($Action -eq "query") {
  [Console]::Out.WriteLine((Get-InstalledVersion))
  exit 0
}

if ($Action -eq "verify-data") {
  Get-InstalledVersion | Out-Null
  Stop-OwnedProcesses
  $library = Join-Path $roamingDataDirectory "fitfreed.sqlite"
  Assert-True (Test-Path -LiteralPath $roamingDataDirectory -PathType Container) "roaming application data is absent"
  Assert-True (Test-Path -LiteralPath $library -PathType Leaf) "installed application library is absent"
  Assert-True ((Get-Item -LiteralPath $library).Length -gt 0) "installed application library is empty"
  $reparsePoints = @(Get-ChildItem -LiteralPath $roamingDataDirectory -Recurse -Force |
    Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 })
  Assert-Equal $reparsePoints.Count 0 "roaming application data contains a reparse point"
  Assert-PrivateAcl $roamingDataDirectory $true
  Assert-PrivateAcl $library $false
  exit 0
}

if ($Action -eq "reset-data") {
  Get-InstalledVersion | Out-Null
  Stop-OwnedProcesses
  Remove-OwnedData $roamingDataDirectory
  Remove-OwnedData $localDataDirectory
  exit 0
}

Stop-OwnedProcesses
if (Test-Path -LiteralPath $uninstallerPath -PathType Leaf) {
  $uninstaller = Start-Process -FilePath $uninstallerPath -ArgumentList "/S" -Wait -PassThru
  Assert-Equal $uninstaller.ExitCode 0 "FitFreed uninstaller returned a failure"
}
Wait-UntilPackageRemoved
Remove-OwnedData $roamingDataDirectory
Remove-OwnedData $localDataDirectory

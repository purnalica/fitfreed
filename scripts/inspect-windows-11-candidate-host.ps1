Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

$currentVersion = Get-ItemProperty -LiteralPath "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion"
$operatingSystem = Get-CimInstance -ClassName Win32_OperatingSystem
$kitsRoot = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin"
Assert-True (Test-Path -LiteralPath $kitsRoot -PathType Container) "Windows SDK tools are absent"
$signTools = @(Get-ChildItem -Path (Join-Path $kitsRoot "*\x64\signtool.exe") -File |
  Sort-Object -Property FullName -Descending)
Assert-True ($signTools.Count -gt 0) "SignTool is absent"

[ordered]@{
  schemaVersion = 1
  processorArchitecture = [Environment]::GetEnvironmentVariable("PROCESSOR_ARCHITECTURE", "Process")
  installationType = [string]$currentVersion.InstallationType
  productType = [int]$operatingSystem.ProductType
  displayVersion = [string]$currentVersion.DisplayVersion
  currentBuildNumber = [int]$currentVersion.CurrentBuildNumber
  updateBuildRevision = [int]$currentVersion.UBR
  editionId = [string]$currentVersion.EditionID
  signToolPath = $signTools[0].FullName
} | ConvertTo-Json -Compress

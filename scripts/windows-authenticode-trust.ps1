param(
  [Parameter(Mandatory = $true)][string]$BinaryPath,
  [Parameter(Mandatory = $true)][string]$SignToolPath,
  [Parameter(Mandatory = $true)][string]$ExpectedCertificateSha256,
  [string]$ExpectedVersion,
  [switch]$RequireTimestamp,
  [switch]$SignatureOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$phase = "precondition"

function Assert-Equal([object]$Actual, [object]$Expected, [string]$Message) {
  if ($Actual -ne $Expected) { throw $Message }
}

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function Get-CertificateSha256([Security.Cryptography.X509Certificates.X509Certificate2]$Certificate) {
  $hasher = [Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($hasher.ComputeHash($Certificate.RawData))).Replace("-", "").ToLowerInvariant()
  } finally {
    $hasher.Dispose()
  }
}

function Get-PeArchitecture([string]$Path) {
  $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
  $reader = New-Object IO.BinaryReader($stream)
  try {
    Assert-True ($stream.Length -ge 64) "binary is too short for a PE header"
    Assert-Equal $reader.ReadUInt16() 0x5A4D "binary has no DOS header"
    $stream.Position = 0x3C
    $peOffset = $reader.ReadInt32()
    Assert-True ($peOffset -ge 64 -and $peOffset -le ($stream.Length - 6)) "binary has an invalid PE offset"
    $stream.Position = $peOffset
    Assert-Equal $reader.ReadUInt32() 0x00004550 "binary has no PE signature"
    Assert-Equal $reader.ReadUInt16() 0x8664 "binary is not x86-64"
    return "x86_64"
  } finally {
    $reader.Dispose()
    $stream.Dispose()
  }
}

try {
  Assert-True (Test-Path -LiteralPath $BinaryPath -PathType Leaf) "binary is absent"
  Assert-True (Test-Path -LiteralPath $SignToolPath -PathType Leaf) "SignTool is absent"
  Assert-True ($ExpectedCertificateSha256 -match "^[0-9a-f]{64}$") "certificate fingerprint is invalid"
  if (-not $SignatureOnly) {
    Assert-True ($ExpectedVersion -match "^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$") "version is invalid"
  }
  $fileSha256Before = (Get-FileHash -LiteralPath $BinaryPath -Algorithm SHA256).Hash.ToLowerInvariant()

  $phase = "signtool-verification"
  $verifyArguments = @("verify", "/pa", "/all")
  if ($RequireTimestamp) { $verifyArguments += "/tw" }
  $verifyArguments += $BinaryPath
  $verificationOutput = & $SignToolPath @verifyArguments 2>&1
  Assert-Equal $LASTEXITCODE 0 "SignTool did not accept the signature"

  $phase = "signature-inspection"
  $signature = Get-AuthenticodeSignature -FilePath $BinaryPath
  Assert-Equal $signature.Status.ToString() "Valid" "Windows did not accept the signature"
  Assert-True ($null -ne $signature.SignerCertificate) "signer certificate is absent"
  $certificateSha256 = Get-CertificateSha256 $signature.SignerCertificate
  Assert-Equal $certificateSha256 $ExpectedCertificateSha256 "signer certificate differs"
  $timestamped = $null -ne $signature.TimeStamperCertificate
  if ($RequireTimestamp) { Assert-True $timestamped "RFC 3161 timestamp is absent" }
  $fileSha256After = (Get-FileHash -LiteralPath $BinaryPath -Algorithm SHA256).Hash.ToLowerInvariant()
  Assert-Equal $fileSha256After $fileSha256Before "trust inspection changed the binary"

  if (-not $SignatureOnly) {
    $phase = "binary-identity"
    $version = (Get-Item -LiteralPath $BinaryPath).VersionInfo
    $architecture = Get-PeArchitecture $BinaryPath
    Assert-Equal $version.ProductName "FitFreed" "product name differs"
    Assert-Equal $version.FileDescription "FitFreed" "file description differs"
    Assert-Equal $version.FileVersion $ExpectedVersion "file version differs"
    Assert-Equal $version.ProductVersion $ExpectedVersion "product version differs"
    $evidence = [ordered]@{
      schemaVersion = 1
      status = "Valid"
      certificateSha256 = $certificateSha256
      timestamped = $timestamped
      fileSha256 = $fileSha256After
      architecture = $architecture
      productName = $version.ProductName
      fileDescription = $version.FileDescription
      fileVersion = $version.FileVersion
      productVersion = $version.ProductVersion
    }
  } else {
    $evidence = [ordered]@{
      schemaVersion = 1
      status = "Valid"
      certificateSha256 = $certificateSha256
      timestamped = $timestamped
      fileSha256 = $fileSha256After
    }
  }

  $evidence | ConvertTo-Json -Compress
} catch {
  [Console]::Error.WriteLine("FITFREED_AUTHENTICODE_PHASE=$phase")
  exit 1
}

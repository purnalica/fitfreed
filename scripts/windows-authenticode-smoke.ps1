param(
  [Parameter(Mandatory = $true)][string]$SourceBinaryPath,
  [Parameter(Mandatory = $true)][string]$ExpectedVersion
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$phase = "precondition"
$operationFailurePhase = $null
$cleanupFailed = $false
$authorityRemoved = $false
$certificateThumbprint = $null
$tempRoot = $null
$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$signScript = Join-Path $repositoryRoot "scripts\windows-authenticode-sign.mjs"
$trustScript = Join-Path $repositoryRoot "scripts\windows-authenticode-trust.ps1"
$authorityVariableNames = @(
  "FITFREED_WINDOWS_AUTHENTICODE_PROFILE",
  "FITFREED_WINDOWS_CERTIFICATE_SHA1",
  "FITFREED_WINDOWS_CERTIFICATE_SHA256",
  "FITFREED_WINDOWS_SIGNTOOL_PATH",
  "FITFREED_WINDOWS_TIMESTAMP_URL"
)
$priorAuthorityVariables = @{}

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function Get-CertificateSha256(
  [Security.Cryptography.X509Certificates.X509Certificate2]$Certificate
) {
  $hasher = [Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($hasher.ComputeHash($Certificate.RawData))).Replace("-", "").ToLowerInvariant()
  } finally {
    $hasher.Dispose()
  }
}

function Certificate-Exists([string]$StoreName, [string]$Thumbprint) {
  if ($null -eq $Thumbprint) { return $false }
  $storePath = "Cert:\CurrentUser\$StoreName\$Thumbprint"
  return Test-Path -LiteralPath $storePath
}

try {
  foreach ($name in $authorityVariableNames) {
    $priorAuthorityVariables[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
  }

  try {
    Assert-True (Test-Path -LiteralPath $SourceBinaryPath -PathType Leaf) "release executable is absent"
    Assert-True (Test-Path -LiteralPath $signScript -PathType Leaf) "signing adapter is absent"
    Assert-True (Test-Path -LiteralPath $trustScript -PathType Leaf) "trust adapter is absent"
    Assert-True ($ExpectedVersion -match "^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$") "version is invalid"
    $sourceItem = Get-Item -LiteralPath $SourceBinaryPath
    Assert-True (-not (($sourceItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) "release executable is a reparse point"
    $sourceSha256Before = (Get-FileHash -LiteralPath $SourceBinaryPath -Algorithm SHA256).Hash.ToLowerInvariant()

    $phase = "tool-discovery"
    $node = Get-Command node.exe -CommandType Application -ErrorAction Stop
    $kitsRoot = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin"
    Assert-True (Test-Path -LiteralPath $kitsRoot -PathType Container) "Windows SDK tools are absent"
    $signTool = Get-ChildItem -Path (Join-Path $kitsRoot "*\x64\signtool.exe") -File |
      Sort-Object -Property FullName -Descending |
      Select-Object -First 1
    Assert-True ($null -ne $signTool) "SignTool is absent"

    $phase = "authority-preparation"
    $tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("fitfreed-authenticode-smoke-" + [Guid]::NewGuid().ToString("N"))
    $null = New-Item -ItemType Directory -Path $tempRoot
    $copyPath = Join-Path $tempRoot "fitfreed.exe"
    Copy-Item -LiteralPath $SourceBinaryPath -Destination $copyPath
    $certificate = New-SelfSignedCertificate `
      -Type CodeSigningCert `
      -Subject ("CN=FitFreed Synthetic Authenticode Test " + [Guid]::NewGuid().ToString("N")) `
      -CertStoreLocation "Cert:\CurrentUser\My" `
      -KeyAlgorithm RSA `
      -KeyLength 2048 `
      -HashAlgorithm SHA256 `
      -KeyExportPolicy NonExportable `
      -NotAfter (Get-Date).AddHours(1)
    $certificateThumbprint = $certificate.Thumbprint
    $certificateSha256 = Get-CertificateSha256 $certificate
    $publicCertificatePath = Join-Path $tempRoot "authority.cer"
    $null = Export-Certificate -Cert $certificate -FilePath $publicCertificatePath -Type CERT
    $null = Import-Certificate -FilePath $publicCertificatePath -CertStoreLocation "Cert:\CurrentUser\Root"
    $null = Import-Certificate -FilePath $publicCertificatePath -CertStoreLocation "Cert:\CurrentUser\TrustedPublisher"

    $env:FITFREED_WINDOWS_AUTHENTICODE_PROFILE = "synthetic-test"
    $env:FITFREED_WINDOWS_CERTIFICATE_SHA1 = $certificateThumbprint
    $env:FITFREED_WINDOWS_CERTIFICATE_SHA256 = $certificateSha256
    $env:FITFREED_WINDOWS_SIGNTOOL_PATH = $signTool.FullName
    [Environment]::SetEnvironmentVariable("FITFREED_WINDOWS_TIMESTAMP_URL", $null, "Process")

    $phase = "signing"
    $signingOutput = & $node.Source $signScript $copyPath 2>&1
    Assert-True ($LASTEXITCODE -eq 0) "synthetic signing failed"

    $phase = "trust-verification"
    $trustOutput = & powershell.exe `
      -NoLogo `
      -NoProfile `
      -NonInteractive `
      -ExecutionPolicy Bypass `
      -File $trustScript `
      -BinaryPath $copyPath `
      -SignToolPath $signTool.FullName `
      -ExpectedCertificateSha256 $certificateSha256 `
      -ExpectedVersion $ExpectedVersion 2>&1
    Assert-True ($LASTEXITCODE -eq 0) "synthetic trust verification failed"
    $trustFacts = ($trustOutput -join "`n") | ConvertFrom-Json
    Assert-True ($trustFacts.status -eq "Valid") "synthetic signature is invalid"
    Assert-True ($trustFacts.architecture -eq "x86_64") "synthetic executable architecture differs"
    Assert-True ($trustFacts.certificateSha256 -eq $certificateSha256) "synthetic signer differs"
    Assert-True ($trustFacts.timestamped -eq $false) "synthetic signature unexpectedly has a timestamp"
    $sourceSha256After = (Get-FileHash -LiteralPath $SourceBinaryPath -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-True ($sourceSha256After -eq $sourceSha256Before) "synthetic smoke changed the release executable"
  } catch {
    $operationFailurePhase = $phase
  } finally {
    $phase = "authority-cleanup"
    try {
      if ($null -ne $certificateThumbprint) {
        foreach ($storeName in @("Root", "TrustedPublisher")) {
          $certificatePath = "Cert:\CurrentUser\$storeName\$certificateThumbprint"
          if (Test-Path -LiteralPath $certificatePath) {
            Remove-Item -LiteralPath $certificatePath -Force
          }
        }
        $certificatePath = "Cert:\CurrentUser\My\$certificateThumbprint"
        if (Test-Path -LiteralPath $certificatePath) {
          Remove-Item -LiteralPath $certificatePath -Force -DeleteKey
        }
      }
      foreach ($name in $authorityVariableNames) {
        [Environment]::SetEnvironmentVariable($name, $priorAuthorityVariables[$name], "Process")
      }
      if ($null -ne $tempRoot -and (Test-Path -LiteralPath $tempRoot -PathType Container)) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
      }
      $authorityRemoved = `
        -not (Certificate-Exists "My" $certificateThumbprint) -and `
        -not (Certificate-Exists "Root" $certificateThumbprint) -and `
        -not (Certificate-Exists "TrustedPublisher" $certificateThumbprint) -and `
        ($null -eq $tempRoot -or -not (Test-Path -LiteralPath $tempRoot))
      Assert-True $authorityRemoved "synthetic authority remains"
    } catch {
      $cleanupFailed = $true
    }
  }

  if ($cleanupFailed) {
    $phase = "authority-cleanup"
    throw "synthetic authority cleanup failed"
  }
  if ($null -ne $operationFailurePhase) {
    $phase = $operationFailurePhase
    throw "synthetic Authenticode operation failed"
  }

  [ordered]@{
    schemaVersion = 1
    profile = "synthetic-test"
    architecture = "x86_64"
    signedCopyVerified = $true
    sourceUnchanged = $true
    authorityRemoved = $authorityRemoved
  } | ConvertTo-Json -Compress
} catch {
  [Console]::Error.WriteLine("FITFREED_AUTHENTICODE_SMOKE_PHASE=$phase")
  exit 1
}

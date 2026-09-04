param(
  [Parameter(Mandatory = $true)][ValidateSet("Install", "Cleanup")][string]$Operation,
  [Parameter(Mandatory = $true)][string]$StatePath,
  [string]$CertificatePath = "",
  [string]$ExpectedCertificateSha256 = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$phase = "precondition"
$importedThumbprints = @()
$removalCertificateSha256 = ""

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

function Remove-Certificate([string]$Thumbprint, [string]$ExpectedSha256) {
  Assert-True ($Thumbprint -match "^[0-9A-Fa-f]{40}$") "certificate removal selector is invalid"
  Assert-True ($ExpectedSha256 -match "^[0-9a-f]{64}$") "certificate removal fingerprint is invalid"
  $candidate = "Cert:\CurrentUser\My\$Thumbprint"
  if (Test-Path -LiteralPath $candidate) {
    $certificate = Get-Item -LiteralPath $candidate
    if ((Get-CertificateSha256 $certificate) -ne $ExpectedSha256) {
      throw "certificate removal fingerprint differs"
    }
    Remove-Item -LiteralPath $candidate -Force -DeleteKey
  }
}

function Write-Result([ordered]$Result) {
  [Console]::Out.WriteLine(($Result | ConvertTo-Json -Compress))
}

try {
  Assert-True ([IO.Path]::IsPathFullyQualified($StatePath)) "state path is not absolute"
  $stateDirectory = Split-Path -Parent $StatePath
  Assert-True (Test-Path -LiteralPath $stateDirectory -PathType Container) "state directory is absent"

  if ($Operation -eq "Install") {
    Assert-True (-not (Test-Path -LiteralPath $StatePath)) "authority state already exists"
    Assert-True ([IO.Path]::IsPathFullyQualified($CertificatePath)) "certificate path is not absolute"
    Assert-True (Test-Path -LiteralPath $CertificatePath -PathType Leaf) "certificate file is absent"
    Assert-True ($ExpectedCertificateSha256 -match "^[0-9a-f]{64}$") "certificate fingerprint is invalid"
    $certificateItem = Get-Item -LiteralPath $CertificatePath -Force
    Assert-True (($certificateItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) "certificate file is redirected"
    $passwordValue = [Environment]::GetEnvironmentVariable(
      "FITFREED_WINDOWS_CERTIFICATE_PASSWORD",
      "Process"
    )
    Assert-True (-not [String]::IsNullOrWhiteSpace($passwordValue)) "certificate password is absent"

    $phase = "certificate-validation"
    $ephemeralCertificates = [Security.Cryptography.X509Certificates.X509Certificate2Collection]::new()
    $ephemeralCertificates.Import(
      $CertificatePath,
      $passwordValue,
      [Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet
    )
    Assert-True ($ephemeralCertificates.Count -eq 1) "certificate bundle must contain exactly one certificate"
    $sourceCertificate = $ephemeralCertificates[0]
    Assert-True $sourceCertificate.HasPrivateKey "certificate has no private key"
    Assert-True ($sourceCertificate.NotBefore -le (Get-Date) -and $sourceCertificate.NotAfter -gt (Get-Date)) "certificate is outside its validity interval"
    $sourceCodeSigningUsage = @($sourceCertificate.EnhancedKeyUsageList |
      Where-Object { $_.ObjectId.Value -eq "1.3.6.1.5.5.7.3.3" })
    Assert-True ($sourceCodeSigningUsage.Count -eq 1) "certificate is not valid for code signing"
    $certificateSha256 = Get-CertificateSha256 $sourceCertificate
    Assert-True ($certificateSha256 -eq $ExpectedCertificateSha256) "certificate fingerprint differs"
    $removalCertificateSha256 = $certificateSha256
    $certificateSha1 = $sourceCertificate.Thumbprint.ToLowerInvariant()
    Assert-True ($certificateSha1 -match "^[0-9a-f]{40}$") "certificate selector is invalid"
    Assert-True (-not (Test-Path -LiteralPath "Cert:\CurrentUser\My\$certificateSha1")) "certificate already exists in the current-user store"

    $phase = "tool-discovery"
    $kitsRoot = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin"
    Assert-True (Test-Path -LiteralPath $kitsRoot -PathType Container) "Windows SDK tools are absent"
    $signTools = @(Get-ChildItem -Path (Join-Path $kitsRoot "*\x64\signtool.exe") -File |
      Sort-Object -Property FullName -Descending)
    Assert-True ($signTools.Count -gt 0) "SignTool is absent"
    $signTool = $signTools[0]

    $phase = "certificate-import"
    $password = ConvertTo-SecureString -String $passwordValue -AsPlainText -Force
    $imported = @(Import-PfxCertificate `
      -FilePath $CertificatePath `
      -CertStoreLocation "Cert:\CurrentUser\My" `
      -Password $password)
    $importedThumbprints = @($imported | ForEach-Object { $_.Thumbprint })
    Assert-True ($imported.Count -eq 1) "certificate bundle must contain exactly one certificate"
    $certificate = $imported[0]
    Assert-True $certificate.HasPrivateKey "certificate has no private key"
    Assert-True ($certificate.Thumbprint.ToLowerInvariant() -eq $certificateSha1) "imported certificate selector differs"
    Assert-True ((Get-CertificateSha256 $certificate) -eq $certificateSha256) "imported certificate fingerprint differs"
    $ephemeralCertificates.Reset()

    $phase = "state-persistence"
    [ordered]@{
      schemaVersion = 1
      certificateSha1 = $certificateSha1
      certificateSha256 = $certificateSha256
    } | ConvertTo-Json -Compress | Set-Content -LiteralPath $StatePath -Encoding utf8NoBOM

    Write-Result ([ordered]@{
      schemaVersion = 1
      operation = "installed"
      certificateSha1 = $certificateSha1
      certificateSha256 = $certificateSha256
      signToolPath = $signTool.FullName
    })
    exit 0
  }

  $phase = "state-reopening"
  Assert-True (Test-Path -LiteralPath $StatePath -PathType Leaf) "authority state is absent"
  $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
  Assert-True ($state.schemaVersion -eq 1) "authority state schema differs"
  Assert-True ($state.certificateSha1 -match "^[0-9a-f]{40}$") "authority state selector is invalid"
  Assert-True ($state.certificateSha256 -match "^[0-9a-f]{64}$") "authority state fingerprint is invalid"
  $removalCertificateSha256 = $state.certificateSha256

  $phase = "certificate-removal"
  Remove-Certificate $state.certificateSha1 $removalCertificateSha256
  Assert-True (-not (Test-Path -LiteralPath "Cert:\CurrentUser\My\$($state.certificateSha1)")) "certificate remains"
  Remove-Item -LiteralPath $StatePath -Force
  Write-Result ([ordered]@{
    schemaVersion = 1
    operation = "cleaned"
    authorityRemoved = $true
  })
} catch {
  $operationFailurePhase = $phase
  $cleanupFailed = $false
  if ($Operation -eq "Cleanup" -and $importedThumbprints.Count -eq 0 -and (Test-Path -LiteralPath $StatePath -PathType Leaf)) {
    try {
      $cleanupState = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
      if (
        $cleanupState.certificateSha1 -match "^[0-9a-f]{40}$" -and
        $cleanupState.certificateSha256 -match "^[0-9a-f]{64}$"
      ) {
        $importedThumbprints = @($cleanupState.certificateSha1)
        $removalCertificateSha256 = $cleanupState.certificateSha256
      }
    } catch {
      $cleanupFailed = $true
    }
  }
  foreach ($thumbprint in $importedThumbprints) {
    try {
      Remove-Certificate $thumbprint $removalCertificateSha256
      if (Test-Path -LiteralPath "Cert:\CurrentUser\My\$thumbprint") {
        $cleanupFailed = $true
      }
    } catch {
      $cleanupFailed = $true
    }
  }
  if ($cleanupFailed) { $operationFailurePhase = "certificate-removal" }
  [Console]::Error.WriteLine("FITFREED_WINDOWS_AUTHORITY_PHASE=$operationFailurePhase")
  exit 1
}

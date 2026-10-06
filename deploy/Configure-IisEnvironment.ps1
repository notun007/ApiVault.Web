[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string] $PublishPath,

    [Parameter(Mandatory)]
    [string] $ApiBaseUrl,

    [ValidateSet('Development', 'Production')]
    [string] $EnvironmentName = 'Production',

    [string] $ApplicationName = 'ApiVault',

    [string] $OrganizationName = 'Banking Organization',

    [string] $SessionStorageKey = 'apivault.session'
)

$ErrorActionPreference = 'Stop'

$resolvedPublishPath = (Resolve-Path -LiteralPath $PublishPath).Path
$runtimeConfigDirectory = Join-Path $resolvedPublishPath 'config'
$runtimeConfigPath = Join-Path $runtimeConfigDirectory 'runtime-config.json'

$apiUri = $null
if ((-not [Uri]::TryCreate($ApiBaseUrl, [UriKind]::Absolute, [ref] $apiUri)) -or
    ($apiUri.Scheme -ne 'http' -and $apiUri.Scheme -ne 'https')) {
    throw 'ApiBaseUrl must be an absolute HTTP(S) URL.'
}

if ($ApiBaseUrl.EndsWith('/')) {
    throw 'ApiBaseUrl must not have a trailing slash.'
}

if ($EnvironmentName -eq 'Production' -and $apiUri.Scheme -ne 'https') {
    throw 'Production ApiBaseUrl must use HTTPS.'
}

New-Item -ItemType Directory -Path $runtimeConfigDirectory -Force | Out-Null

$runtimeConfig = [ordered]@{
    apiBaseUrl = $ApiBaseUrl
    applicationName = $ApplicationName
    organizationName = $OrganizationName
    sessionStorageKey = $SessionStorageKey
}

$json = $runtimeConfig | ConvertTo-Json
[IO.File]::WriteAllText(
    $runtimeConfigPath,
    "$json$([Environment]::NewLine)",
    [Text.UTF8Encoding]::new($false))

Write-Output "Configured '$runtimeConfigPath' for $EnvironmentName."

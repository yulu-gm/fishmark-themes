param(
  [string[]]$ThemeIds
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
}

function Get-ThemeManifest {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ThemePath
  )

  $manifestPath = Join-Path $ThemePath "manifest.json"

  if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Missing manifest.json in '$ThemePath'."
  }

  $manifestJson = [System.IO.File]::ReadAllText($manifestPath)
  return $manifestJson | ConvertFrom-Json
}

function Get-ThemeDirectories {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ThemesRoot,
    [string[]]$RequestedThemeIds
  )

  $directories = Get-ChildItem -LiteralPath $ThemesRoot -Directory | Sort-Object Name

  if ($RequestedThemeIds -and $RequestedThemeIds.Count -gt 0) {
    $requested = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($themeId in $RequestedThemeIds) {
      [void]$requested.Add($themeId)
    }

    $directories = @($directories | Where-Object { $requested.Contains($_.Name) })

    foreach ($themeId in $RequestedThemeIds) {
      if (-not ($directories | Where-Object { $_.Name -ieq $themeId })) {
        throw "Theme '$themeId' was not found under '$ThemesRoot'."
      }
    }
  }

  if (-not $directories -or $directories.Count -eq 0) {
    throw "No theme directories found under '$ThemesRoot'."
  }

  return $directories
}

function Ensure-Directory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$DirectoryPath
  )

  if (-not (Test-Path -LiteralPath $DirectoryPath)) {
    [void](New-Item -ItemType Directory -Path $DirectoryPath -Force)
  }
}

function Package-ThemeDirectory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ThemePath,
    [Parameter(Mandatory = $true)]
    [string]$DistRoot
  )

  $manifest = Get-ThemeManifest -ThemePath $ThemePath
  $themeId = [string]$manifest.id
  $version = [string]$manifest.version

  if ([string]::IsNullOrWhiteSpace($themeId)) {
    throw "Theme at '$ThemePath' has an empty id."
  }

  if ([string]::IsNullOrWhiteSpace($version)) {
    $version = "1.0.0"
  }

  $archiveName = "$themeId-$version.zip"
  $archivePath = Join-Path $DistRoot $archiveName

  if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }

  Compress-Archive -LiteralPath $ThemePath -DestinationPath $archivePath -CompressionLevel Optimal

  return [PSCustomObject]@{
    id = $themeId
    version = $version
    archivePath = $archivePath
  }
}

$repoRoot = Get-RepoRoot
$themesRoot = Join-Path $repoRoot "themes"
$distRoot = Join-Path $repoRoot "dist"

if (-not (Test-Path -LiteralPath $themesRoot)) {
  throw "Themes root '$themesRoot' does not exist."
}

Ensure-Directory -DirectoryPath $distRoot

$themeDirectories = Get-ThemeDirectories -ThemesRoot $themesRoot -RequestedThemeIds $ThemeIds
$artifacts = foreach ($directory in $themeDirectories) {
  Package-ThemeDirectory -ThemePath $directory.FullName -DistRoot $distRoot
}

foreach ($artifact in $artifacts) {
  Write-Host ("Packed {0} {1} -> {2}" -f $artifact.id, $artifact.version, $artifact.archivePath)
}

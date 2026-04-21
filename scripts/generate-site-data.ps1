Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
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

function Read-JsonFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  $content = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
  if ([string]::IsNullOrWhiteSpace($content)) {
    return $null
  }

  return $content | ConvertFrom-Json
}

function Get-ThemeModes {
  param(
    [Parameter(Mandatory = $true)]
    $Manifest
  )

  $modes = [System.Collections.Generic.List[string]]::new()
  if ($null -ne $Manifest.supports -and $Manifest.supports.light) {
    [void]$modes.Add("light")
  }

  if ($null -ne $Manifest.supports -and $Manifest.supports.dark) {
    [void]$modes.Add("dark")
  }

  return $modes.ToArray()
}

function Get-ThemeParameters {
  param(
    [Parameter(Mandatory = $true)]
    $Manifest
  )

  $parameters = [System.Collections.Generic.List[string]]::new()
  foreach ($parameter in @($Manifest.parameters)) {
    $label = [string]$parameter.label
    if ([string]::IsNullOrWhiteSpace($label)) {
      $label = [string]$parameter.id
    }

    if (-not [string]::IsNullOrWhiteSpace($label)) {
      [void]$parameters.Add($label)
    }
  }

  return $parameters.ToArray()
}

function Test-HasDynamicBackground {
  param(
    [Parameter(Mandatory = $true)]
    $Manifest
  )

  if ($null -ne $Manifest.scene) {
    return $true
  }

  if ($null -eq $Manifest.surfaces) {
    return $false
  }

  foreach ($surface in @($Manifest.surfaces.PSObject.Properties.Value)) {
    if ($surface.kind -eq "fragment") {
      return $true
    }
  }

  return $false
}

function Test-HasImageTexture {
  param(
    [Parameter(Mandatory = $true)]
    $Manifest
  )

  if ($null -eq $Manifest.surfaces) {
    return $false
  }

  foreach ($surface in @($Manifest.surfaces.PSObject.Properties.Value)) {
    $channelProperty = $surface.PSObject.Properties["channels"]
    if ($null -eq $channelProperty -or $null -eq $channelProperty.Value) {
      continue
    }

    foreach ($channel in @($channelProperty.Value.PSObject.Properties.Value)) {
      if ($channel.type -eq "image") {
        return $true
      }
    }
  }

  return $false
}

function Get-DefaultFeatures {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Modes,
    [Parameter(Mandatory = $true)]
    [string[]]$Parameters,
    [Parameter(Mandatory = $true)]
    [bool]$HasDynamicBackground,
    [Parameter(Mandatory = $true)]
    [bool]$HasImageTexture
  )

  $features = [System.Collections.Generic.List[string]]::new()
  if ($Modes.Count -gt 1) {
    [void]$features.Add("双模式")
  } elseif ($Modes.Count -eq 1) {
    $singleModeLabel = if ($Modes[0] -eq "dark") { "暗色" } else { "亮色" }
    [void]$features.Add(("{0} 专用" -f $singleModeLabel))
  }

  if ($HasDynamicBackground) {
    [void]$features.Add("动态背景")
  }

  if ($HasImageTexture) {
    [void]$features.Add("贴图材质")
  }

  if ($Parameters.Count -gt 0) {
    [void]$features.Add(("{0} 项参数" -f $Parameters.Count))
  }

  return $features.ToArray()
}

function Get-DefaultTagline {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Modes,
    [Parameter(Mandatory = $true)]
    [string[]]$Parameters
  )

  $modeLabel = if ($Modes.Count -gt 0) {
    [string]::Join(" / ", ($Modes | ForEach-Object { if ($_ -eq "dark") { "Dark" } else { "Light" } }))
  } else {
    "默认"
  }

  return "支持 $modeLabel 模式，提供 $($Parameters.Count) 项可调参数。"
}

function Get-DefaultSummary {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Modes,
    [Parameter(Mandatory = $true)]
    [string[]]$Parameters,
    [Parameter(Mandatory = $true)]
    [bool]$HasDynamicBackground,
    [Parameter(Mandatory = $true)]
    [bool]$HasImageTexture
  )

  $parts = [System.Collections.Generic.List[string]]::new()
  if ($Modes.Count -gt 0) {
    [void]$parts.Add(("支持 {0} 模式" -f [string]::Join(" / ", ($Modes | ForEach-Object { if ($_ -eq "dark") { "Dark" } else { "Light" } }))))
  }

  if ($Parameters.Count -gt 0) {
    [void]$parts.Add(("内置 {0} 项可调参数" -f $Parameters.Count))
  }

  if ($HasDynamicBackground) {
    [void]$parts.Add("包含动态背景表现")
  }

  if ($HasImageTexture) {
    [void]$parts.Add("可利用贴图素材增强氛围")
  }

  if ($parts.Count -eq 0) {
    return "主题展示信息未补充完整，当前使用缺省规则生成展示卡片。"
  }

  return ([string]::Join("，", $parts) + "。")
}

function Copy-CoverImage {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,
    [Parameter(Mandatory = $true)]
    [string]$ThemeId,
    [Parameter(Mandatory = $true)]
    [string]$CoversOutputDirectory
  )

  if (-not (Test-Path -LiteralPath $SourcePath)) {
    return $null
  }

  $destinationPath = Join-Path $CoversOutputDirectory "$ThemeId.png"
  Copy-Item -LiteralPath $SourcePath -Destination $destinationPath -Force
  return "./assets/generated/covers/$ThemeId.png"
}

function Get-ThemeRecord {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ThemeDirectory,
    [Parameter(Mandatory = $true)]
    [string]$CoversOutputDirectory
  )

  $manifest = Read-JsonFile -Path (Join-Path $ThemeDirectory "manifest.json")
  if ($null -eq $manifest) {
    throw "Missing manifest.json in '$ThemeDirectory'."
  }

  $showcase = Read-JsonFile -Path (Join-Path $ThemeDirectory "showcase.json")
  $themeId = [string]$manifest.id
  $version = [string]$manifest.version
  if ([string]::IsNullOrWhiteSpace($version)) {
    $version = "1.0.0"
  }

  $modes = @(Get-ThemeModes -Manifest $manifest)
  $parameters = @(Get-ThemeParameters -Manifest $manifest)
  $hasDynamicBackground = Test-HasDynamicBackground -Manifest $manifest
  $hasImageTexture = Test-HasImageTexture -Manifest $manifest

  $coverImage = Copy-CoverImage -SourcePath (Join-Path $ThemeDirectory "cover.png") -ThemeId $themeId -CoversOutputDirectory $CoversOutputDirectory
  $features = if ($null -ne $showcase -and @($showcase.features).Count -gt 0) {
    @($showcase.features | ForEach-Object { [string]$_ })
  } else {
    @(Get-DefaultFeatures -Modes $modes -Parameters $parameters -HasDynamicBackground:$hasDynamicBackground -HasImageTexture:$hasImageTexture)
  }

  $tagline = if ($null -ne $showcase -and -not [string]::IsNullOrWhiteSpace([string]$showcase.tagline)) {
    [string]$showcase.tagline
  } else {
    Get-DefaultTagline -Modes $modes -Parameters $parameters
  }

  $summary = if ($null -ne $showcase -and -not [string]::IsNullOrWhiteSpace([string]$showcase.summary)) {
    [string]$showcase.summary
  } else {
    Get-DefaultSummary -Modes $modes -Parameters $parameters -HasDynamicBackground:$hasDynamicBackground -HasImageTexture:$hasImageTexture
  }

  $accentStart = if ($null -ne $showcase -and $null -ne $showcase.accent -and -not [string]::IsNullOrWhiteSpace([string]$showcase.accent.start)) {
    [string]$showcase.accent.start
  } else {
    "#c7b79d"
  }

  $accentEnd = if ($null -ne $showcase -and $null -ne $showcase.accent -and -not [string]::IsNullOrWhiteSpace([string]$showcase.accent.end)) {
    [string]$showcase.accent.end
  } else {
    "#65584c"
  }

  $surface = if ($null -ne $showcase -and $null -ne $showcase.surface -and -not [string]::IsNullOrWhiteSpace([string]$showcase.surface.value)) {
    [string]$showcase.surface.value
  } else {
    "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(0,0,0,0.16))"
  }

  $hidden = $false
  if ($null -ne $showcase -and $null -ne $showcase.hidden) {
    $hidden = [bool]$showcase.hidden
  }

  $order = 999
  if ($null -ne $showcase -and $null -ne $showcase.order) {
    $order = [int]$showcase.order
  }

  return [PSCustomObject]@{
    id = $themeId
    name = [string]$manifest.name
    version = $version
    modes = $modes
    tagline = $tagline
    summary = $summary
    features = $features
    parameters = $parameters
    coverImage = $coverImage
    accentStart = $accentStart
    accentEnd = $accentEnd
    surface = $surface
    order = $order
    hidden = $hidden
    downloadFile = "$themeId-$version.zip"
  }
}

$repoRoot = Get-RepoRoot
$themesRoot = Join-Path $repoRoot "themes"
$siteRoot = Join-Path $repoRoot "site"
$generatedRoot = Join-Path $siteRoot "assets/generated"
$coversOutputDirectory = Join-Path $generatedRoot "covers"
$themesJsonPath = Join-Path $siteRoot "assets/data/themes.json"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

Ensure-Directory -DirectoryPath $generatedRoot
Ensure-Directory -DirectoryPath $coversOutputDirectory
Ensure-Directory -DirectoryPath ([System.IO.Path]::GetDirectoryName($themesJsonPath))

Get-ChildItem -LiteralPath $coversOutputDirectory -Filter *.png -File | Remove-Item -Force

$themeDirectories = Get-ChildItem -LiteralPath $themesRoot -Directory | Sort-Object Name
if (-not $themeDirectories -or $themeDirectories.Count -eq 0) {
  throw "No theme directories found under '$themesRoot'."
}

$records = foreach ($directory in $themeDirectories) {
  Get-ThemeRecord -ThemeDirectory $directory.FullName -CoversOutputDirectory $coversOutputDirectory
}

$visibleRecords = @(
  $records |
    Where-Object { -not $_.hidden } |
    Sort-Object order, name |
    Select-Object id, name, version, modes, tagline, summary, features, parameters, coverImage, accentStart, accentEnd, surface, downloadFile
)

$json = $visibleRecords | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($themesJsonPath, $json, $utf8NoBom)

Write-Host ("Generated {0} theme records -> {1}" -f $visibleRecords.Count, $themesJsonPath)

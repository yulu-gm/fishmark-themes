param(
  [int]$Port = 4173,
  [switch]$NoOpen
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
}

function Test-PortAvailable {
  param(
    [Parameter(Mandatory = $true)]
    [int]$CandidatePort
  )

  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $CandidatePort)
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    if ($null -ne $listener) {
      $listener.Stop()
    }
  }
}

function Find-AvailablePort {
  param(
    [Parameter(Mandatory = $true)]
    [int]$StartPort
  )

  for ($offset = 0; $offset -lt 20; $offset++) {
    $candidate = $StartPort + $offset
    if (Test-PortAvailable -CandidatePort $candidate) {
      return $candidate
    }
  }

  throw "No available localhost port found from $StartPort to $($StartPort + 19)."
}

function Get-ContentType {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { return "text/html; charset=utf-8" }
    ".css" { return "text/css; charset=utf-8" }
    ".js" { return "application/javascript; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    ".png" { return "image/png" }
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".svg" { return "image/svg+xml" }
    ".ico" { return "image/x-icon" }
    ".txt" { return "text/plain; charset=utf-8" }
    default { return "application/octet-stream" }
  }
}

function Send-Response {
  param(
    [Parameter(Mandatory = $true)]
    [System.IO.Stream]$Stream,
    [Parameter(Mandatory = $true)]
    [int]$StatusCode,
    [Parameter(Mandatory = $true)]
    [string]$Reason,
    [Parameter(Mandatory = $true)]
    [byte[]]$Body,
    [Parameter(Mandatory = $true)]
    [string]$ContentType,
    [Parameter(Mandatory = $true)]
    [bool]$HeadOnly
  )

  $header = "HTTP/1.1 $StatusCode $Reason`r`nContent-Length: $($Body.Length)`r`nContent-Type: $ContentType`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)

  if (-not $HeadOnly -and $Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

function Handle-Client {
  param(
    [Parameter(Mandatory = $true)]
    [System.Net.Sockets.TcpClient]$Client,
    [Parameter(Mandatory = $true)]
    [string]$SiteRoot
  )

  $stream = $Client.GetStream()
  $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
  $siteRootWithSeparator = $SiteRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

  try {
    $requestLine = $reader.ReadLine()
    if ([string]::IsNullOrWhiteSpace($requestLine)) {
      return
    }

    while ($true) {
      $headerLine = $reader.ReadLine()
      if ($null -eq $headerLine -or $headerLine.Length -eq 0) {
        break
      }
    }

    $parts = $requestLine.Split(" ")
    if ($parts.Count -lt 2) {
      $body = [System.Text.Encoding]::UTF8.GetBytes("400 Bad Request")
      Send-Response -Stream $stream -StatusCode 400 -Reason "Bad Request" -Body $body -ContentType "text/plain; charset=utf-8" -HeadOnly:$false
      return
    }

    $method = $parts[0].ToUpperInvariant()
    $headOnly = $method -eq "HEAD"
    if ($method -ne "GET" -and $method -ne "HEAD") {
      $body = [System.Text.Encoding]::UTF8.GetBytes("405 Method Not Allowed")
      Send-Response -Stream $stream -StatusCode 405 -Reason "Method Not Allowed" -Body $body -ContentType "text/plain; charset=utf-8" -HeadOnly:$headOnly
      return
    }

    $requestTarget = $parts[1]
    $requestPath = $requestTarget.Split("?")[0]
    $requestPath = [System.Uri]::UnescapeDataString($requestPath)
    $relativePath = $requestPath.TrimStart("/")
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      $relativePath = "index.html"
    }

    $relativePath = $relativePath.Replace("/", [string][System.IO.Path]::DirectorySeparatorChar)
    $resolvedPath = [System.IO.Path]::GetFullPath((Join-Path $SiteRoot $relativePath))
    if (Test-Path -LiteralPath $resolvedPath -PathType Container) {
      $resolvedPath = [System.IO.Path]::GetFullPath((Join-Path $resolvedPath "index.html"))
    }

    if (-not $resolvedPath.StartsWith($siteRootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)) {
      $body = [System.Text.Encoding]::UTF8.GetBytes("403 Forbidden")
      Send-Response -Stream $stream -StatusCode 403 -Reason "Forbidden" -Body $body -ContentType "text/plain; charset=utf-8" -HeadOnly:$headOnly
      return
    }

    if (-not (Test-Path -LiteralPath $resolvedPath -PathType Leaf)) {
      $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
      Send-Response -Stream $stream -StatusCode 404 -Reason "Not Found" -Body $body -ContentType "text/plain; charset=utf-8" -HeadOnly:$headOnly
      return
    }

    $bodyBytes = [System.IO.File]::ReadAllBytes($resolvedPath)
    Send-Response -Stream $stream -StatusCode 200 -Reason "OK" -Body $bodyBytes -ContentType (Get-ContentType -Path $resolvedPath) -HeadOnly:$headOnly
  } finally {
    $reader.Dispose()
    $Client.Close()
  }
}

$repoRoot = Get-RepoRoot
$siteRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "site"))
$generateScript = Join-Path $PSScriptRoot "generate-site-data.ps1"

if (-not (Test-Path -LiteralPath (Join-Path $siteRoot "index.html") -PathType Leaf)) {
  throw "Site entry not found: $(Join-Path $siteRoot "index.html")"
}

Write-Host "Refreshing site data..."
& $generateScript

$actualPort = Find-AvailablePort -StartPort $Port
if ($actualPort -ne $Port) {
  Write-Host "Port $Port is busy; using $actualPort instead."
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $actualPort)
$listener.Start()

$url = "http://127.0.0.1:$actualPort/"
Write-Host "Preview server running: $url"
Write-Host "Serving: $siteRoot"
Write-Host "Press Ctrl+C to stop."

if (-not $NoOpen) {
  Start-Process $url
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    Handle-Client -Client $client -SiteRoot $siteRoot
  }
} finally {
  $listener.Stop()
}

param(
    [string]$SeedUrl = "https://www.guardiansofganja.com"
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $workspaceRoot "docs/migration/asset-manifests/asset-manifest.csv"
$notesPath = Join-Path $workspaceRoot "docs/migration/asset-manifests/asset-manifest-notes.md"
$rawRoot = Join-Path $workspaceRoot "public/imports/guardians-of-ganja/raw"
$htmlOutRoot = Join-Path $workspaceRoot "docs/migration/content-snapshots/raw-html"
$textOutRoot = Join-Path $workspaceRoot "docs/migration/content-snapshots/text"
$pageIndexPath = Join-Path $workspaceRoot "docs/migration/content-snapshots/page-content-index.csv"

function Ensure-Dir {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function To-RelativePath {
    param([string]$Path)
    $full = [System.IO.Path]::GetFullPath($Path)
    $root = [System.IO.Path]::GetFullPath($workspaceRoot)
    if ($full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        $rel = $full.Substring($root.Length).TrimStart([char[]]@('\', '/'))
        return $rel.Replace('\\', '/')
    }
    return $full.Replace('\\', '/')
}

function Get-SlugFromUrl {
    param([string]$Url)
    $uri = [Uri]$Url
    $slug = $uri.AbsolutePath.Trim("/")
    if ([string]::IsNullOrWhiteSpace($slug)) {
        return "home"
    }
    $slug = $slug.Replace("/", "-")
    $slug = [regex]::Replace($slug, "[^a-zA-Z0-9\-_]", "-")
    if ([string]::IsNullOrWhiteSpace($slug)) {
        return "page"
    }
    return $slug.ToLowerInvariant()
}

function Get-LocalAssetPath {
    param([string]$Url)

    $uri = [Uri]$Url
        $hostName = [regex]::Replace($uri.Host.ToLowerInvariant(), "[^a-z0-9\.-]", "-")

    $segments = @()
    foreach ($seg in $uri.AbsolutePath.Split('/')) {
        if ([string]::IsNullOrWhiteSpace($seg)) { continue }
        $segments += [regex]::Replace($seg, "[^a-zA-Z0-9\-_.]", "-")
    }

    $fileName = "asset"
    if ($segments.Count -gt 0) {
        $fileName = $segments[-1]
    }

    if ($fileName -notmatch "\.") {
        $fileName = "$fileName.bin"
    }

    if (-not [string]::IsNullOrWhiteSpace($uri.Query)) {
        $hashInput = [System.Text.Encoding]::UTF8.GetBytes($uri.Query)
        $sha = [System.Security.Cryptography.SHA256]::Create()
        $queryHash = ([BitConverter]::ToString($sha.ComputeHash($hashInput))).Replace("-", "").ToLowerInvariant().Substring(0, 10)
        $name = [System.IO.Path]::GetFileNameWithoutExtension($fileName)
        $ext = [System.IO.Path]::GetExtension($fileName)
        $fileName = "$name-$queryHash$ext"
    }

        $subDirSegments = @($hostName)
    if ($segments.Count -gt 1) {
        $subDirSegments += $segments[0..($segments.Count - 2)]
    }

    $dir = Join-Path $rawRoot ($subDirSegments -join "\\")
    Ensure-Dir -Path $dir
    return Join-Path $dir $fileName
}

function Download-Asset {
    param(
        [string]$Url,
        [string]$TargetPath
    )

    $request = [System.Net.HttpWebRequest]::Create($Url)
    $request.Method = "GET"
    $request.Timeout = 30000
    $request.UserAgent = "GuardiansOfGanjaAcquisition/1.0"

    $response = $null
    $responseStream = $null
    $fileStream = $null

    try {
        $response = [System.Net.HttpWebResponse]$request.GetResponse()
        $responseStream = $response.GetResponseStream()
        $fileStream = [System.IO.File]::Open($TargetPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
        $responseStream.CopyTo($fileStream)
        $fileStream.Flush()

        $mime = $response.ContentType
        if ($mime) {
            $mime = $mime.Split(';')[0].Trim()
        }

        return [pscustomobject]@{
            MimeType = $mime
            Success = $true
            Error = ""
        }
    }
    catch {
        return [pscustomobject]@{
            MimeType = ""
            Success = $false
            Error = $_.Exception.Message
        }
    }
    finally {
        if ($fileStream) { $fileStream.Dispose() }
        if ($responseStream) { $responseStream.Dispose() }
        if ($response) { $response.Dispose() }
    }
}

Ensure-Dir -Path $rawRoot
Ensure-Dir -Path $htmlOutRoot
Ensure-Dir -Path $textOutRoot

if (-not (Test-Path $manifestPath)) {
    throw "Manifest not found at $manifestPath"
}

$rows = Import-Csv -Path $manifestPath
$downloadedCount = 0
$existingCount = 0
$failedCount = 0
$unresolved = New-Object System.Collections.Generic.List[string]

foreach ($row in $rows) {
    $targetPath = Get-LocalAssetPath -Url $row.source_url
    $relativePath = To-RelativePath -Path $targetPath

    if (Test-Path $targetPath) {
        $hash = (Get-FileHash -Algorithm SHA256 -Path $targetPath).Hash.ToLowerInvariant()
        $row.local_stage_path = $relativePath
        $row.checksum_sha256 = $hash
        if ([string]::IsNullOrWhiteSpace($row.mime_type)) {
            $row.mime_type = "application/octet-stream"
        }
        $row.status = "downloaded"
        $row.last_seen_utc = [DateTime]::UtcNow.ToString("o")
        $existingCount++
        continue
    }

    $result = Download-Asset -Url $row.source_url -TargetPath $targetPath
    if (-not $result.Success) {
        $row.status = "unresolved"
        $row.notes = $result.Error
        $row.last_seen_utc = [DateTime]::UtcNow.ToString("o")
        $failedCount++
        $unresolved.Add("$($row.source_url) :: $($result.Error)") | Out-Null
        continue
    }

    $hash = (Get-FileHash -Algorithm SHA256 -Path $targetPath).Hash.ToLowerInvariant()
    $row.local_stage_path = $relativePath
    $row.checksum_sha256 = $hash
    $row.mime_type = $result.MimeType
    $row.status = "downloaded"
    $row.last_seen_utc = [DateTime]::UtcNow.ToString("o")
    $row.notes = ""
    $downloadedCount++
}

$rows | Export-Csv -Path $manifestPath -NoTypeInformation

# Content snapshots for top-level pages discovered in source_page
$pageUrls = New-Object System.Collections.Generic.HashSet[string] ([System.StringComparer]::OrdinalIgnoreCase)
foreach ($row in $rows) {
    if (-not [string]::IsNullOrWhiteSpace($row.source_page)) {
        [void]$pageUrls.Add($row.source_page)
    }
}
[void]$pageUrls.Add($SeedUrl)

$pageIndex = New-Object System.Collections.Generic.List[object]
foreach ($pageUrl in $pageUrls) {
    $slug = Get-SlugFromUrl -Url $pageUrl
    $htmlPath = Join-Path $htmlOutRoot "$slug.html"
    $textPath = Join-Path $textOutRoot "$slug.txt"

    try {
        $resp = Invoke-WebRequest -Uri $pageUrl -UseBasicParsing -TimeoutSec 40
        $html = $resp.Content

        [System.IO.File]::WriteAllText($htmlPath, $html, [System.Text.Encoding]::UTF8)

        $text = $html
        $text = [regex]::Replace($text, "(?is)<script.*?</script>", " ")
        $text = [regex]::Replace($text, "(?is)<style.*?</style>", " ")
        $text = [regex]::Replace($text, "(?is)<[^>]+>", " ")
        $text = [regex]::Replace($text, "\s+", " ").Trim()
        $decoded = [System.Net.WebUtility]::HtmlDecode($text)
        [System.IO.File]::WriteAllText($textPath, $decoded, [System.Text.Encoding]::UTF8)

        $pageIndex.Add([pscustomobject]@{
            page_url = $pageUrl
            html_path = To-RelativePath -Path $htmlPath
            text_path = To-RelativePath -Path $textPath
            fetched_utc = [DateTime]::UtcNow.ToString("o")
            status = "downloaded"
            notes = ""
        }) | Out-Null
    }
    catch {
        $pageIndex.Add([pscustomobject]@{
            page_url = $pageUrl
            html_path = ""
            text_path = ""
            fetched_utc = [DateTime]::UtcNow.ToString("o")
            status = "unresolved"
            notes = $_.Exception.Message
        }) | Out-Null
    }
}

$pageIndex | Export-Csv -Path $pageIndexPath -NoTypeInformation

$now = [DateTime]::UtcNow.ToString("o")
$notesLines = @()
$notesLines += "# Asset Manifest Notes"
$notesLines += ""
$notesLines += "## Crawl Session"
$notesLines += "- Date (UTC): $now"
$notesLines += "- Operator: Copilot"
$notesLines += "- Seed URL: $SeedUrl"
$notesLines += "- Scope: homepage + internal links + sitemap discovery where available"
$notesLines += ""
$notesLines += "## Acquisition Summary"
$notesLines += "- Downloaded this run: $downloadedCount"
$notesLines += "- Already present: $existingCount"
$notesLines += "- Failed: $failedCount"
$notesLines += ""
$notesLines += "## Unresolved or Restricted"
if ($unresolved.Count -eq 0) {
    $notesLines += "- None"
}
else {
    foreach ($line in $unresolved) {
        $notesLines += "- $line"
    }
}
$notesLines += ""
$notesLines += "## Dedupe Decisions"
$notesLines += "- Asset files are checksummed with SHA256 and retained in raw import paths by source host and path."
$notesLines += ""
$notesLines += "## Approval Gates"
$notesLines += "- Full content/media acquisition owner confirmation: APPROVED (2026-04-22)"
[System.IO.File]::WriteAllText($notesPath, ($notesLines -join [Environment]::NewLine), [System.Text.Encoding]::UTF8)

Write-Output "Acquisition complete. Downloaded=$downloadedCount Existing=$existingCount Failed=$failedCount Pages=$($pageIndex.Count)"

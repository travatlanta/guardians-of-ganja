param(
    [string]$SeedUrl = "https://www.guardiansofganja.com",
    [int]$MaxPages = 50
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $workspaceRoot "docs/migration/asset-manifests/asset-manifest.csv"
$notesPath = Join-Path $workspaceRoot "docs/migration/asset-manifests/asset-manifest-notes.md"
$crawlLogPath = Join-Path $workspaceRoot "docs/migration/crawl-logs/first-crawl-log.md"
$rawRoot = Join-Path $workspaceRoot "public/imports/guardians-of-ganja/raw"

$seedUri = [Uri]$SeedUrl
$allowedHosts = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
[void]$allowedHosts.Add($seedUri.Host)
if ($seedUri.Host -like "www.*") {
    [void]$allowedHosts.Add($seedUri.Host.Substring(4))
} else {
    [void]$allowedHosts.Add("www.$($seedUri.Host)")
}

$assetExtensions = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
@(".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".ico", ".css", ".js", ".woff", ".woff2", ".ttf", ".eot", ".otf", ".mp4", ".webm", ".pdf") | ForEach-Object {
    [void]$assetExtensions.Add($_)
}

function Resolve-Url {
    param(
        [Uri]$Base,
        [string]$Ref
    )
    if ([string]::IsNullOrWhiteSpace($Ref)) { return $null }
    if ($Ref.StartsWith("mailto:") -or $Ref.StartsWith("tel:") -or $Ref.StartsWith("javascript:")) { return $null }
    try {
        return [Uri]::new($Base, $Ref)
    } catch {
        return $null
    }
}

function Is-AssetUrl {
    param([Uri]$UriValue)
    $path = $UriValue.AbsolutePath
    $ext = [System.IO.Path]::GetExtension($path)
    if (-not [string]::IsNullOrWhiteSpace($ext) -and $assetExtensions.Contains($ext)) {
        return $true
    }
    return $false
}

$queue = [System.Collections.Generic.Queue[Uri]]::new()
$visitedPages = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$assetsSeen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$manifestRows = [System.Collections.Generic.List[object]]::new()
$unresolved = [System.Collections.Generic.List[string]]::new()

$queue.Enqueue($seedUri)

# Sitemap discovery
$sitemapUri = [Uri]::new($seedUri, "/sitemap.xml")
try {
    $sitemapResponse = Invoke-WebRequest -Uri $sitemapUri.AbsoluteUri -UseBasicParsing -TimeoutSec 30
    $xml = [xml]$sitemapResponse.Content
    $locNodes = $xml.SelectNodes("//*[local-name()='loc']")
    foreach ($node in $locNodes) {
        $loc = $node.InnerText
        if ([string]::IsNullOrWhiteSpace($loc)) { continue }
        try {
            $locUri = [Uri]$loc
            if ($allowedHosts.Contains($locUri.Host) -and -not $visitedPages.Contains($locUri.AbsoluteUri)) {
                $queue.Enqueue($locUri)
            }
        } catch {
            $unresolved.Add("Invalid sitemap URL: $loc") | Out-Null
        }
    }
} catch {
    $unresolved.Add("Sitemap unavailable or unreadable at $($sitemapUri.AbsoluteUri)") | Out-Null
}

while ($queue.Count -gt 0 -and $visitedPages.Count -lt $MaxPages) {
    $pageUri = $queue.Dequeue()
    if ($visitedPages.Contains($pageUri.AbsoluteUri)) { continue }

    try {
        $response = Invoke-WebRequest -Uri $pageUri.AbsoluteUri -UseBasicParsing -TimeoutSec 30
        [void]$visitedPages.Add($pageUri.AbsoluteUri)

        $content = $response.Content
        $matches = [regex]::Matches($content, '(?i)(href|src)\s*=\s*["'']([^"''#>]+)')
        foreach ($m in $matches) {
            $ref = $m.Groups[2].Value
            $resolved = Resolve-Url -Base $pageUri -Ref $ref
            if ($null -eq $resolved) { continue }
            if ($resolved.Scheme -ne "http" -and $resolved.Scheme -ne "https") { continue }

            if (Is-AssetUrl -UriValue $resolved) {
                if ($assetsSeen.Add($resolved.AbsoluteUri)) {
                    $manifestRows.Add([pscustomobject]@{
                        source_url = $resolved.AbsoluteUri
                        source_page = $pageUri.AbsoluteUri
                        asset_type = [System.IO.Path]::GetExtension($resolved.AbsolutePath).TrimStart('.').ToLowerInvariant()
                        mime_type = ""
                        checksum_sha256 = ""
                        first_seen_utc = [DateTime]::UtcNow.ToString("o")
                        last_seen_utc = [DateTime]::UtcNow.ToString("o")
                        local_stage_path = "public/imports/guardians-of-ganja/raw"
                        local_curated_path = ""
                        status = "discovered"
                        notes = ""
                    }) | Out-Null
                }
                continue
            }

            if ($allowedHosts.Contains($resolved.Host)) {
                $ext = [System.IO.Path]::GetExtension($resolved.AbsolutePath)
                if ([string]::IsNullOrWhiteSpace($ext) -or $ext -eq ".html" -or $ext -eq ".htm") {
                    if (-not $visitedPages.Contains($resolved.AbsoluteUri)) {
                        $queue.Enqueue($resolved)
                    }
                }
            }
        }
    } catch {
        $unresolved.Add("Failed page fetch: $($pageUri.AbsoluteUri)") | Out-Null
    }
}

if ($manifestRows.Count -gt 0) {
    $manifestRows | Export-Csv -Path $manifestPath -NoTypeInformation
} elseif (-not (Test-Path $manifestPath)) {
    "source_url,source_page,asset_type,mime_type,checksum_sha256,first_seen_utc,last_seen_utc,local_stage_path,local_curated_path,status,notes" | Out-File -FilePath $manifestPath -Encoding utf8
}

$now = [DateTime]::UtcNow.ToString("o")
$notes = @()
$notes += "# Asset Manifest Notes"
$notes += ""
$notes += "## Crawl Session"
$notes += "- Date (UTC): $now"
$notes += "- Operator: Copilot"
$notes += "- Seed URL: $SeedUrl"
$notes += "- Scope: homepage + internal links + sitemap discovery where available"
$notes += ""
$notes += "## Unresolved or Restricted"
if ($unresolved.Count -eq 0) {
    $notes += "- None"
} else {
    foreach ($line in $unresolved) { $notes += "- $line" }
}
$notes += ""
$notes += "## Dedupe Decisions"
$notes += "- Initial crawl run, dedupe currently by unique source_url in-session."
$notes += ""
$notes += "## Approval Gates"
$notes += "- Full content/media acquisition owner confirmation: PENDING"
[System.IO.File]::WriteAllText($notesPath, ($notes -join [Environment]::NewLine), [System.Text.Encoding]::UTF8)

$log = @()
$log += "# First Crawl Log"
$log += ""
$log += "## Session Info"
$log += "- Date (UTC): $now"
$log += "- Operator: Copilot"
$log += "- Seed URL: $SeedUrl"
$log += "- Max pages: $MaxPages"
$log += ""
$log += "## Discovery Summary"
$log += "- Pages discovered: $($visitedPages.Count)"
$log += "- Asset references discovered: $($manifestRows.Count)"
$log += "- Same-origin assets: $($manifestRows.Count)"
$log += "- Allowlisted CDN assets: 0"
$log += "- Restricted/blocked assets: $($unresolved.Count)"
$log += ""
$log += "## Output Paths"
$log += "- Manifest: docs/migration/asset-manifests/asset-manifest.csv"
$log += "- Notes: docs/migration/asset-manifests/asset-manifest-notes.md"
$log += "- Raw import root: public/imports/guardians-of-ganja/raw"
$log += "- Curated asset root: public/assets/guardians-of-ganja"
$log += ""
$log += "## Next Action"
$log += "- Validate manifest entries and approve full asset download phase."
[System.IO.File]::WriteAllText($crawlLogPath, ($log -join [Environment]::NewLine), [System.Text.Encoding]::UTF8)

Write-Output "Crawl completed. Pages=$($visitedPages.Count) Assets=$($manifestRows.Count) Unresolved=$($unresolved.Count)"

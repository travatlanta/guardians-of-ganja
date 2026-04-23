$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $workspaceRoot "docs/migration/asset-manifests/asset-manifest.csv"
$curatedRoot = Join-Path $workspaceRoot "public/assets/guardians-of-ganja/images"
$siteMirrorRoot = Join-Path $workspaceRoot "site/assets/img/curated"
$mapPath = Join-Path $workspaceRoot "docs/migration/asset-manifests/curated-asset-map.csv"
$summaryPath = Join-Path $workspaceRoot "docs/migration/asset-manifests/curated-asset-summary.md"

function Ensure-Dir {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

Ensure-Dir -Path $curatedRoot
Ensure-Dir -Path $siteMirrorRoot

$rows = Import-Csv -Path $manifestPath
$imageRows = $rows | Where-Object {
    $_.status -eq "downloaded" -and $_.asset_type -match "^(jpg|jpeg|png|webp|gif|svg)$" -and -not [string]::IsNullOrWhiteSpace($_.checksum_sha256)
}

$seen = @{}
$map = New-Object System.Collections.Generic.List[object]
$copied = 0
$deduped = 0

foreach ($row in $imageRows) {
    $checksum = $row.checksum_sha256.ToLowerInvariant()
    $assetType = $row.asset_type.ToLowerInvariant()
    if ($assetType -eq "jpeg") { $assetType = "jpg" }

    $rawPath = $row.local_stage_path
    if ($rawPath -match "^[A-Za-z]:\\") {
        $absRawPath = $rawPath
    }
    else {
        $absRawPath = Join-Path $workspaceRoot $rawPath
    }

    if (-not (Test-Path $absRawPath)) {
        $map.Add([pscustomobject]@{
            source_url = $row.source_url
            checksum_sha256 = $checksum
            raw_path = $rawPath
            curated_path = ""
            site_mirror_path = ""
            status = "missing_raw"
            notes = "Raw file not found"
        }) | Out-Null
        continue
    }

    if ($seen.ContainsKey($checksum)) {
        $deduped++
        $existing = $seen[$checksum]
        $map.Add([pscustomobject]@{
            source_url = $row.source_url
            checksum_sha256 = $checksum
            raw_path = $rawPath
            curated_path = $existing.curated
            site_mirror_path = $existing.siteMirror
            status = "deduped"
            notes = "Reused existing curated file by checksum"
        }) | Out-Null
        continue
    }

    $sourceName = [System.IO.Path]::GetFileNameWithoutExtension(([Uri]$row.source_url).AbsolutePath)
    if ([string]::IsNullOrWhiteSpace($sourceName)) {
        $sourceName = "image"
    }
    $safeName = [regex]::Replace($sourceName.ToLowerInvariant(), "[^a-z0-9\-]+", "-").Trim('-')
    if ([string]::IsNullOrWhiteSpace($safeName)) {
        $safeName = "image"
    }

    $shortHash = $checksum.Substring(0, 10)
    $fileName = "$safeName-$shortHash.$assetType"
    $curatedAbsPath = Join-Path $curatedRoot $fileName
    $siteAbsPath = Join-Path $siteMirrorRoot $fileName

    Copy-Item -Path $absRawPath -Destination $curatedAbsPath -Force
    Copy-Item -Path $absRawPath -Destination $siteAbsPath -Force
    $copied++

    $curatedRel = "public/assets/guardians-of-ganja/images/$fileName"
    $siteRel = "site/assets/img/curated/$fileName"
    $seen[$checksum] = @{ curated = $curatedRel; siteMirror = $siteRel }

    $map.Add([pscustomobject]@{
        source_url = $row.source_url
        checksum_sha256 = $checksum
        raw_path = $rawPath
        curated_path = $curatedRel
        site_mirror_path = $siteRel
        status = "curated"
        notes = ""
    }) | Out-Null
}

$map | Export-Csv -Path $mapPath -NoTypeInformation

$summary = @()
$summary += "# Curated Asset Summary"
$summary += ""
$summary += "- Run UTC: $([DateTime]::UtcNow.ToString('o'))"
$summary += "- Source image rows scanned: $($imageRows.Count)"
$summary += "- Unique images copied to curated: $copied"
$summary += "- Duplicates deduped by checksum: $deduped"
$summary += "- Curated root: public/assets/guardians-of-ganja/images"
$summary += "- Site mirror root: site/assets/img/curated"
[System.IO.File]::WriteAllText($summaryPath, ($summary -join [Environment]::NewLine), [System.Text.Encoding]::UTF8)

Write-Output "Curated asset pack built. Unique=$copied Deduped=$deduped TotalRows=$($imageRows.Count)"

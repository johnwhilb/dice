$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$detailRoot = $PSScriptRoot
$sourcePath = Join-Path (Split-Path -Parent $detailRoot) 'UI.png'
$config = Get-Content -LiteralPath (Join-Path $detailRoot '切分配置.json') -Raw | ConvertFrom-Json
$sourceHashBefore = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
$sourceBitmap = [System.Drawing.Bitmap]::new($sourcePath)
$reconstructed = [System.Drawing.Bitmap]::new($sourceBitmap.Width, $sourceBitmap.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$residual = [System.Drawing.Bitmap]::new($sourceBitmap.Width, $sourceBitmap.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$components = [System.Collections.Generic.List[object]]::new()
$presets = [System.Collections.Generic.List[object]]::new()
$overlapCount = 0

function Export-Component($definition, $trackReconstruction) {
    $rx = [int]$definition.rect[0]
    $ry = [int]$definition.rect[1]
    $rw = [int]$definition.rect[2]
    $rh = [int]$definition.rect[3]
    $minX = $sourceBitmap.Width
    $minY = $sourceBitmap.Height
    $maxX = -1
    $maxY = -1
    $visibleCount = 0
    for ($cy = $ry; $cy -lt $ry + $rh; $cy++) {
        for ($cx = $rx; $cx -lt $rx + $rw; $cx++) {
            $pixel = $sourceBitmap.GetPixel($cx, $cy)
            if ($pixel.A -eq 0) { continue }
            $minX = [Math]::Min($minX, $cx)
            $minY = [Math]::Min($minY, $cy)
            $maxX = [Math]::Max($maxX, $cx)
            $maxY = [Math]::Max($maxY, $cy)
            $visibleCount++
            if ($trackReconstruction) {
                if ($reconstructed.GetPixel($cx, $cy).A -ne 0) { $script:overlapCount++ }
                $reconstructed.SetPixel($cx, $cy, $pixel)
            }
        }
    }
    if ($visibleCount -eq 0) { throw "Empty component: $($definition.id)" }
    $left = [Math]::Max($rx, $minX - 2)
    $top = [Math]::Max($ry, $minY - 2)
    $right = [Math]::Min($rx + $rw - 1, $maxX + 2)
    $bottom = [Math]::Min($ry + $rh - 1, $maxY + 2)
    $width = $right - $left + 1
    $height = $bottom - $top + 1
    $cropRect = [System.Drawing.Rectangle]::new($left, $top, $width, $height)
    $cropped = $sourceBitmap.Clone($cropRect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $outputPath = Join-Path $detailRoot $definition.file
    New-Item -ItemType Directory -Path (Split-Path -Parent $outputPath) -Force | Out-Null
    $cropped.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $cropped.Dispose()
    return [pscustomobject]@{
        id = $definition.id
        label = $definition.label
        file = $definition.file
        x = $left
        y = $top
        width = $width
        height = $height
        visiblePixels = $visibleCount
        pivot = @(0,0)
    }
}

foreach ($definition in $config.components) { $components.Add((Export-Component $definition $true)) }
foreach ($definition in $config.presets) { $presets.Add((Export-Component $definition $false)) }

$residualCount = 0
for ($cy = 0; $cy -lt $sourceBitmap.Height; $cy++) {
    for ($cx = 0; $cx -lt $sourceBitmap.Width; $cx++) {
        $pixel = $sourceBitmap.GetPixel($cx,$cy)
        if ($pixel.A -gt 0 -and $reconstructed.GetPixel($cx,$cy).A -eq 0) {
            $residual.SetPixel($cx,$cy,$pixel)
            $reconstructed.SetPixel($cx,$cy,$pixel)
            $residualCount++
        }
    }
}
$verifyRoot = Join-Path $detailRoot '校验'
New-Item -ItemType Directory -Path $verifyRoot -Force | Out-Null
$residual.Save((Join-Path $verifyRoot '边缘残留.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$reconstructed.Save((Join-Path $verifyRoot '原位重组.png'),[System.Drawing.Imaging.ImageFormat]::Png)

$mismatchCount = 0
$alphaMismatchCount = 0
for ($cy = 0; $cy -lt $sourceBitmap.Height; $cy++) {
    for ($cx = 0; $cx -lt $sourceBitmap.Width; $cx++) {
        $a = $sourceBitmap.GetPixel($cx,$cy)
        $b = $reconstructed.GetPixel($cx,$cy)
        if ($a.A -ne $b.A) { $alphaMismatchCount++ }
        if (($a.A -gt 0 -or $b.A -gt 0) -and $a.ToArgb() -ne $b.ToArgb()) { $mismatchCount++ }
    }
}
$sourceHashAfter = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
$manifest = [ordered]@{
    method = 'Original pixel crop; no generation, resampling, recoloring or alpha thresholding'
    source = '../UI.png'
    sourceSha256 = $sourceHashBefore
    canvas = @{width=$sourceBitmap.Width;height=$sourceBitmap.Height}
    coordinateSystem = 'top-left origin; native pixels; no scale'
    components = @($components.ToArray())
    presets = @($presets.ToArray())
    residual = @{file='校验/边缘残留.png';x=0;y=0;width=$sourceBitmap.Width;height=$sourceBitmap.Height;visiblePixels=$residualCount}
    validation = @{
        visibleRgbaMismatchPixels=$mismatchCount
        alphaMismatchPixels=$alphaMismatchCount
        componentOverlapPixels=$overlapCount
        sourceUnchanged=($sourceHashBefore -eq $sourceHashAfter)
        transparentRgbIgnored=$true
    }
}
$manifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $detailRoot 'layout.json') -Encoding utf8
$sourceBitmap.Dispose()
$reconstructed.Dispose()
$residual.Dispose()
if ($mismatchCount -ne 0 -or $alphaMismatchCount -ne 0 -or $overlapCount -ne 0 -or $sourceHashBefore -ne $sourceHashAfter) { throw 'Pixel reconstruction validation failed.' }
$manifest.validation | ConvertTo-Json
$components | Format-Table label,x,y,width,height,visiblePixels -AutoSize
"Residual pixels: $residualCount"


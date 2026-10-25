$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$assetRoot=$PSScriptRoot
$layout=Get-Content -LiteralPath (Join-Path $assetRoot 'layout.json') -Raw | ConvertFrom-Json
$source=[System.Drawing.Bitmap]::new((Join-Path (Split-Path -Parent $assetRoot) 'UI.png'))
$combined=[System.Drawing.Bitmap]::new($source.Width,$source.Height,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$duplicates=0
foreach($part in @($layout.components)+@($layout.residual)){
    $image=[System.Drawing.Bitmap]::new((Join-Path $assetRoot $part.file))
    for($y=0;$y -lt $image.Height;$y++){
        for($x=0;$x -lt $image.Width;$x++){
            $pixel=$image.GetPixel($x,$y)
            if($pixel.A -eq 0){continue}
            $targetX=$x+[int]$part.x
            $targetY=$y+[int]$part.y
            if($combined.GetPixel($targetX,$targetY).A -gt 0){$duplicates++}
            $combined.SetPixel($targetX,$targetY,$pixel)
        }
    }
    $image.Dispose()
}
$mismatches=0
$alphaMismatches=0
for($y=0;$y -lt $source.Height;$y++){
    for($x=0;$x -lt $source.Width;$x++){
        $a=$source.GetPixel($x,$y)
        $b=$combined.GetPixel($x,$y)
        if($a.A -ne $b.A){$alphaMismatches++}
        if(($a.A -gt 0 -or $b.A -gt 0) -and $a.ToArgb() -ne $b.ToArgb()){$mismatches++}
    }
}
$combined.Save((Join-Path $assetRoot '校验/原位重组.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$validation=[ordered]@{checkedFromExportedPng=$true;visibleRgbaMismatchPixels=$mismatches;alphaMismatchPixels=$alphaMismatches;overlapPixels=$duplicates;sourceSha256=(Get-FileHash -LiteralPath (Join-Path (Split-Path -Parent $assetRoot) 'UI.png') -Algorithm SHA256).Hash}
$validation|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $assetRoot '校验/检查结果.json') -Encoding utf8
if($mismatches -ne 0 -or $alphaMismatches -ne 0 -or $duplicates -ne 0){throw 'Exported PNG reconstruction mismatch'}
$combined.Dispose()
$source.Dispose()

$sheet=[System.Drawing.Bitmap]::new(1020,690)
$graphics=[System.Drawing.Graphics]::FromImage($sheet)
$graphics.Clear([System.Drawing.Color]::FromArgb(237,233,223))
$font=[System.Drawing.Font]::new('Microsoft YaHei',14)
$heading=[System.Drawing.Font]::new('Microsoft YaHei',21,[System.Drawing.FontStyle]::Bold)
$ink=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(35,32,30))
$line=[System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(180,172,158))
$graphics.DrawString('开始界面 · 原图像素拆分',$heading,$ink,22,16)
$graphics.DrawString('9 个独立组件 · 颜色/字形/透明度保持原样',$font,$ink,22,53)
for($i=0;$i -lt $layout.components.Count;$i++){
    $part=$layout.components[$i]
    $col=$i%3
    $row=[Math]::Floor($i/3)
    $left=18+$col*336
    $top=100+$row*190
    $graphics.DrawRectangle($line,$left,$top,322,174)
    $graphics.DrawString($part.label,$font,$ink,$left+12,$top+9)
    $image=[System.Drawing.Bitmap]::new((Join-Path $assetRoot $part.file))
    $scale=[Math]::Min(294.0/$image.Width,112.0/$image.Height)
    $width=[single]($image.Width*$scale)
    $height=[single]($image.Height*$scale)
    $graphics.DrawImage($image,[System.Drawing.RectangleF]::new([single]($left+(322-$width)/2),[single]($top+45+(115-$height)/2),$width,$height))
    $image.Dispose()
}
$sheet.Save((Join-Path $assetRoot '组件预览.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$sheet.Dispose()
$font.Dispose()
$heading.Dispose()
$ink.Dispose()
$line.Dispose()
$validation|ConvertTo-Json


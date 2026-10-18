$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
public static class SelectionAssetBounds {
  public static Rectangle Find(Bitmap b, int cutoff) {
    int minX=b.Width,minY=b.Height,maxX=-1,maxY=-1;
    for(int y=0;y<b.Height;y++) for(int x=0;x<b.Width;x++) {
      if(b.GetPixel(x,y).A>=cutoff) {
        if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y;
      }
    }
    return maxX<0?Rectangle.Empty:Rectangle.FromLTRB(minX,minY,maxX+1,maxY+1);
  }
}
'@ -ReferencedAssemblies @([System.Drawing.Bitmap].Assembly.Location,[System.Drawing.Rectangle].Assembly.Location)

$selectionRoot = 'C:\Users\Administrator\Desktop\蜡笔画\产出\角色选择界面拆解'
$selectionIndex = Get-Content -LiteralPath (Join-Path $selectionRoot '生成文件索引.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$roleTargets = @{
'暗影刺客' = [System.Drawing.Rectangle]::new(745,41,690,685)
'流浪剑士' = [System.Drawing.Rectangle]::new(737,35,729,660)
'森林游侠' = [System.Drawing.Rectangle]::new(906,29,575,670)
}
$alignmentRecords = @()
foreach ($assetEntry in $selectionIndex) {
  $roleDirectory = Join-Path $selectionRoot $assetEntry.role
  $assetDestination = Join-Path $roleDirectory ($assetEntry.type + '.png')
  if ($assetEntry.type -eq '人物') {
    $sourceBitmap = [System.Drawing.Bitmap]::new($assetEntry.source)
    $sourceBounds = [SelectionAssetBounds]::Find($sourceBitmap,40)
    if ($sourceBounds.IsEmpty) { throw 'Character alpha bounds are empty.' }
    $tightBitmap = $sourceBitmap.Clone($sourceBounds,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $tightBitmap.Save((Join-Path $roleDirectory '人物-裁切.png'),[System.Drawing.Imaging.ImageFormat]::Png)
    $tightBitmap.Dispose()
    $targetRegion = $roleTargets[$assetEntry.role]
    $fitScale = [Math]::Min($targetRegion.Width / [double]$sourceBounds.Width,$targetRegion.Height / [double]$sourceBounds.Height)
    $fitWidth = [int][Math]::Round($sourceBounds.Width*$fitScale)
    $fitHeight = [int][Math]::Round($sourceBounds.Height*$fitScale)
    $fitX = $targetRegion.X+[int](($targetRegion.Width-$fitWidth)/2)
    $fitY = $targetRegion.Bottom-$fitHeight
    $alignedBitmap = [System.Drawing.Bitmap]::new(1672,941,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $alignedGraphics = [System.Drawing.Graphics]::FromImage($alignedBitmap)
    $alignedGraphics.Clear([System.Drawing.Color]::Transparent)
    $alignedGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $alignedGraphics.DrawImage($sourceBitmap,[System.Drawing.Rectangle]::new($fitX,$fitY,$fitWidth,$fitHeight),$sourceBounds,[System.Drawing.GraphicsUnit]::Pixel)
    $alignedGraphics.Dispose()
    if ([SelectionAssetBounds]::Find($alignedBitmap,40).IsEmpty) { throw 'Aligned character is empty.' }
    $alignedBitmap.Save($assetDestination,[System.Drawing.Imaging.ImageFormat]::Png)
    $alignedBitmap.Dispose()
    $sourceBitmap.Dispose()
    $alignmentRecords += [pscustomobject]@{role=$assetEntry.role;sourceAlphaBounds=@($sourceBounds.X,$sourceBounds.Y,$sourceBounds.Width,$sourceBounds.Height);alignedBounds=@($fitX,$fitY,$fitWidth,$fitHeight);canvas=@(1672,941)}
  } elseif ($assetEntry.type -eq 'UI-无字') {
    $uiSourceBitmap = [System.Drawing.Bitmap]::new($assetEntry.source)
    $uiBitmap = [System.Drawing.Bitmap]::new(1672,941,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $uiGraphics = [System.Drawing.Graphics]::FromImage($uiBitmap)
    $uiGraphics.Clear([System.Drawing.Color]::Transparent)
    $uiGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $uiGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $uiRegions = @(
      [System.Drawing.Rectangle]::new(137,184,616,574),
      [System.Drawing.Rectangle]::new(551,662,545,138),
      [System.Drawing.Rectangle]::new(1094,685,79,100),
      [System.Drawing.Rectangle]::new(29,630,115,139),
      [System.Drawing.Rectangle]::new(1500,630,145,140),
      [System.Drawing.Rectangle]::new(589,758,485,183),
      [System.Drawing.Rectangle]::new(1498,72,85,70)
    )
    foreach ($uiRegion in $uiRegions) { $uiGraphics.DrawImage($uiSourceBitmap,$uiRegion,$uiRegion,[System.Drawing.GraphicsUnit]::Pixel) }
    if ($assetEntry.role -eq '暗影刺客') {
      $treeSourceEntry = $selectionIndex | Where-Object { $_.role -eq '森林游侠' -and $_.type -eq 'UI-无字' }
      $treeBitmap = [System.Drawing.Bitmap]::new($treeSourceEntry.source)
      $treeRegion = [System.Drawing.Rectangle]::new(1498,72,85,70)
      $uiGraphics.DrawImage($treeBitmap,$treeRegion,$treeRegion,[System.Drawing.GraphicsUnit]::Pixel)
      $treeBitmap.Dispose()
    }
    $uiGraphics.Dispose()
    $uiBitmap.Save($assetDestination,[System.Drawing.Imaging.ImageFormat]::Png)
    $componentDirectory = Join-Path $roleDirectory 'UI组件'
    New-Item -ItemType Directory -Path $componentDirectory -Force | Out-Null
    $componentRegions = @(
      @{Name='返回按钮.png';Rect=[System.Drawing.Rectangle]::new(29,630,115,139)},
      @{Name='确认按钮.png';Rect=[System.Drawing.Rectangle]::new(1500,630,145,140)},
      @{Name='下一项按钮.png';Rect=[System.Drawing.Rectangle]::new(1094,685,79,100)}
    )
    foreach ($componentRegion in $componentRegions) {
      $componentBitmap = $uiBitmap.Clone($componentRegion.Rect,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      $componentBitmap.Save((Join-Path $componentDirectory $componentRegion.Name),[System.Drawing.Imaging.ImageFormat]::Png)
      $componentBitmap.Dispose()
    }
    $uiBitmap.Dispose()
    $uiSourceBitmap.Dispose()
  } else {
    Copy-Item -LiteralPath $assetEntry.source -Destination $assetDestination
  }
}
$alignmentRecords | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $selectionRoot '人物位置.json') -Encoding UTF8
$roleList = @('暗影刺客','流浪剑士','森林游侠')
$contactBitmap = [System.Drawing.Bitmap]::new(1000,1689)
$contactGraphics = [System.Drawing.Graphics]::FromImage($contactBitmap)
$contactGraphics.Clear([System.Drawing.Color]::FromArgb(242,232,207))
$contactGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$qaEntries = @()
for ($roleNumber=0;$roleNumber -lt $roleList.Length;$roleNumber++) {
  $roleDirectory = Join-Path $selectionRoot $roleList[$roleNumber]
  $compositeBitmap = [System.Drawing.Bitmap]::new(1672,941)
  $compositeGraphics = [System.Drawing.Graphics]::FromImage($compositeBitmap)
  foreach($layerName in @('背景.png','人物.png','UI-无字.png')){
    $layerBitmap = [System.Drawing.Bitmap]::new((Join-Path $roleDirectory $layerName))
    $compositeGraphics.DrawImageUnscaled($layerBitmap,0,0)
    $qaEntries += [pscustomobject]@{role=$roleList[$roleNumber];file=$layerName;width=$layerBitmap.Width;height=$layerBitmap.Height;format=$layerBitmap.PixelFormat.ToString();cornerAlpha=$layerBitmap.GetPixel(0,0).A}
    $layerBitmap.Dispose()
  }
  $compositeGraphics.Dispose()
  $compositeBitmap.Save((Join-Path $roleDirectory '无字叠层预览.png'),[System.Drawing.Imaging.ImageFormat]::Png)
  $contactGraphics.DrawImage($compositeBitmap,0,($roleNumber*563),1000,563)
  $compositeBitmap.Dispose()
}
$contactGraphics.Dispose()
$contactBitmap.Save((Join-Path $selectionRoot '三套叠层检查.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$contactBitmap.Dispose()
$qaEntries | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $selectionRoot '透明通道检查.json') -Encoding UTF8
$qaEntries | Format-Table


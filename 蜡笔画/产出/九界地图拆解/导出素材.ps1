$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System; using System.Drawing;
public static class RealmAlphaBounds {
 public static Rectangle Find(Bitmap b,int threshold){int l=b.Width,t=b.Height,r=-1,d=-1;for(int y=0;y<b.Height;y++)for(int x=0;x<b.Width;x++)if(b.GetPixel(x,y).A>=threshold){l=Math.Min(l,x);t=Math.Min(t,y);r=Math.Max(r,x);d=Math.Max(d,y);}return r<0?Rectangle.Empty:Rectangle.FromLTRB(l,t,r+1,d+1);}
}
'@ -ReferencedAssemblies @([System.Drawing.Bitmap].Assembly.Location,[System.Drawing.Rectangle].Assembly.Location)
$mapRoot='C:\Users\Administrator\Desktop\蜡笔画\产出\九界地图拆解'
$generatedRoot='C:\Users\Administrator\.codex\generated_images\01a144f0-afa2-7603-8b0a-0b0624d360a3'
$mapSources=@{
 bg=[System.Drawing.Bitmap]::new((Join-Path $generatedRoot 'exec-7c5dfe13-ea3c-4f50-ac3a-e44d7f40dc37.png'))
 ui=[System.Drawing.Bitmap]::new((Join-Path $generatedRoot 'exec-7f9641cb-b7df-4d89-a5d4-73738d9ba25b.png'))
 icons=[System.Drawing.Bitmap]::new((Join-Path $generatedRoot 'exec-4f68ab06-052a-478d-a752-ee08f4f4518c.png'))
 bases=[System.Drawing.Bitmap]::new((Join-Path $generatedRoot 'exec-28f7a45b-aca7-4909-8c29-2067d4e5393b.png'))
}
$mapSources.bg.Save((Join-Path $mapRoot '背景-无字.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$mapSources.ui.Save((Join-Path $mapRoot 'UI整层-无字.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$parts=[System.Collections.Generic.List[object]]::new()
$realmNames=@('华纳海姆','阿斯加德','亚尔夫海姆','约顿海姆','米德加德','斯瓦塔尔法海姆','穆斯贝尔海姆','尼福尔海姆','赫尔海姆')
$iconNames=@('世界图标/华纳海姆-叶片','世界图标/阿斯加德-太阳','世界图标/亚尔夫海姆-月亮','世界图标/约顿海姆-雪山','世界图标/米德加德-世界树','世界图标/斯瓦塔尔法海姆-灰山','世界图标/穆斯贝尔海姆-火焰','世界图标/尼福尔海姆-漩涡','世界图标/赫尔海姆-骷髅','通用图标/银币','通用图标/钥匙','通用图标/传送能量','通用图标/碎片','通用图标/世界树标志','通用图标/锁定','通用图标/返回箭头')
for($i=0;$i -lt 16;$i++){
 $source=$mapSources.icons;$cw=$source.Width/4.0;$ch=$source.Height/4.0
 $sx=[int][Math]::Floor(($i%4)*$cw);$sy=[int][Math]::Floor([Math]::Floor($i/4)*$ch)
 $ex=[int][Math]::Floor((($i%4)+1)*$cw);$ey=[int][Math]::Floor(([Math]::Floor($i/4)+1)*$ch)
 $size=if($i -lt 9){@(118,118)}elseif($i -eq 13){@(112,120)}elseif($i -eq 14){@(30,34)}elseif($i -eq 15){@(52,44)}else{@(56,56)}
 $parts.Add(@{name=$iconNames[$i];src='icons';roi=@($sx,$sy,($ex-$sx),($ey-$sy));size=$size})
}
$baseSpecs=@(
 @{name='通用底板/节点-普通';roi=@(20,200,320,170);size=@(310,140)},
 @{name='通用底板/节点-目标';roi=@(340,200,325,170);size=@(310,140)},
 @{name='通用底板/节点-当前';roi=@(665,200,340,170);size=@(310,140)},
 @{name='通用底板/资源栏';roi=@(1015,215,245,142);size=@(165,73)},
 @{name='通用底板/标题栏';roi=@(1265,205,330,155);size=@(280,72)},
 @{name='通用底板/底部信息栏';roi=@(28,455,737,144);size=@(880,70)},
 @{name='按钮/返回-空白底板';roi=@(765,460,213,135);size=@(225,85)},
 @{name='按钮/查看详情-空白底板';roi=@(979,460,236,135);size=@(235,85)},
 @{name='按钮/传送-空白底板';roi=@(1215,460,189,135);size=@(145,85)},
 @{name='状态底板/未解锁-灰';roi=@(1407,473,185,115);size=@(140,43)},
 @{name='状态底板/已探索-绿';roi=@(60,698,230,125);size=@(140,43)},
 @{name='状态底板/可前往-蓝';roi=@(385,698,233,125);size=@(140,43)},
 @{name='状态底板/当前所在-黄';roi=@(698,698,220,125);size=@(140,43)},
 @{name='状态底板/目标-红';roi=@(1001,698,217,125);size=@(140,43)},
 @{name='通用图标/节点选中标记';roi=@(1267,675,297,169);size=@(100,47)}
)
foreach($spec in $baseSpecs){
 $rx=$mapSources.bases.Width/1600.0;$ry=$mapSources.bases.Height/960.0
 $parts.Add(@{name=$spec.name;src='bases';roi=@([int]($spec.roi[0]*$rx),[int]($spec.roi[1]*$ry),[int]($spec.roi[2]*$rx),[int]($spec.roi[3]*$ry));size=$spec.size})
}
$nodeRects=@(@(287,181,329,157),@(662,126,364,211),@(1054,176,337,164),@(286,387,338,168),@(646,363,391,196),@(1044,386,349,166),@(272,611,347,178),@(660,612,347,178),@(1051,612,344,178))
for($i=0;$i -lt 9;$i++){$parts.Add(@{name=('节点成品/'+$realmNames[$i]+'-无字');src='ui';roi=$nodeRects[$i]})}
$mapIndex=@()
foreach($part in $parts){
 $roi=[System.Drawing.Rectangle]::new($part.roi[0],$part.roi[1],$part.roi[2],$part.roi[3])
 $cropped=$mapSources[$part.src].Clone($roi,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
 $bounds=[RealmAlphaBounds]::Find($cropped,12)
 if($bounds.IsEmpty){throw ('Empty component '+$part.name)}
 $size=if($part.ContainsKey('size')){$part.size}else{@($bounds.Width,$bounds.Height)}
 $sprite=[System.Drawing.Bitmap]::new(($size[0]+8),($size[1]+8),[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
 $g=[System.Drawing.Graphics]::FromImage($sprite);$g.Clear([System.Drawing.Color]::Transparent)
 $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 $g.DrawImage($cropped,[System.Drawing.Rectangle]::new(4,4,$size[0],$size[1]),$bounds,[System.Drawing.GraphicsUnit]::Pixel);$g.Dispose()
 $target=Join-Path $mapRoot ($part.name+'.png')
 New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
 $sprite.Save($target,[System.Drawing.Imaging.ImageFormat]::Png)
 $mapIndex += [pscustomobject]@{file=($part.name+'.png');width=$sprite.Width;height=$sprite.Height;source=$part.src;sourceRect=@(($roi.X+$bounds.X),($roi.Y+$bounds.Y),$bounds.Width,$bounds.Height);padding=4;alphaCorner=$sprite.GetPixel(0,0).A;screenPosition=if($part.src -eq 'ui'){@(($roi.X+$bounds.X-4),($roi.Y+$bounds.Y-4))}else{$null}}
 $sprite.Dispose();$cropped.Dispose()
}
$mapIndex | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $mapRoot '组件索引.json') -Encoding UTF8
$composite=[System.Drawing.Bitmap]::new(1672,941)
$g=[System.Drawing.Graphics]::FromImage($composite);$g.DrawImageUnscaled($mapSources.bg,0,0);$g.DrawImageUnscaled($mapSources.ui,0,0);$g.Dispose()
$composite.Save((Join-Path $mapRoot '无字叠层预览.png'),[System.Drawing.Imaging.ImageFormat]::Png);$composite.Dispose()
$columns=4;$cellW=300;$cellH=190;$rows=[int][Math]::Ceiling($mapIndex.Count/4.0)
$preview=[System.Drawing.Bitmap]::new(($columns*$cellW),($rows*$cellH))
$g=[System.Drawing.Graphics]::FromImage($preview);$g.Clear([System.Drawing.Color]::FromArgb(233,233,233))
$brush=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(212,212,212))
for($y=0;$y -lt $preview.Height;$y+=16){for($x=0;$x -lt $preview.Width;$x+=16){if((($x/16+$y/16)%2)-eq 0){$g.FillRectangle($brush,$x,$y,16,16)}}}
$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
for($i=0;$i -lt $mapIndex.Count;$i++){
 $sprite=[System.Drawing.Bitmap]::new((Join-Path $mapRoot $mapIndex[$i].file));$fit=[Math]::Min(($cellW-24)/[double]$sprite.Width,($cellH-24)/[double]$sprite.Height)
 $dw=[int]($sprite.Width*$fit);$dh=[int]($sprite.Height*$fit)
 $x=[int](($i%$columns)*$cellW+($cellW-$dw)/2);$y=[int]([Math]::Floor($i/$columns)*$cellH+($cellH-$dh)/2)
 $g.DrawImage($sprite,$x,$y,$dw,$dh);$sprite.Dispose()
}
$brush.Dispose();$g.Dispose();$preview.Save((Join-Path $mapRoot '独立组件预览.png'),[System.Drawing.Imaging.ImageFormat]::Png);$preview.Dispose()
foreach($source in $mapSources.Values){$source.Dispose()}
[pscustomobject]@{Components=$mapIndex.Count;NonTransparentCorners=@($mapIndex|Where-Object alphaCorner -ne 0).Count;Root=$mapRoot}|ConvertTo-Json

$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;using System.Drawing;
public static class AltarBounds{
 public static Rectangle Find(Bitmap b,int cutoff){int l=b.Width,t=b.Height,r=-1,d=-1;for(int y=0;y<b.Height;y++)for(int x=0;x<b.Width;x++)if(b.GetPixel(x,y).A>=cutoff){l=Math.Min(l,x);t=Math.Min(t,y);r=Math.Max(r,x);d=Math.Max(d,y);}return r<0?Rectangle.Empty:Rectangle.FromLTRB(l,t,r+1,d+1);}
}
'@ -ReferencedAssemblies @([System.Drawing.Bitmap].Assembly.Location,[System.Drawing.Rectangle].Assembly.Location)
$altarRoot='C:\Users\Administrator\Desktop\蜡笔画\产出\迷雾祭坛事件拆解'
$generatedRoot='C:\Users\Administrator\.codex\generated_images\01a144f0-afa2-7603-8b0a-0b0624d360a3'
$sourceNames=@{iceBg='exec-6827edac-e8c7-409a-a4b0-600aa336a1ec.png';iceUi='exec-ce38b607-04e0-495a-829d-50689cd8db5d.png';forestBg='exec-4225668a-71c5-4d44-aa3c-c394c9c9c2dd.png';forestUi='exec-20b0c9a1-26c6-4d3c-b5ca-4bf6db70c21d.png';icons='exec-d1c8b97c-5ffb-4ff3-86b9-e882e2a29ba8.png';bases='exec-c22e5256-fb83-4362-8a1e-91231ebdac7d.png'}
$sources=@{}
foreach($key in $sourceNames.Keys){$sources[$key]=[System.Drawing.Bitmap]::new((Join-Path $generatedRoot $sourceNames[$key]))}
foreach($screen in @(@{role='冰晶祭坛';bg='iceBg';ui='iceUi'},@{role='森林祭坛';bg='forestBg';ui='forestUi'})){
 $screenPath=Join-Path $altarRoot $screen.role
 New-Item -ItemType Directory -Path $screenPath -Force|Out-Null
 foreach($layer in @(@{key=$screen.bg;name='背景-无字.png';transparent=$false},@{key=$screen.ui;name='UI整层-无字.png';transparent=$true})){
  $format=if($layer.transparent){[System.Drawing.Imaging.PixelFormat]::Format32bppArgb}else{[System.Drawing.Imaging.PixelFormat]::Format24bppRgb}
  $canvas=[System.Drawing.Bitmap]::new(1672,941,$format)
  $g=[System.Drawing.Graphics]::FromImage($canvas);$g.Clear([System.Drawing.Color]::Transparent);$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($sources[$layer.key],0,0,1672,941)
  if($layer.key -eq 'iceBg'){
   $g.DrawImage($sources.iceBg,[System.Drawing.Rectangle]::new(24,109,1032,807),[System.Drawing.Rectangle]::new(24,108,1032,795),[System.Drawing.GraphicsUnit]::Pixel)
  }
  $g.Dispose();$canvas.Save((Join-Path $screenPath $layer.name),[System.Drawing.Imaging.ImageFormat]::Png)
  if($layer.transparent){$sources[$screen.ui].Dispose();$sources[$screen.ui]=$canvas.Clone([System.Drawing.Rectangle]::new(0,0,1672,941),[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)}
  $canvas.Dispose()
 }
 $composite=[System.Drawing.Bitmap]::new(1672,941);$g=[System.Drawing.Graphics]::FromImage($composite)
 foreach($file in @('背景-无字.png','UI整层-无字.png')){$b=[System.Drawing.Bitmap]::new((Join-Path $screenPath $file));$g.DrawImageUnscaled($b,0,0);$b.Dispose()}
 $g.Dispose();$composite.Save((Join-Path $screenPath '无字叠层预览.png'),[System.Drawing.Imaging.ImageFormat]::Png);$composite.Dispose()
}
$parts=[System.Collections.Generic.List[object]]::new()
$iconNames=@('山脉','生命','卡牌','金币','叶片','背包','森林群','设置','帮助','调查','金币堆','祈祷','生命消耗','折叠地图','卷轴地图','离开-橙箭头','离开-弯箭头','右侧箭头','竖分隔线','选中强调线')
$iconSizes=@(@(103,65),@(49,48),@(55,53),@(50,50),@(53,55),@(54,56),@(100,49),@(48,48),@(48,48),@(57,65),@(63,55),@(57,63),@(48,65),@(112,92),@(128,110),@(57,45),@(67,60),@(20,34),@(8,43),@(41,66))
for($i=0;$i -lt 20;$i++){
 $cw=$sources.icons.Width/4.0;$ch=$sources.icons.Height/5.0
 $x=[int][Math]::Floor(($i%4)*$cw);$y=[int][Math]::Floor([Math]::Floor($i/4)*$ch)
 $ex=[int][Math]::Floor((($i%4)+1)*$cw);$ey=[int][Math]::Floor(([Math]::Floor($i/4)+1)*$ch)
 $parts.Add(@{name=('共用图标/'+$iconNames[$i]);src='icons';roi=@($x,$y,($ex-$x),($ey-$y));size=$iconSizes[$i]})
}
$baseSpecs=@(
 @{name='共用底板/选项-蓝';roi=@(15,177,345,130);size=@(540,76)},
 @{name='共用底板/选项-黄';roi=@(372,177,345,130);size=@(540,76)},
 @{name='共用底板/选项-绿';roi=@(726,177,350,130);size=@(540,76)},
 @{name='共用底板/选项-桃';roi=@(1086,177,360,130);size=@(540,76)},
 @{name='共用底板/选项-黄色选中';roi=@(0,482,413,140);size=@(580,100)},
 @{name='共用底板/选项-红色内框';roi=@(416,484,332,135);size=@(480,85)},
 @{name='共用底板/选项-蓝色内框';roi=@(760,484,341,135);size=@(480,85)},
 @{name='共用底板/选项-灰';roi=@(1114,484,332,135);size=@(480,85)},
 @{name='共用底板/标题-矩形';roi=@(30,779,305,125);size=@(340,76)},
 @{name='共用底板/标题-石叶装饰';roi=@(344,740,489,191);size=@(550,150)},
 @{name='共用底板/黄色提示条';roi=@(844,799,396,105);size=@(500,45)},
 @{name='共用底板/功能按钮';roi=@(1250,787,192,122);size=@(135,65)}
)
foreach($spec in $baseSpecs){$sx=$sources.bases.Width/1448.0;$sy=$sources.bases.Height/1086.0;$parts.Add(@{name=$spec.name;src='bases';roi=@([int]($spec.roi[0]*$sx),[int]($spec.roi[1]*$sy),[int]($spec.roi[2]*$sx),[int]($spec.roi[3]*$sy));size=$spec.size})}
$nativeSpecs=@(
 @{name='冰晶祭坛/独立UI/调查-无字';src='iceUi';roi=@(1094,573,552,84)},
 @{name='冰晶祭坛/独立UI/献币-无字';src='iceUi';roi=@(1094,663,552,81)},
 @{name='冰晶祭坛/独立UI/祈祷-无字';src='iceUi';roi=@(1094,752,552,83)},
 @{name='冰晶祭坛/独立UI/离开-无字';src='iceUi';roi=@(1094,839,552,73)},
 @{name='冰晶祭坛/独立UI/地图导航-无字';src='iceUi';roi=@(6,820,275,109)},
 @{name='冰晶祭坛/独立UI/事件角标-无字';src='iceUi';roi=@(32,118,249,82)},
 @{name='冰晶祭坛/独立UI/红色事件条-无字';src='iceUi';roi=@(1205,195,335,53)},
 @{name='冰晶祭坛/独立UI/顶部状态栏-无字';src='iceUi';roi=@(0,0,1672,90)},
 @{name='森林祭坛/独立UI/调查-无字';src='forestUi';roi=@(1081,482,591,105)},
 @{name='森林祭坛/独立UI/献币-无字';src='forestUi';roi=@(1133,588,497,101)},
 @{name='森林祭坛/独立UI/献血-无字';src='forestUi';roi=@(1133,692,498,99)},
 @{name='森林祭坛/独立UI/离开-无字';src='forestUi';roi=@(1136,795,496,102)},
 @{name='森林祭坛/独立UI/地图导航-无字';src='forestUi';roi=@(20,762,287,164)},
 @{name='森林祭坛/独立UI/蓝色事件条-无字';src='forestUi';roi=@(1244,249,193,46)},
 @{name='森林祭坛/独立UI/顶部状态栏-无字';src='forestUi';roi=@(0,0,1672,90)}
)
foreach($spec in $nativeSpecs){$parts.Add($spec)}
$index=@()
foreach($part in $parts){
 $roi=[System.Drawing.Rectangle]::new($part.roi[0],$part.roi[1],$part.roi[2],$part.roi[3])
 $cut=$sources[$part.src].Clone($roi,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
 $bounds=[AltarBounds]::Find($cut,12)
 if($bounds.IsEmpty){throw ('Empty component '+$part.name)}
 $size=if($part.ContainsKey('size')){$part.size}else{@($bounds.Width,$bounds.Height)}
 $bitmap=[System.Drawing.Bitmap]::new(($size[0]+8),($size[1]+8),[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
 $g=[System.Drawing.Graphics]::FromImage($bitmap);$g.Clear([System.Drawing.Color]::Transparent);$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 $g.DrawImage($cut,[System.Drawing.Rectangle]::new(4,4,$size[0],$size[1]),$bounds,[System.Drawing.GraphicsUnit]::Pixel);$g.Dispose()
 $path=Join-Path $altarRoot ($part.name+'.png');New-Item -ItemType Directory -Path (Split-Path $path) -Force|Out-Null
 $bitmap.Save($path,[System.Drawing.Imaging.ImageFormat]::Png)
 $index += [pscustomobject]@{file=($part.name+'.png');width=$bitmap.Width;height=$bitmap.Height;source=$part.src;sourceRect=@(($roi.X+$bounds.X),($roi.Y+$bounds.Y),$bounds.Width,$bounds.Height);padding=4;alphaCorner=$bitmap.GetPixel(0,0).A;screenPosition=if($part.src -in @('iceUi','forestUi')){@(($roi.X+$bounds.X-4),($roi.Y+$bounds.Y-4))}else{$null}}
 $bitmap.Dispose();$cut.Dispose()
}
$index|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $altarRoot '组件索引.json') -Encoding UTF8
$columns=4;$cw=300;$ch=190;$rows=[int][Math]::Ceiling($index.Count/4.0)
$preview=[System.Drawing.Bitmap]::new(($cw*$columns),($ch*$rows));$g=[System.Drawing.Graphics]::FromImage($preview);$g.Clear([System.Drawing.Color]::FromArgb(233,233,233))
$brush=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(212,212,212))
for($y=0;$y -lt $preview.Height;$y+=16){for($x=0;$x -lt $preview.Width;$x+=16){if((($x/16+$y/16)%2)-eq 0){$g.FillRectangle($brush,$x,$y,16,16)}}}
$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
for($i=0;$i -lt $index.Count;$i++){
 $b=[System.Drawing.Bitmap]::new((Join-Path $altarRoot $index[$i].file));$fit=[Math]::Min(($cw-24)/[double]$b.Width,($ch-24)/[double]$b.Height);$w=[int]($b.Width*$fit);$h=[int]($b.Height*$fit)
 $x=[int](($i%4)*$cw+($cw-$w)/2);$y=[int]([Math]::Floor($i/4)*$ch+($ch-$h)/2);$g.DrawImage($b,$x,$y,$w,$h);$b.Dispose()
}
$brush.Dispose();$g.Dispose();$preview.Save((Join-Path $altarRoot '独立组件预览.png'),[System.Drawing.Imaging.ImageFormat]::Png);$preview.Dispose()
foreach($b in $sources.Values){$b.Dispose()}
[pscustomobject]@{Components=$index.Count;TransparentCorners=@($index|Where-Object alphaCorner -eq 0).Count}|ConvertTo-Json

$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;using System.Drawing;
public static class BattleBounds{
 public static Rectangle Find(Bitmap b,int cutoff){int l=b.Width,t=b.Height,r=-1,d=-1;for(int y=0;y<b.Height;y++)for(int x=0;x<b.Width;x++)if(b.GetPixel(x,y).A>=cutoff){l=Math.Min(l,x);t=Math.Min(t,y);r=Math.Max(r,x);d=Math.Max(d,y);}return r<0?Rectangle.Empty:Rectangle.FromLTRB(l,t,r+1,d+1);}
}
'@ -ReferencedAssemblies @([System.Drawing.Bitmap].Assembly.Location,[System.Drawing.Rectangle].Assembly.Location)
$root='C:\Users\Administrator\Desktop\蜡笔画\产出\战斗界面拆解'
$inputData=Get-Content -LiteralPath (Join-Path $root '处理输入.json') -Raw -Encoding UTF8|ConvertFrom-Json
$sources=@{}
foreach($property in $inputData.sources.PSObject.Properties){$sources[$property.Name]=[System.Drawing.Bitmap]::new($property.Value)}
$paper=[System.Drawing.Bitmap]::new($inputData.paper)
$base=[System.Drawing.Bitmap]::new(1672,941,[System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g=[System.Drawing.Graphics]::FromImage($base);$g.DrawImage($paper,0,0,1672,941);$g.Dispose();$paper.Dispose()
New-Item -ItemType Directory -Path (Join-Path $root '共用背景') -Force|Out-Null
$base.Save((Join-Path $root '共用背景/羊皮纸底.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$placement=@()
function Save-BattleImage($bitmap,$relative){$p=Join-Path $root $relative;New-Item -ItemType Directory -Path (Split-Path $p) -Force|Out-Null;$bitmap.Save($p,[System.Drawing.Imaging.ImageFormat]::Png)}
function New-TransparentCanvas($w,$h){return [System.Drawing.Bitmap]::new([int]$w,[int]$h,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)}
foreach($screen in $inputData.screens){
 $source=$sources[$screen.role+'/场景-透明'];$bounds=[BattleBounds]::Find($source,16)
 if($bounds.IsEmpty){throw 'Empty scene'}
 $cut=$source.Clone($bounds,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb);Save-BattleImage $cut ($screen.role+'/场景-裁切.png');$cut.Dispose()
 $canvas=New-TransparentCanvas 1672 941;$g=[System.Drawing.Graphics]::FromImage($canvas);$g.Clear([System.Drawing.Color]::Transparent);$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 $rect=[System.Drawing.Rectangle]::new($screen.sceneRect[0],$screen.sceneRect[1],$screen.sceneRect[2],$screen.sceneRect[3]);$g.DrawImage($source,$rect,$bounds,[System.Drawing.GraphicsUnit]::Pixel);$g.Dispose()
 Save-BattleImage $canvas ($screen.role+'/场景-透明.png');$canvas.Dispose()
 $ui=New-TransparentCanvas 1672 941;$g=[System.Drawing.Graphics]::FromImage($ui);$g.Clear([System.Drawing.Color]::Transparent);$g.DrawImage($sources[$screen.role+'/UI整层-无字'],0,0,1672,941);$g.Dispose();Save-BattleImage $ui ($screen.role+'/UI整层-无字.png');$ui.Dispose()
 $background=[System.Drawing.Bitmap]::new(1672,941,[System.Drawing.Imaging.PixelFormat]::Format24bppRgb);$g=[System.Drawing.Graphics]::FromImage($background);$g.DrawImageUnscaled($base,0,0)
 $scene=[System.Drawing.Bitmap]::new((Join-Path $root ($screen.role+'/场景-透明.png')));$g.DrawImageUnscaled($scene,0,0);$g.Dispose();$scene.Dispose();Save-BattleImage $background ($screen.role+'/背景-无字.png');$background.Dispose()
 $placement += [pscustomobject]@{type='scene';name=$screen.role;sourceBounds=@($bounds.X,$bounds.Y,$bounds.Width,$bounds.Height);screenRect=$screen.sceneRect}
}
foreach($monster in $inputData.monsters){
 $source=$sources['怪物/'+$monster.name];$bounds=[BattleBounds]::Find($source,16);if($bounds.IsEmpty){throw 'Empty monster'}
 $tight=New-TransparentCanvas ($bounds.Width+16) ($bounds.Height+16);$g=[System.Drawing.Graphics]::FromImage($tight);$g.Clear([System.Drawing.Color]::Transparent);$g.DrawImage($source,[System.Drawing.Rectangle]::new(8,8,$bounds.Width,$bounds.Height),$bounds,[System.Drawing.GraphicsUnit]::Pixel);$g.Dispose();Save-BattleImage $tight ('怪物/'+$monster.name+'-透明.png');$tight.Dispose()
 $fit=[Math]::Min($monster.rect[2]/[double]$bounds.Width,$monster.rect[3]/[double]$bounds.Height)
 $w=[int][Math]::Round($bounds.Width*$fit);$h=[int][Math]::Round($bounds.Height*$fit);$x=[int]($monster.rect[0]+($monster.rect[2]-$w)/2);$y=[int]($monster.rect[1]+$monster.rect[3]-$h)
 $canvas=New-TransparentCanvas 1672 941;$g=[System.Drawing.Graphics]::FromImage($canvas);$g.Clear([System.Drawing.Color]::Transparent);$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;$g.DrawImage($source,[System.Drawing.Rectangle]::new($x,$y,$w,$h),$bounds,[System.Drawing.GraphicsUnit]::Pixel);$g.Dispose()
 Save-BattleImage $canvas ($monster.role+'/怪物图层/'+$monster.name+'.png');$canvas.Dispose()
 $placement += [pscustomobject]@{type='monster';name=$monster.name;role=$monster.role;screenRect=@($x,$y,$w,$h);sourceBounds=@($bounds.X,$bounds.Y,$bounds.Width,$bounds.Height)}
}
$parts=[System.Collections.Generic.List[object]]::new()
$iconNames=@('斧头','护盾','符文','生命','乌鸦','叶片','中毒','灼烧','虚弱','专注','治疗药水','能量','靴子','增益箭头','目标','锁定','重投','抽牌','道具袋','设置','帮助','山脉','连击双斧','重击锤')
$iconRects=@(@(32,70,215,220),@(299,75,184,213),@(537,75,210,210),@(784,85,208,189),@(31,312,221,232),@(294,305,190,242),@(545,316,193,219),@(790,302,207,235),@(60,560,180,206),@(285,555,209,216),@(541,543,198,240),@(791,566,203,198),@(40,796,202,217),@(295,791,196,224),@(535,793,218,229),@(793,790,207,225),@(38,1033,212,228),@(287,1032,219,238),@(538,1034,213,237),@(790,1035,211,235),@(35,1277,214,246),@(270,1280,239,240),@(531,1280,221,238),@(789,1279,218,244))
for($i=0;$i -lt 24;$i++){
 $src=$sources['共用图标图集'];$cw=$src.Width/4.0;$ch=$src.Height/6.0;$x=[int][Math]::Floor(($i%4)*$cw);$y=[int][Math]::Floor([Math]::Floor($i/4)*$ch);$ex=[int][Math]::Floor((($i%4)+1)*$cw);$ey=[int][Math]::Floor(([Math]::Floor($i/4)+1)*$ch)
 $parts.Add(@{name=('共用图标/'+$iconNames[$i]);src='共用图标图集';roi=$iconRects[$i];max=@(88,88)})
}
$bases=@(
 @{name='卡框-红';roi=@(80,10,240,315);size=@(175,280)},@{name='卡框-蓝';roi=@(370,10,238,315);size=@(175,280)},@{name='卡框-绿';roi=@(655,10,240,315);size=@(175,280)},@{name='卡框-紫';roi=@(938,10,240,315);size=@(175,280)},
 @{name='卡框-黄';roi=@(80,326,240,300);size=@(175,280)},@{name='骰子-普通';roi=@(388,391,185,190);size=@(105,105)},@{name='骰子-选中';roi=@(631,350,260,264);size=@(145,145)},@{name='骰子-已使用';roi=@(963,391,189,190);size=@(105,105)},
 @{name='状态槽';roi=@(65,642,141,128);size=@(55,55)},@{name='血条';roi=@(235,673,335,70);size=@(205,24)},@{name='结束回合-空白';roi=@(584,621,350,146);size=@(250,90)},@{name='操作按钮-蓝';roi=@(937,628,265,140);size=@(175,80)},
 @{name='标题标签';roi=@(38,803,277,102);size=@(180,45)},@{name='玩家面板-空白';roi=@(329,775,307,465);size=@(280,520)},@{name='记录面板-空白';roi=@(643,775,296,465);size=@(300,500)},@{name='意图面板-空白';roi=@(958,834,257,255);size=@(160,160)}
)
foreach($spec in $bases){$scale=$sources['共用底板图集'].Width/1254.0;$parts.Add(@{name=('共用底板/'+$spec.name);src='共用底板图集';roi=@([int]($spec.roi[0]*$scale),[int]($spec.roi[1]*$scale),[int]($spec.roi[2]*$scale),[int]($spec.roi[3]*$scale));size=$spec.size})}
$native=@(
 @{role='寒雾林地';name='重投';roi=@(1104,483,170,74)},@{role='寒雾林地';name='抽牌';roi=@(1103,564,172,77)},@{role='寒雾林地';name='道具袋';roi=@(1280,797,179,111)},@{role='寒雾林地';name='结束回合';roi=@(1458,797,207,111)},
 @{role='寒雾林地';name='巨人信息';roi=@(224,102,242,227)},@{role='寒雾林地';name='萨满信息';roi=@(1276,102,245,228)},@{role='寒雾林地';name='目标信息';roi=@(1287,490,380,166)},@{role='寒雾林地';name='牌堆信息';roi=@(1295,653,368,138)},
 @{role='沼泽边地';name='重投';roi=@(12,781,293,71)},@{role='沼泽边地';name='抽牌';roi=@(12,856,293,77)},@{role='沼泽边地';name='结束回合';roi=@(1360,794,300,128)},@{role='沼泽边地';name='玩家信息';roi=@(7,63,300,715)},@{role='沼泽边地';name='战斗记录';roi=@(1351,62,321,520)},@{role='沼泽边地';name='敌人意图';roi=@(1125,256,219,161)},
 @{role='石崖小道';name='重投';roi=@(305,516,200,108)},@{role='石崖小道';name='抽牌';roi=@(1156,516,196,108)},@{role='石崖小道';name='结束回合';roi=@(1387,801,272,115)},@{role='石崖小道';name='玩家信息';roi=@(0,60,288,873)},@{role='石崖小道';name='敌人信息';roi=@(1355,53,317,880)}
)
foreach($s in $native){$parts.Add(@{name=($s.role+'/UI组件/'+$s.name+'-无字');src=($s.role+'/UI整层-无字');roi=$s.roi;screen=$s.role})}
$diceSpecs=@(
 @{role='寒雾林地';names=@('斧头-选中','护盾','符文-选中','生命','乌鸦');rects=@(@(460,473,151,151),@(619,499,97,110),@(712,473,138,151),@(851,495,113,119),@(973,495,111,119))},
 @{role='沼泽边地';names=@('斧头-选中','护盾-已使用','符文','叶片-锁定','乌鸦');rects=@(@(429,493,188,154),@(614,514,127,131),@(759,514,139,131),@(914,514,151,131),@(1072,514,141,131))},
 @{role='石崖小道';names=@('护盾','斧头-选中','符文-已使用','叶片-锁定','乌鸦');rects=@(@(530,498,119,123),@(644,479,130,151),@(767,499,117,122),@(884,487,124,133),@(1008,499,122,121))}
)
foreach($s in $diceSpecs){for($i=0;$i -lt 5;$i++){$parts.Add(@{name=($s.role+'/UI组件/骰子-'+$s.names[$i]);src=($s.role+'/UI整层-无字');roi=$s.rects[$i];screen=$s.role})}}
$cardNames=@('狂斧重击','坚盾防御','影步闪袭','自然疗愈','符文抽牌')
$cardRects=@(@(316,642,209,299),@(529,642,198,299),@(729,642,203,299),@(931,642,205,299),@(1137,642,210,299))
for($i=0;$i -lt 5;$i++){$parts.Add(@{name=('沼泽边地/UI组件/卡牌-'+$cardNames[$i]+'-无字');src='沼泽边地/UI整层-无字';roi=$cardRects[$i];screen='沼泽边地'})}
$parts.Add(@{name='寒雾林地/UI组件/手牌整组-无字';src='寒雾林地/UI整层-无字';roi=@(383,621,919,320);screen='寒雾林地';clip=@(@(386,681),@(567,638),@(579,654),@(740,627),@(924,623),@(1105,648),@(1299,685),@(1239,941),@(431,941))})
$parts.Add(@{name='沼泽边地/UI组件/手牌整组-无字';src='沼泽边地/UI整层-无字';roi=@(313,642,1037,299);screen='沼泽边地'})
$parts.Add(@{name='石崖小道/UI组件/手牌整组-无字';src='石崖小道/UI整层-无字';roi=@(282,631,1078,310);screen='石崖小道';clip=@(@(284,706),@(493,657),@(502,678),@(695,634),@(929,636),@(1138,664),@(1358,705),@(1297,941),@(330,941))})
$index=@()
foreach($part in $parts){
 $source=$sources[$part.src];$roi=[System.Drawing.Rectangle]::new($part.roi[0],$part.roi[1],[Math]::Min($part.roi[2],$source.Width-$part.roi[0]),[Math]::Min($part.roi[3],$source.Height-$part.roi[1]));$cut=$source.Clone($roi,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
 if($part.ContainsKey('clip')){$cut.Dispose();$cut=New-TransparentCanvas $roi.Width $roi.Height;$clipGraphics=[System.Drawing.Graphics]::FromImage($cut);$clipGraphics.Clear([System.Drawing.Color]::Transparent);$path=[System.Drawing.Drawing2D.GraphicsPath]::new();[System.Drawing.PointF[]]$points=@($part.clip|ForEach-Object {[System.Drawing.PointF]::new(($_[0]-$roi.X),($_[1]-$roi.Y))});$path.AddPolygon($points);$clipGraphics.SetClip($path);$clipGraphics.DrawImageUnscaled($source,(-$roi.X),(-$roi.Y));$path.Dispose();$clipGraphics.Dispose()}
 $b=[BattleBounds]::Find($cut,16);if($b.IsEmpty){throw ('Empty component '+$part.name)}
 if($part.ContainsKey('size')){$size=$part.size}elseif($part.ContainsKey('max')){$fit=[Math]::Min($part.max[0]/[double]$b.Width,$part.max[1]/[double]$b.Height);$size=@([int][Math]::Round($b.Width*$fit),[int][Math]::Round($b.Height*$fit))}else{$size=@($b.Width,$b.Height)}
 $sprite=New-TransparentCanvas ($size[0]+8) ($size[1]+8);$g=[System.Drawing.Graphics]::FromImage($sprite);$g.Clear([System.Drawing.Color]::Transparent);$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;$g.DrawImage($cut,[System.Drawing.Rectangle]::new(4,4,$size[0],$size[1]),$b,[System.Drawing.GraphicsUnit]::Pixel);$g.Dispose();Save-BattleImage $sprite ($part.name+'.png')
 $index += [pscustomobject]@{file=($part.name+'.png');width=$sprite.Width;height=$sprite.Height;source=$part.src;sourceRect=@(($roi.X+$b.X),($roi.Y+$b.Y),$b.Width,$b.Height);padding=4;cornerAlpha=$sprite.GetPixel(0,0).A;screenPosition=if($part.ContainsKey('screen')){@(($roi.X+$b.X-4),($roi.Y+$b.Y-4))}else{$null}}
 $sprite.Dispose();$cut.Dispose()
}
$index|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $root '组件索引.json') -Encoding UTF8
$placement|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $root '图层位置.json') -Encoding UTF8
$contact=[System.Drawing.Bitmap]::new(1000,1689);$cg=[System.Drawing.Graphics]::FromImage($contact);$cg.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
for($i=0;$i -lt $inputData.screens.Count;$i++){
 $screen=$inputData.screens[$i];$result=[System.Drawing.Bitmap]::new(1672,941);$g=[System.Drawing.Graphics]::FromImage($result)
 $bg=[System.Drawing.Bitmap]::new((Join-Path $root ($screen.role+'/背景-无字.png')));$g.DrawImageUnscaled($bg,0,0);$bg.Dispose()
 foreach($name in $screen.monsters){$b=[System.Drawing.Bitmap]::new((Join-Path $root ($screen.role+'/怪物图层/'+$name+'.png')));$g.DrawImageUnscaled($b,0,0);$b.Dispose()}
 $ui=[System.Drawing.Bitmap]::new((Join-Path $root ($screen.role+'/UI整层-无字.png')));$g.DrawImageUnscaled($ui,0,0);$ui.Dispose();$g.Dispose();Save-BattleImage $result ($screen.role+'/无字叠层预览.png');$cg.DrawImage($result,0,($i*563),1000,563);$result.Dispose()
}
$cg.Dispose();Save-BattleImage $contact '三套界面预览.png';$contact.Dispose()
function Make-SpriteContact($records,$output,$cols,$cellW,$cellH){
 $rows=[int][Math]::Ceiling($records.Count/[double]$cols);$canvas=[System.Drawing.Bitmap]::new(($cols*$cellW),($rows*$cellH));$g=[System.Drawing.Graphics]::FromImage($canvas);$g.Clear([System.Drawing.Color]::FromArgb(236,236,236));$brush=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(213,213,213))
 for($y=0;$y -lt $canvas.Height;$y+=20){for($x=0;$x -lt $canvas.Width;$x+=20){if((($x/20+$y/20)%2)-eq 0){$g.FillRectangle($brush,$x,$y,20,20)}}};$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 for($i=0;$i -lt $records.Count;$i++){$b=[System.Drawing.Bitmap]::new((Join-Path $root $records[$i].file));$fit=[Math]::Min(($cellW-24)/[double]$b.Width,($cellH-24)/[double]$b.Height);$w=[int]($b.Width*$fit);$h=[int]($b.Height*$fit);$x=[int](($i%$cols)*$cellW+($cellW-$w)/2);$y=[int]([Math]::Floor($i/$cols)*$cellH+($cellH-$h)/2);$g.DrawImage($b,$x,$y,$w,$h);$b.Dispose()};$brush.Dispose();$g.Dispose();Save-BattleImage $canvas $output;$canvas.Dispose()
}
$commonIndex=@($index|Where-Object {$_.file -like '共用*'});Make-SpriteContact $commonIndex '共用组件预览.png' 4 240 220
$nativeIndex=@($index|Where-Object {$_.file -notlike '共用*'});Make-SpriteContact $nativeIndex '独立UI组件预览.png' 4 300 210
$monsterIndex=@($inputData.monsters|ForEach-Object {[pscustomobject]@{file=('怪物/'+$_.name+'-透明.png')}});Make-SpriteContact $monsterIndex '怪物预览.png' 3 380 380
foreach($b in $sources.Values){$b.Dispose()};$base.Dispose()
[pscustomobject]@{Components=$index.Count;CommonComponents=$commonIndex.Count;Monsters=$monsterIndex.Count;TransparentComponentCorners=@($index|Where-Object cornerAlpha -eq 0).Count}|ConvertTo-Json

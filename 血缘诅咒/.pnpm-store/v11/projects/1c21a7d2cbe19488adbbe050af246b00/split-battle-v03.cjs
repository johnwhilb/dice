const fs=require('fs'),path=require('path');
const base='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const sharp=require(base+'sharp');
const {createCanvas,loadImage}=require(base+'@napi-rs/canvas');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'拆分ui/战斗界面/v03拆分-v01');
const src='C:/Users/Administrator/.codex/generated_images/01a187c4-d05e-7181-a4c8-656e0d6fd295/exec-e5f96bd1-d704-4f20-b3cf-ed71849317a1.png';
const W=1672,H=941;
// Geometry clips the external scene residue; existing antialiasing is retained inside each contour.
const shapes=[
['区域标题',[[0,16],[29,16],[49,0],[70,16],[347,16],[371,30],[351,65],[70,65],[50,89],[29,65],[0,65]]],
['回合栏',[[678,40],[697,30],[701,16],[969,16],[977,30],[995,40],[977,51],[970,65],[700,65],[695,51]]],
['暂停按钮',[[1587,13],[1655,13],[1655,80],[1587,80]]],
['敌方状态栏1',[[395,103],[581,103],[617,89],[658,126],[619,168],[584,151],[406,153],[395,135]]],
['敌方状态栏2',[[723,89],[908,89],[941,89],[980,127],[941,168],[908,145],[735,145],[724,127]]],
['敌方状态栏3',[[1024,103],[1220,103],[1258,88],[1296,127],[1258,166],[1221,151],[1037,151],[1024,133]]],
['抽牌按钮',[[348,606],[373,574],[518,574],[543,606],[520,638],[372,638]]],
['骰子1',[[594,574],[606,563],[658,563],[672,576],[672,634],[658,646],[605,646],[594,634]]],
['骰子2',[[687,575],[698,562],[751,562],[765,576],[765,634],[752,647],[698,647],[687,634]]],
['骰子3',[[781,575],[793,562],[845,562],[858,576],[858,634],[846,646],[793,646],[781,634]]],
['骰子4',[[874,575],[887,562],[940,562],[952,576],[952,633],[940,647],[887,647],[874,633]]],
['骰子5',[[968,575],[979,562],[1035,562],[1047,576],[1047,633],[1035,647],[980,647],[968,633]]],
['重投按钮',[[1094,607],[1111,575],[1188,575],[1214,607],[1188,639],[1111,639]]],
['连接装饰1',[[539,601],[558,601],[573,583],[586,601],[595,601],[595,614],[585,614],[573,633],[559,614],[539,614]]],
['连接装饰2',[[1046,601],[1056,601],[1069,584],[1082,601],[1099,601],[1099,615],[1083,615],[1069,632],[1055,615],[1046,615]]],
['猎人面板',[[16,655],[360,655],[380,674],[380,814],[361,839],[16,839]]],
['技能1',[[32,841],[95,841],[95,904],[32,904]]],
['技能2',[[98,841],[159,841],[159,904],[98,904]]],
['技能3',[[162,841],[224,841],[224,904],[162,904]]],
['手牌组',[[375,677],[560,648],[571,667],[734,647],[927,646],[1102,653],[1297,678],[1264,934],[1081,910],[930,899],[749,902],[591,915],[411,934]]],
['牌库',[[1352,634],[1495,634],[1495,718],[1352,718]]],
['弃牌堆',[[1497,634],[1643,634],[1643,718],[1497,718]]],
['消耗堆',[[1352,721],[1495,721],[1495,805],[1352,805]]],
['道具袋',[[1497,721],[1643,721],[1643,805],[1497,805]]],
['结束回合',[[1305,860],[1336,815],[1625,815],[1657,860],[1625,912],[1336,912]]]
];
(async()=>{
fs.mkdirSync(path.join(out,'验收预览'),{recursive:true});fs.mkdirSync(path.join(out,'草稿组件'),{recursive:true});
const im=await loadImage(await sharp(src).resize(W,H).png().toBuffer());
const total=createCanvas(W,H),ctx=total.getContext('2d'),layout=[];
for(const [name,pts] of shapes){const c=createCanvas(W,H),g=c.getContext('2d');g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.clip();g.drawImage(im,0,0);ctx.drawImage(c,0,0);const x=Math.min(...pts.map(p=>p[0])),y=Math.min(...pts.map(p=>p[1])),w=Math.max(...pts.map(p=>p[0]))-x,h=Math.max(...pts.map(p=>p[1]))-y;const b=createCanvas(w,h);b.getContext('2d').drawImage(c,-x,-y);fs.writeFileSync(path.join(out,'草稿组件',name+'.png'),b.toBuffer('image/png'));layout.push({name,x,y,width:w,height:h,containsRasterText:true,status:'草稿，尚未完成底板图标文字精拆'});}
fs.writeFileSync(path.join(out,'UI总层-草稿.png'),total.toBuffer('image/png'));
for(const [name,color] of [['白底','#ffffff'],['深灰底','#333333'],['棋盘底',null]]){const c=createCanvas(W,H),g=c.getContext('2d');if(color){g.fillStyle=color;g.fillRect(0,0,W,H);}else{for(let y=0;y<H;y+=20)for(let x=0;x<W;x+=20){g.fillStyle=(x/20+y/20)%2?'#bbb':'#eee';g.fillRect(x,y,20,20);}}g.drawImage(total,0,0);fs.writeFileSync(path.join(out,'验收预览',name+'.png'),c.toBuffer('image/png'));}
const zoom=createCanvas(1000,520);zoom.getContext('2d').drawImage(total,340,550,500,260,0,0,1000,520);fs.writeFileSync(path.join(out,'验收预览/边缘放大.png'),zoom.toBuffer('image/png'));
fs.writeFileSync(path.join(out,'文字与布局.json'),JSON.stringify({source:'生成界面/未命名游戏-战斗界面-草稿-v03.png',canvas:[W,H],status:'草稿；文字仍为栅格，手牌遮挡处未补全，未生成PSD',components:layout},null,2));
fs.writeFileSync(path.join(out,'验收说明.txt'),'本次原图为v03，不能混用现有v07分离素材。内置imagegen两次提取透明UI后，以轮廓遮罩清理外围残留。输出1672×941 RGBA。当前仅草稿分组，非最终验收组件。保留原图UI文字和图标，尚未完成底板/图标/系统文字独立分离、手牌遮挡补全。没有匹配本原图的独立背景与三名敌人素材；现有角色人物及v07背景、敌人均非同版本。未制作PSD，不代表完整复原交付。图像原输出保留在Codex generated_images目录。');
console.log(out);
})();

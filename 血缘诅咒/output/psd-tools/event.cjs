const fs=require('fs'),path=require('path'),ag=require('ag-psd');
const deps='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {createCanvas,loadImage,GlobalFonts}=require(deps+'@napi-rs/canvas'),sharp=require(deps+'sharp');
ag.initializeCanvas(createCanvas);GlobalFonts.registerFromPath('C:/Windows/Fonts/simsun.ttc','SimSun');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'拆分ui/遭遇事件/1334x750'),W=1334,H=750,s=W/1672,t=H/941,ui=[],texts=[];
fs.mkdirSync(path.join(out,'组件'),{recursive:true});fs.mkdirSync(path.join(root,'背景'),{recursive:true});
function comp(ls){const c=createCanvas(W,H),g=c.getContext('2d');for(const l of ls){if(l.hidden)continue;g.drawImage(l.children?comp(l.children):l.canvas,l.children?0:l.left||0,l.children?0:l.top||0);}return c;}
function add(name,c,x,y){const z=createCanvas(Math.max(1,Math.round(c.width*s)),Math.max(1,Math.round(c.height*t)));z.getContext('2d').drawImage(c,0,0,z.width,z.height);ui.push({name,left:Math.round(x*s),top:Math.round(y*t),canvas:z});}
function text(name,str,x,y,size,color='#171512',bold=false){const f=size*t,c=createCanvas(Math.ceil(Math.max(...str.split('\n').map(v=>v.length))*f+12),Math.ceil(str.split('\n').length*f*1.65+8)),g=c.getContext('2d');g.font=`${bold?'bold ':''}${f}px SimSun`;g.fillStyle=color;g.textBaseline='top';str.split('\n').forEach((v,i)=>g.fillText(v,0,i*f*1.65));const left=Math.round(x*s),top=Math.round(y*t);texts.push({name:'文字_'+name,left,top,canvas:c,text:{text:str.replace(/\n/g,'\r'),transform:[1,0,0,1,left,top+f*.88],antiAlias:'sharp',shapeType:'point',style:{font:{name:'SimSun'},fontSize:f,fauxBold:bold,fillColor:{r:parseInt(color.slice(1,3),16),g:parseInt(color.slice(3,5),16),b:parseInt(color.slice(5,7),16)}}}});}
(async()=>{
const source=await loadImage(await sharp(path.join(root,'生成界面/苍白之血-遭遇事件界面-焚兽之夜-v06.png')).png().toBuffer()),plate=await loadImage(await sharp('C:/Users/Administrator/.codex/generated_images/01a16e95-675e-7f50-91dd-e0c678f33327/exec-7b716717-f45f-4b30-ae57-98fe778f4bc0.png').png().toBuffer());
const bg=createCanvas(W,H);bg.getContext('2d').drawImage(plate,0,0,W,H);fs.writeFileSync(path.join(root,'背景/焚兽之夜-无UI.png'),bg.toBuffer('image/png'));
function crop(x,y,w,h){const c=createCanvas(w,h);c.getContext('2d').drawImage(source,x,y,w,h,0,0,w,h);return c;}
function panel(name,x,y,w,h,col,cut=14){const c=crop(x,y,w,h),g=c.getContext('2d');g.clearRect(0,0,w,h);g.save();g.beginPath();[[cut,1],[w-cut,1],[w-1,cut],[w-1,h-cut],[w-cut,h-1],[cut,h-1],[1,h-cut],[1,cut]].forEach(([a,b],i)=>i?g.lineTo(a,b):g.moveTo(a,b));g.closePath();g.clip();g.drawImage(source,x,y,w,h,0,0,w,h);g.fillStyle=col;g.fillRect(cut+2,7,w-2*cut-4,h-14);if(name.startsWith('选项'))g.drawImage(source,1490,y+9,100,h-18,cut+2,7,w-2*cut-4,h-14);g.restore();add(name,c,x,y);}
const hud=crop(0,0,1672,58),hg=hud.getContext('2d');for(const [x,w]of [[115,265],[641,151],[893,99],[1095,160]]){hg.fillStyle='#1c1c1b';hg.drawImage(source,1260,6,150,43,x,6,w,43);}add('顶部资源栏_无文字',hud,0,0);
panel('事件类型底板',1141,125,171,42,'#681d18',15);
panel('选项1_选中底板',1103,507,524,98,'#681911');panel('选项2_普通底板',1103,619,524,98,'#20201e');panel('选项3_普通底板',1103,732,524,99,'#20201e');panel('地图按钮底板',30,821,269,75,'#1e1e1b',28);
// Dark-on-ivory line art: recover opacity against locally sampled paper; store solid ink RGB to avoid paper fringes.
function ink(name,x,y,w,h,color=[103,55,42]){const c=crop(x,y,w,h),g=c.getContext('2d'),d=g.getImageData(0,0,w,h);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const p=4*(j*w+i),r=d.data[p],b=d.data[p+2];const a=Math.max(0,Math.min(1,(205-(r+b)/2)/112));d.data[p]=color[0];d.data[p+1]=color[1];d.data[p+2]=color[2];d.data[p+3]=Math.round(a*255);}g.putImageData(d,0,0);add(name,c,x,y);}
ink('事件火焰纹章',1094,95,55,78);ink('标题分隔装饰',1104,256,501,29);ink('行动提示菱形',1104,466,26,20,[28,26,23]);ink('底部细装饰',1224,846,258,34);ink('右上角装饰',1550,73,108,92);ink('右下角装饰',1550,833,108,89);
// Button glyphs are isolated from opaque panel interiors, with controlled ivory coverage.
for(const[n,x,y,w,h]of [['仪式图标',1128,533,34,48],['卡牌图标',1127,645,37,48],['离开图标',1127,755,34,45],['地图图标',74,834,45,47]]){const c=crop(x,y,w,h),g=c.getContext('2d'),d=g.getImageData(0,0,w,h);for(let i=0;i<d.data.length;i+=4){const lum=(d.data[i]+d.data[i+1]+d.data[i+2])/3;d.data[i+3]=Math.round(Math.max(0,Math.min(1,(lum-105)/95))*255);d.data[i]=222;d.data[i+1]=198;d.data[i+2]=166;}g.putImageData(d,0,0);add(n,c,x,y);}
text('区域','血月教区 · 旧礼拜堂',122,18,25,'#eee9df',true);text('生命标签','生命',644,19,24,'#eee9df');text('生命当前','42',699,19,25,'#a42a21');text('生命最大','/60',741,19,25,'#eee9df');text('卡牌','卡牌 18',893,19,25,'#eee9df');text('金币','金币 126',1099,19,25,'#eee9df');text('事件类型','危险事件',1175,134,25,'#f0e7da');text('事件标题','焚兽之夜',1104,183,67,'#080808',true);text('事件描述','半兽化的村民围住火堆，挥舞着草叉。\n被缚在木桩上的同伴，已彻底化为野兽。\n混乱的祷声中，你分不清恐惧与狂热。',1107,309,23,'#15130f',true);text('行动提示','请选择一项行动',1142,465,22);
for(const[n,a,b,y]of [['仪式','加入仪式','消耗 20 金币，获得祝福',528],['余烬','搜寻余烬','失去 6 生命，获得一张卡牌',640],['离开','绕路离开','不作停留，继续探索',753]]){text(n+'标题',a,1185,y,30,'#f2eadf');text(n+'说明',b,1185,y+41,19,'#e8dfd1');}text('地图','查看地图',139,845,26,'#f3ecdf');
const total=comp([...ui,...texts]);fs.writeFileSync(path.join(out,'UI总层.png'),total.toBuffer('image/png'));
for(const l of ui)fs.writeFileSync(path.join(out,'组件',l.name+'.png'),l.canvas.toBuffer('image/png'));
const layers=[{name:'背景_事件场景（含叙事人物）',left:0,top:0,canvas:bg},{name:'UI_独立组件',children:ui},{name:'文字_系统宋体_可编辑',children:texts}];const file=path.join(out,'苍白之血-焚兽之夜-1334x750.psd');fs.writeFileSync(file,Buffer.from(ag.writePsdBuffer({width:W,height:H,children:layers,canvas:comp(layers)})));
const read=ag.readPsd(fs.readFileSync(file));const preview=comp(read.children);fs.writeFileSync(path.join(out,'复原预览.png'),preview.toBuffer('image/png'));
const compare=createCanvas(W*2,H),cg=compare.getContext('2d');cg.drawImage(source,0,0,W,H);cg.drawImage(preview,W,0);fs.writeFileSync(path.join(out,'原图对比.png'),compare.toBuffer('image/png'));
const qa=createCanvas(W*2,H),q=qa.getContext('2d');q.fillStyle='#fff';q.fillRect(0,0,W,H);q.fillStyle='#383838';q.fillRect(W,0,W,H);q.drawImage(total,0,0);q.drawImage(total,W,0);fs.writeFileSync(path.join(out,'UI边缘检查.png'),qa.toBuffer('image/png'));
fs.writeFileSync(path.join(out,'文字与布局.json'),JSON.stringify({width:W,height:H,font:'SimSun',components:ui.map(({name,left,top,canvas})=>({name,left,top,width:canvas.width,height:canvas.height})),texts:texts.map(({name,text,left,top})=>({name,left,top,...text}))},null,2));
fs.writeFileSync(path.join(out,'验收说明.txt'),'画布1334×750。普通文字为PSD原生可编辑SimSun文字层，未导出任何单独文字PNG。UI组件透明PNG已拆分。事件人物属于完整叙事插画，不冒用角色选择人物替换。背景为去UI重建场景，存在生成补绘差异；按钮内底纹为无文字重建，色块纹理与原图不完全一致。对比图左侧原图，右侧PSD实际回读复原。此版为可编辑复原稿，非像素级完全一致。');
console.log(JSON.stringify({file,components:ui.length,texts:read.children[2].children.filter(x=>x.text).length}));
})();


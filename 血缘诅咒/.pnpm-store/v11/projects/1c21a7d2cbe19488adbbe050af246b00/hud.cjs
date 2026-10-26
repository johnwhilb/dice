const fs=require('fs'),path=require('path'),ag=require('ag-psd');
const deps='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {createCanvas,loadImage}=require(deps+'@napi-rs/canvas'),sharp=require(deps+'sharp');ag.initializeCanvas(createCanvas);
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'拆分ui/遭遇事件/1334x750'),parts=path.join(dir,'组件/资源栏'),W=1334,H=750,ls=[];fs.mkdirSync(parts,{recursive:true});
function composite(a){const c=createCanvas(W,H),g=c.getContext('2d');for(const l of a){if(l.hidden)continue;g.drawImage(l.children?composite(l.children):l.canvas,l.children?0:l.left||0,l.children?0:l.top||0);}return c;}
(async()=>{const src=await loadImage(await sharp(path.join(dir,'组件/顶部资源栏_无文字.png')).png().toBuffer());
function crop(x,y,w,h){const c=createCanvas(w,h);c.getContext('2d').drawImage(src,x,y,w,h,0,0,w,h);return c;}
function add(name,c,x,y){ls.push({name,left:x,top:y,canvas:c});fs.writeFileSync(path.join(parts,name+'.png'),c.toBuffer('image/png'));}
const base=createCanvas(W,44),b=base.getContext('2d');b.drawImage(src,1010,0,150,44,0,0,W,44);add('01_资源栏底板_无图标无文字',base,0,0);
add('02_底部金色边线',crop(0,43,W,3),0,43);
// Pale engraved glyphs: invert compositing against the dark matte HUD, keeping only actual engraved strokes.
function engraving(name,x,y,w,h){const c=crop(x,y,w,h),g=c.getContext('2d'),d=g.getImageData(0,0,w,h);for(let i=0;i<d.data.length;i+=4){const r=d.data[i],v=d.data[i+1],z=d.data[i+2],a=Math.max(0,Math.min(1,(Math.max(r,v,z)-43)/175));if(a<.015){d.data[i+3]=0;continue;}for(let k=0;k<3;k++)d.data[i+k]=Math.max(0,Math.min(255,([r,v,z][k]-27*(1-a))/a));d.data[i+3]=Math.round(255*a);}g.putImageData(d,0,0);if(y+h>42)g.clearRect(0,42-y,w,h);add(name,c,x,y);}
engraving('03_区域罗盘纹章',36,0,43,44);engraving('04_左分隔纹章',321,2,17,42);engraving('05_右分隔纹章',1185,2,20,42);
// Filled medallion and paper/leather silhouettes keep their original opaque interior.
function shape(name,x,y,w,h,points){const c=crop(x,y,w,h),m=createCanvas(w,h),g=m.getContext('2d');g.fillStyle='#fff';g.beginPath();points.forEach(([a,b],i)=>i?g.lineTo(a,b):g.moveTo(a,b));g.closePath();g.fill();const q=c.getContext('2d');q.globalCompositeOperation='destination-in';q.drawImage(m,0,0);q.globalCompositeOperation='source-over';add(name,c,x,y);}
shape('06_生命徽章',464,0,43,43,[[21,0],[24,8],[32,10],[37,16],[39,21],[35,29],[29,34],[24,35],[21,42],[18,35],[11,33],[5,26],[4,20],[7,13],[15,8],[18,8]]);
shape('07_卡牌图标',668,6,32,33,[[1,8],[12,1],[29,4],[28,17],[25,31],[10,30],[5,27]]);
shape('08_金币袋图标',833,3,29,37,[[8,2],[17,1],[23,4],[19,9],[21,14],[25,23],[26,31],[22,35],[9,35],[3,31],[5,21],[9,13],[10,9],[7,7]]);
// Frames and central symbols remain independently switchable.
for(const[n,x,y,w,h]of [['设置',1220,2,38,40],['帮助',1267,1,41,41]]){const c=crop(x,y,w,h),g=c.getContext('2d');const inner=crop(x+11,y+10,w-22,h-20);g.clearRect(10,9,w-20,h-18);const d=g.getImageData(0,0,w,h);for(let i=0;i<d.data.length;i+=4){let a=Math.max(0,Math.min(1,(Math.max(d.data[i],d.data[i+1],d.data[i+2])-43)/170));for(let k=0;k<3;k++)d.data[i+k]=Math.max(0,Math.min(255,(d.data[i+k]-27*(1-a))/(a||1)));d.data[i+3]=Math.round(255*a);}g.putImageData(d,0,0);add('09_'+n+'菱形边框',c,x,y);engraving('10_'+n+'符号',x+11,y+10,w-22,h-20);}
const psdfile=path.join(dir,'苍白之血-焚兽之夜-1334x750.psd'),doc=ag.readPsd(fs.readFileSync(psdfile)),group=doc.children.find(x=>x.name==='UI_独立组件'),idx=group.children.findIndex(x=>x.name==='顶部资源栏_无文字'||x.name==='顶部资源栏_详细拆分');if(idx<0)throw Error('HUD layer missing');group.children.splice(idx,1,{name:'顶部资源栏_详细拆分',children:ls});doc.canvas=composite(doc.children);delete doc.imageData;fs.writeFileSync(psdfile,Buffer.from(ag.writePsdBuffer(doc)));
const read=ag.readPsd(fs.readFileSync(psdfile));fs.writeFileSync(path.join(dir,'复原预览.png'),composite(read.children).toBuffer('image/png'));const ui=composite(read.children.filter(x=>x.name!=='背景_事件场景（含叙事人物）'));fs.writeFileSync(path.join(dir,'UI总层.png'),ui.toBuffer('image/png'));
const hud=composite(ls),hc=createCanvas(W,46);hc.getContext('2d').drawImage(hud,0,0);fs.writeFileSync(path.join(dir,'组件/顶部资源栏_无文字.png'),hc.toBuffer('image/png'));
const qa=createCanvas(W,180),q=qa.getContext('2d');for(let row=0;row<3;row++){q.fillStyle=['#fff','#373737','#aaa'][row];q.fillRect(0,row*60,W,60);for(const l of ls.slice(2))q.drawImage(l.canvas,l.left,row*60+l.top);}fs.writeFileSync(path.join(parts,'边缘检查.png'),qa.toBuffer('image/png'));
const meta=JSON.parse(fs.readFileSync(path.join(dir,'文字与布局.json'),'utf8'));meta.resourceBar=ls.map(l=>({name:l.name,left:l.left,top:l.top,width:l.canvas.width,height:l.canvas.height,file:'组件/资源栏/'+l.name+'.png'}));fs.writeFileSync(path.join(dir,'文字与布局.json'),JSON.stringify(meta,null,2));
const original=await loadImage(await sharp(path.join(root,'生成界面/苍白之血-遭遇事件界面-焚兽之夜-v06.png')).png().toBuffer()),cmp=createCanvas(W*2,H);cmp.getContext('2d').drawImage(original,0,0,W,H);cmp.getContext('2d').drawImage(composite(read.children),W,0);fs.writeFileSync(path.join(dir,'原图对比.png'),cmp.toBuffer('image/png'));fs.appendFileSync(path.join(dir,'验收说明.txt'),'\n资源栏已原位替换为详细分组：底板、底线、罗盘、两枚分隔装饰、生命、卡牌、金币袋、设置框/符号、帮助框/符号，共12个独立组件。系统文字层保留，未导出文字PNG。验证环境为ag-psd回读，未在Photoshop应用内打开。');console.log(JSON.stringify({count:ls.length,dir:parts}));})();



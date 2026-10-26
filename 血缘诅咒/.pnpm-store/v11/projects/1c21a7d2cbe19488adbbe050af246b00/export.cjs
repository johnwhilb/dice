const fs=require('fs'),path=require('path');
const ag=require('ag-psd');
const {createCanvas,loadImage,GlobalFonts}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
GlobalFonts.registerFromPath('C:/Windows/Fonts/simsun.ttc','SimSun');
ag.initializeCanvas(createCanvas);
const root=path.resolve(__dirname,'../..'),base=path.join(root,'拆分ui/角色选择/详细拆分/修正v02'),out=path.join(root,'拆分ui/角色选择/1334x750-v04');fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(out,'组件'),{recursive:true});
const W=1334,H=750,sx=W/1672,sy=H/941,children=[],ui=[];
async function imageLayer(name,file,x,y,w,h,target=ui,hidden=false){const im=await loadImage(file);const c=createCanvas(Math.max(1,Math.round(w*sx)),Math.max(1,Math.round(h*sy)));c.getContext('2d').drawImage(im,0,0,c.width,c.height);target.push({name,left:Math.round(x*sx),top:Math.round(y*sy),canvas:c,hidden});return c;}
function composite(list){const c=createCanvas(W,H),ctx=c.getContext('2d');for(const l of list){if(l.hidden)continue;if(l.children)ctx.drawImage(composite(l.children),0,0);else if(l.canvas)ctx.drawImage(l.canvas,l.left||0,l.top||0);}return c;}
function cleanComponent(c,type,name){
 const ctx=c.getContext('2d'),w=c.width,h=c.height,m=createCanvas(w,h),g=m.getContext('2d');g.fillStyle='#fff';
 if(type==='ellipse'){
  g.beginPath();g.ellipse(w/2,h*.52,w*.447,h*.405,0,0,Math.PI*2);g.fill();
  g.beginPath();const pts=name==='生命图标'?[[37,2],[41,26],[49,38],[70,41],[48,45],[41,54],[37,78],[32,54],[25,45],[5,41],[26,37],[33,25]]:[[65,4],[60,22],[48,40],[28,58],[11,74],[20,54],[36,32],[52,16]];
  pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();
 }else if(type==='panel'){
  g.beginPath();[[9,1],[w-10,1],[w-2,9],[w-2,h-10],[w-10,h-2],[9,h-2],[1,h-10],[1,9]].forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();
 }else if(type==='frame'){
  g.fillRect(2,2,w-4,h-4);g.clearRect(7,7,w-14,h-14);
  if(name==='选中框'){ctx.clearRect(61,h-8,30,8);ctx.drawImage(c,25,h-8,30,7,61,h-8,30,7);}
 }else if(type.includes('button')){
  g.beginPath();[[28,2],[w-28,2],[w-3,h/2],[w-28,h-3],[28,h-3],[3,h/2]].forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();
 }else if(name.includes('分隔线')){
  ctx.clearRect(0,0,w,h);ctx.fillStyle=name==='属性分隔线'?'#8c8173':'#655c4f';ctx.fillRect(1,Math.floor(h/2),w-2,1);return;
 }else return;
 ctx.globalCompositeOperation='destination-in';ctx.drawImage(m,0,0);ctx.globalCompositeOperation='source-over';
}
(async()=>{
 {
 const file=path.join(out,'苍白之血-角色选择-1334x750-v04-待验收.psd'),doc=ag.readPsd(fs.readFileSync(file));
 const sharp=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');const src=await loadImage(await sharp(fs.readFileSync(path.join(root,'生成界面/苍白之血-角色选择-观星者-v05.png'))).png().toBuffer());
 const avatar=createCanvas(111,111);avatar.getContext('2d').drawImage(src,940,620,129,126,0,0,111,111);
 const frame=createCanvas(122,122),native=createCanvas(153,153),cx=native.getContext('2d');
 cx.drawImage(src,930,610,149,5,2,2,149,5);cx.drawImage(src,930,610,5,149,2,2,5,149);cx.drawImage(src,1074,610,5,149,146,2,5,149);
 cx.drawImage(src,930,754,60,5,2,146,60,5);cx.drawImage(src,1018,754,61,5,90,146,61,5);cx.drawImage(src,960,754,28,5,62,146,28,5);
 frame.getContext('2d').drawImage(native,0,0,122,122);
 let changed=0;function replace(ls){for(const l of ls||[]){if(l.name==='头像_观星者'||l.name==='选中框'){l.canvas=l.name==='头像_观星者'?avatar:frame;delete l.imageData;l.right=l.left+l.canvas.width;l.bottom=l.top+l.canvas.height;changed++;}replace(l.children)}}replace(doc.children);if(changed!==2)throw Error('Expected exactly two replacements');
 doc.canvas=composite(doc.children);delete doc.imageData;
 fs.writeFileSync(file,Buffer.from(ag.writePsdBuffer(doc)));
 for(const[n,c]of [['头像_观星者',avatar],['选中框',frame]])fs.writeFileSync(path.join(out,'组件',n+'.png'),c.toBuffer('image/png'));
 const uiGroup=doc.children.find(l=>l.children);fs.writeFileSync(path.join(out,'UI总层.png'),composite(uiGroup.children).toBuffer('image/png'));fs.writeFileSync(path.join(out,'复原预览.png'),doc.canvas.toBuffer('image/png'));
 console.log('Updated two existing layers and PNG files');return;
 }
 await imageLayer('背景_对应文件夹',path.join(root,'拆分ui/角色选择/背景.png'),0,0,1672,941,children);
 const char=await loadImage(path.join(root,'角色/04_蓝袍魔女_画风统一-v02.png'));await imageLayer('观星者_对应角色素材',path.join(root,'角色/04_蓝袍魔女_画风统一-v02.png'),700,-4,1075,1612,children);
 fs.mkdirSync(base,{recursive:true});
 const src=await loadImage(fs.readFileSync(path.join(root,'生成界面/苍白之血-角色选择-观星者-v05.png')));
 const defs=[['技能_观星者',200,401,114,108,'rect'],['生命图标',193,201,75,80,'ellipse'],['耐力图标',439,202,74,78,'ellipse'],['巡礼底板',552,518,567,84,'panel'],['普通框1',591,608,153,153,'frame'],['普通框2',758,608,154,153,'frame'],['选中框',928,608,153,153,'frame'],['返回底板',11,669,250,76,'button'],['冒险底板',1310,667,358,81,'redbutton'],['技能分隔线',194,383,505,3,'rect'],['标题分隔线',194,192,505,3,'rect'],['属性分隔线',194,286,505,2,'rect']];
 const meta={components:[]};
 for(const[name,x,y,w,h,type]of defs){const c=createCanvas(w,h),ctx=c.getContext('2d');ctx.save();if(type==='ellipse'){ctx.beginPath();ctx.ellipse(w/2,h/2,w/2-1,h/2-1,0,0,Math.PI*2);ctx.clip();}else if(type.includes('button')){ctx.beginPath();ctx.moveTo(28,1);ctx.lineTo(w-28,1);ctx.lineTo(w-1,h/2);ctx.lineTo(w-28,h-2);ctx.lineTo(28,h-2);ctx.lineTo(1,h/2);ctx.closePath();ctx.clip();}ctx.drawImage(src,x,y,w,h,0,0,w,h);ctx.restore();if(type==='frame')ctx.clearRect(7,7,w-14,h-14);if(type==='panel'){ctx.fillStyle='#181615';ctx.fillRect(8,8,w-16,h-16);}if(type.includes('button')){ctx.fillStyle=type==='redbutton'?'#461b1b':'#151313';ctx.beginPath();ctx.moveTo(32,8);ctx.lineTo(w-32,8);ctx.lineTo(w-11,h/2);ctx.lineTo(w-32,h-8);ctx.lineTo(32,h-8);ctx.lineTo(11,h/2);ctx.closePath();ctx.fill();}const file=name+'.png';fs.writeFileSync(path.join(base,file),c.toBuffer('image/png'));meta.components.push({name,file,rect:[x,y,w,h],visible:true});}
 for(let index=0;index<meta.components.length;index++){const a=meta.components[index],[x,y,w,h]=a.rect;const im=await loadImage(path.join(base,a.file)),native=createCanvas(w,h);native.getContext('2d').drawImage(im,0,0);cleanComponent(native,defs[index][5],a.name);fs.writeFileSync(path.join(base,a.file),native.toBuffer('image/png'));await imageLayer(a.name,path.join(base,a.file),x,y,w,h,ui,!a.visible);}
 const reference=await loadImage(fs.readFileSync(path.join(root,'生成界面/苍白之血-角色选择-观星者-v05.png')));
 for(const [name,x]of [['神职人员',598],['猎人',765],['观星者',935]]){const c=createCanvas(139,139);const inset=name==='观星者'?5:2;const sw=name==='观星者'?129:135,sh=name==='观星者'?126:135;c.getContext('2d').drawImage(reference,x+inset,615+inset,sw,sh,0,0,139,139);const scaled=createCanvas(Math.round(139*sx),Math.round(139*sy));scaled.getContext('2d').drawImage(c,0,0,scaled.width,scaled.height);ui.unshift({name:'头像_'+name,left:Math.round(x*sx),top:Math.round(615*sy),canvas:scaled});}
 // 选中框只取原图窄边，内侧人物和底部标记不混入框内。
 const selected=ui.find(l=>l.name==='选中框');if(selected){const c=createCanvas(153,153),ctx=c.getContext('2d');ctx.drawImage(reference,930,610,149,5,2,2,149,5);ctx.drawImage(reference,930,610,5,149,2,2,5,149);ctx.drawImage(reference,1074,610,5,149,146,2,5,149);ctx.drawImage(reference,930,754,60,5,2,146,60,5);ctx.drawImage(reference,1018,754,61,5,90,146,61,5);ctx.drawImage(reference,960,754,28,5,62,146,28,5);const scaled=createCanvas(Math.round(153*sx),Math.round(153*sy));scaled.getContext('2d').drawImage(c,0,0,scaled.width,scaled.height);selected.canvas=scaled;}
 const texts=[['职业名','观星者',194,111,74,'#080808'],['生命标签','生命',280,216,24,'#141414'],['生命数值','1280',280,240,36,'#641b1b'],['耐力标签','耐力',523,216,24,'#141414'],['耐力数值','320',523,240,36,'#28343f'],['简介','仰望群星，窥探隐秘。\n以星象解读深渊的低语。',197,306,23,'#101010'],['技能名称','星轨启示',340,406,33,'#111111'],['技能说明','抽取卡牌，强化下一次法术。',340,451,23,'#111111'],['等级数值','3',671,542,40,'#e1cfb5'],['等级标题','巡礼等级',751,539,26,'#eee6d5'],['等级说明','提升后可解锁新的技能与外观。',751,571,18,'#eee6d5'],['职业标签1','神职人员',623,770,23,'#f1ede3'],['职业标签2','猎人',815,770,23,'#f1ede3'],['职业标签3','观星者',972,770,23,'#f1ede3'],['返回','返回',133,695,29,'#f1e6d7'],['开始冒险','开始冒险',1415,690,34,'#fff3df']];
 for(const[name,text,x,y,size,color]of texts){const fontSize=size*sy,c=createCanvas(Math.min(W,Math.ceil(text.split('\n').reduce((n,s)=>Math.max(n,s.length),0)*fontSize+12)),Math.ceil(fontSize*1.45*text.split('\n').length+8)),ctx=c.getContext('2d');ctx.font=`${fontSize}px SimSun`;ctx.fillStyle=color;ctx.textBaseline='top';text.split('\n').forEach((t,i)=>ctx.fillText(t,2,i*fontSize*1.3));const left=Math.round(x*sx),top=Math.round(y*sy);ui.push({name:'文字_'+name,left,top,canvas:c,text:{text:text.replace(/\n/g,'\r'),transform:[1,0,0,1,left+2,top+fontSize*.88],style:{font:{name:'SimSun'},fontSize,fillColor:{r:parseInt(color.slice(1,3),16),g:parseInt(color.slice(3,5),16),b:parseInt(color.slice(5,7),16)}},antiAlias:'sharp',shapeType:'point'}});}
 for(const[name,x,y,w,h,bright]of [['标题侧装饰',139,92,41,227,false],['巡礼纹章',590,526,70,70,true],['返回箭头',60,689,42,38,true],['前进箭头',1576,695,20,27,true]]){const c=createCanvas(w,h),cx=c.getContext('2d');cx.drawImage(src,x,y,w,h,0,0,w,h);const data=cx.getImageData(0,0,w,h);for(let i=0;i<data.data.length;i+=4){const lum=(data.data[i]+data.data[i+1]+data.data[i+2])/3;data.data[i+3]=Math.round(255*Math.max(0,Math.min(1,bright?(lum-45)/90:(205-lum)/80)));}cx.putImageData(data,0,0);const scaled=createCanvas(Math.round(w*sx),Math.round(h*sy));scaled.getContext('2d').drawImage(c,0,0,scaled.width,scaled.height);ui.push({name,left:Math.round(x*sx),top:Math.round(y*sy),canvas:scaled});}
 // 对残留灰底进行去底色：在缩放前提取的符号上分离 alpha 与前景色。
 for(const l of ui){if(!['标题侧装饰','巡礼纹章','返回箭头','前进箭头'].includes(l.name))continue;
 const ctx=l.canvas.getContext('2d'),d=ctx.getImageData(0,0,l.canvas.width,l.canvas.height),dark=l.name==='标题侧装饰';
 for(let i=0;i<d.data.length;i+=4){const old=d.data[i+3]/255;if(!old)continue;const rgb=[d.data[i],d.data[i+1],d.data[i+2]],lum=rgb.reduce((a,b)=>a+b)/3;
 const coverage=Math.max(0,Math.min(1,dark?(207-lum)/137:(lum-28)/163));d.data[i+3]=Math.round(coverage*255);
 const fg=dark?[70,65,59]:l.name==='巡礼纹章'?[180,159,126]:[224,207,184];fg.forEach((v,j)=>d.data[i+j]=v);
 }ctx.putImageData(d,0,0);}
 const total=composite(ui);fs.writeFileSync(path.join(out,'UI总层.png'),total.toBuffer('image/png'));
 for(const l of ui)fs.writeFileSync(path.join(out,'组件',l.name+'.png'),l.canvas.toBuffer('image/png'));
 children.push({name:'UI_组件及系统字体文字',children:ui});const merged=composite(children);const psd={width:W,height:H,canvas:merged,children};
 const file=path.join(out,'苍白之血-角色选择-1334x750-v04-待验收.psd');fs.writeFileSync(file,Buffer.from(ag.writePsdBuffer(psd)));
 const decoded=ag.readPsd(fs.readFileSync(file),{skipLayerImageData:true,skipCompositeImageData:true});let textCount=0;function walk(ls){for(const l of ls||[]){if(l.text)textCount++;walk(l.children)}}walk(decoded.children);
 if(decoded.width!==W||decoded.height!==H||textCount!==texts.length)throw Error('PSD verification failed');
 fs.writeFileSync(path.join(out,'复原预览.png'),merged.toBuffer('image/png'));
 const ref=createCanvas(W,H);ref.getContext('2d').drawImage(reference,0,0,W,H);fs.writeFileSync(path.join(out,'原图目标尺寸.png'),ref.toBuffer('image/png'));
 const compare=createCanvas(W*2,H);compare.getContext('2d').drawImage(ref,0,0);compare.getContext('2d').drawImage(merged,W,0);fs.writeFileSync(path.join(out,'原图对比.png'),compare.toBuffer('image/png'));
 fs.writeFileSync(path.join(out,'文字与布局.json'),JSON.stringify({width:W,height:H,font:'SimSun',editableTextLayers:textCount,texts,components:ui.map(l=>({name:l.name,left:l.left,top:l.top,width:l.canvas.width,height:l.canvas.height,hidden:!!l.hidden}))},null,2));
 console.log(JSON.stringify({file,width:decoded.width,height:decoded.height,editableTextLayers:textCount}));
})();


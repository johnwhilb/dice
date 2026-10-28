const fs=require('fs'),path=require('path');
const ag=require('ag-psd');
const {createCanvas,loadImage}=require('C:/Users/DHXM/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
ag.initializeCanvas(createCanvas);
const root=path.resolve(__dirname,'../..'),out=path.join(root,'拆分ui/战斗界面/约瑟夫卡诊所-无UI-v02');
const W=1672,H=941,foot=471;
function composite(layers){let c=createCanvas(W,H),g=c.getContext('2d');for(const l of layers){if(!l.hidden)g.drawImage(l.canvas,l.left||0,l.top||0);}return c;}
function bbox(c){const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let x1=c.width,y1=c.height,x2=0,y2=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(a[(y*c.width+x)*4+3]>=16){x1=Math.min(x1,x);x2=Math.max(x2,x+1);y1=Math.min(y1,y);y2=Math.max(y2,y+1);}return [x1,y1,x2,y2];}
(async()=>{
 fs.mkdirSync(path.join(out,'素材'),{recursive:true});
 const spec=JSON.parse(fs.readFileSync(path.join(root,'output/imagegen/clinic-v02-inputs.json'),'utf8'));
 const bgImage=await loadImage(spec.background),bg=createCanvas(W,H);bg.getContext('2d').drawImage(bgImage,0,0,W,H);
 const layers=[{name:'01_约瑟夫卡诊所_独立背景',left:0,top:0,canvas:bg}],layout=[];
 fs.writeFileSync(path.join(out,'素材/约瑟夫卡诊所-v02.png'),bg.toBuffer('image/png'));
 for(const def of [{key:'wolf',name:'兽化狼人',cx:540,maxW:370,maxH:310},{key:'impostor',name:'假约瑟夫卡',cx:1160,maxW:285,maxH:385}]){
  const im=await loadImage(spec[def.key]),c=createCanvas(im.width,im.height);c.getContext('2d').drawImage(im,0,0);const [x1,y1,x2,y2]=bbox(c);
  if(x2<=x1||y2<=y1)throw Error('empty alpha');
  const scale=Math.min(def.maxW/(x2-x1),def.maxH/(y2-y1)),w=Math.round((x2-x1)*scale),h=Math.round((y2-y1)*scale),cropped=createCanvas(w,h);cropped.getContext('2d').drawImage(c,x1,y1,x2-x1,y2-y1,0,0,w,h);
  const left=Math.round(def.cx-w/2),top=foot-h;
  layers.push({name:'0'+(layers.length+1)+'_'+def.name+'_透明独立层_脚底Y471',left,top,canvas:cropped});
  fs.copyFileSync(spec[def.key],path.join(out,'素材',`约瑟夫卡诊所-${def.name}-v02.png`));
  layout.push({name:def.name,left,top,width:w,height:h,footY:foot,source:spec[def.key],sourceAlphaBBox:[x1,y1,x2,y2]});
 }
 const merged=composite(layers),file=path.join(out,'苍白之血-约瑟夫卡诊所-无UI-v02.psd');
 fs.writeFileSync(file,Buffer.from(ag.writePsdBuffer({width:W,height:H,canvas:merged,children:layers,guides:[{location:H/2,orientation:'horizontal'}]})));
 const decoded=ag.readPsd(fs.readFileSync(file));
 const rebuilt=composite(decoded.children),png=path.join(out,'苍白之血-约瑟夫卡诊所-无UI-v02.png');fs.writeFileSync(png,rebuilt.toBuffer('image/png'));
 const a=merged.getContext('2d').getImageData(0,0,W,H).data,b=rebuilt.getContext('2d').getImageData(0,0,W,H).data;let maxDifference=0;for(let i=0;i<a.length;i++)maxDifference=Math.max(maxDifference,Math.abs(a[i]-b[i]));if(maxDifference)throw Error('PSD layer readback mismatch '+maxDifference);
 const check=createCanvas(W,H),ctx=check.getContext('2d');ctx.drawImage(rebuilt,0,0);ctx.strokeStyle='#e0a340';ctx.setLineDash([12,8]);ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();fs.writeFileSync(path.join(out,'脚底中线检查.png'),check.toBuffer('image/png'));
 fs.writeFileSync(path.join(out,'文字与布局.json'),JSON.stringify({canvas:[W,H],requestedFootY:H/2,rasterFootEdge:foot,ui:false,textLayers:0,reason:'本次为无UI无文字场景，不适用UI总层提取与文字层阶段',layers:layout,verification:{layerCount:decoded.children.length,maxDifference}},null,2));
 fs.copyFileSync(png,path.join(root,'生成界面/苍白之血-约瑟夫卡诊所-无UI-v02.png'));
 console.log(JSON.stringify({file,png,layers:layout,maxDifference}));
})();

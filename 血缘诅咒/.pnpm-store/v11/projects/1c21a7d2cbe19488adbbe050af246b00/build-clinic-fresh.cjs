const fs=require('fs'),path=require('path');
process.env.NODE_PATH=[path.join(__dirname,'node_modules/.pnpm/pako@2.1.0/node_modules'),path.join(__dirname,'node_modules/.pnpm/base64-js@1.5.1/node_modules')].join(path.delimiter);
require('module').Module._initPaths();
const ag=require('./node_modules/.pnpm/ag-psd@32.0.0/node_modules/ag-psd');
const {createCanvas,loadImage}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
ag.initializeCanvas(createCanvas);
const root=path.resolve(__dirname,'../..'),out=path.join(root,'拆分ui/战斗界面/约瑟夫卡诊所-完整-v01');
const spec=JSON.parse(fs.readFileSync(path.join(__dirname,'clinic-fresh-inputs.json'),'utf8'));
const W=1671,H=941,foot=521;
function composite(layers){const c=createCanvas(W,H),g=c.getContext('2d');for(const l of layers){if(l.hidden)continue;if(l.children)g.drawImage(composite(l.children),0,0);else if(l.canvas)g.drawImage(l.canvas,l.left||0,l.top||0);}return c;}
function alphaBox(c){const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let x1=c.width,y1=c.height,x2=0,y2=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(a[(y*c.width+x)*4+3]>=16){x1=Math.min(x1,x);y1=Math.min(y1,y);x2=Math.max(x2,x+1);y2=Math.max(y2,y+1);}return [x1,y1,x2,y2];}
function stats(a,b){let max=0,sum=0,n=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d){max=Math.max(max,d);sum+=d;n++;}}return {max,mean:sum/a.length,changedChannels:n};}
(async()=>{
 for(const d of ['素材/背景','素材/敌人','素材/UI','检查'])fs.mkdirSync(path.join(out,d),{recursive:true});
 const currentFile=path.join(out,'苍白之血-约瑟夫卡诊所-战斗界面-完整分层.psd');
 let priorCanvas;
 if(fs.existsSync(currentFile)){
  const prior=ag.readPsd(fs.readFileSync(currentFile));
  priorCanvas=composite(prior.children);
 }
 const layers=[],layout=[];
 const im=await loadImage(spec.background),bg=createCanvas(W,H);bg.getContext('2d').drawImage(im,0,0,W,H);
 const bgfile=path.join(out,'素材/背景/约瑟夫卡诊所-新绘背景.png');fs.writeFileSync(bgfile,bg.toBuffer('image/png'));
 layers.push({name:'01_场景_约瑟夫卡诊所_新绘背景',left:0,top:0,canvas:bg});
 const shadow=createCanvas(W,H),sg=shadow.getContext('2d');
 for(const [x,rx]of [[457,157],[960,36],[1240,57]]){sg.fillStyle='rgba(8,9,11,0.37)';sg.beginPath();sg.ellipse(x,foot+1,rx,5,0,0,Math.PI*2);sg.fill();}
 layers.push({name:'02_独立哑光接地投影',left:0,top:0,canvas:shadow});
 for(const def of [{key:'wolf',name:'兽化狼人',cx:457,maxW:444,maxH:302,mirror:false},{key:'celestial',name:'小型天界使者',cx:960,maxW:123,maxH:253,mirror:false},{key:'impostor',name:'假约瑟夫卡',cx:1240,maxW:215,maxH:389,mirror:false}]){
  const im=await loadImage(spec[def.key]),raw=createCanvas(im.width,im.height);raw.getContext('2d').drawImage(im,0,0);const [x1,y1,x2,y2]=alphaBox(raw);
  if(x2<=x1||y2<=y1)throw Error('Empty character '+def.name);
  const sc=Math.min(def.maxW/(x2-x1),def.maxH/(y2-y1)),w=Math.round((x2-x1)*sc),h=Math.round((y2-y1)*sc),c=createCanvas(w,h),g=c.getContext('2d');
  if(def.mirror){g.translate(w,0);g.scale(-1,1);}g.drawImage(raw,x1,y1,x2-x1,y2-y1,0,0,w,h);
  const left=Math.round(def.cx-w/2),top=foot-h;
  layers.push({name:'03_'+def.name+'_独立透明立绘_脚底Y'+foot,left,top,canvas:c});
  const rawfile=path.join(out,'素材/敌人',def.name+'-新绘原始透明.png');fs.copyFileSync(spec[def.key],rawfile);
  fs.writeFileSync(path.join(out,'素材/敌人',def.name+'-入场尺寸.png'),c.toBuffer('image/png'));
  layout.push({name:def.name,left,top,width:w,height:h,footY:foot,source:spec[def.key],sourceAlphaBBox:[x1,y1,x2,y2],mirror:def.mirror,reason:def.mirror?'水平镜像使人物右手持手杖、左手持枪，与新版表格一致':undefined});
 }
 const uiSource=path.join(root,'拆分ui/战斗界面/无怪物信息-v01/UI总层.png'),uiImage=await loadImage(uiSource);
 if(uiImage.width!==W||uiImage.height!==H)throw Error('Unexpected UI dimensions');
 fs.copyFileSync(uiSource,path.join(out,'UI总层.png'));fs.copyFileSync(uiSource,path.join(out,'素材/UI/UI总层-用户原文件.png'));
 // The source RGBA pixels are decoded independently rather than resampled through Canvas.
 const sharp=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
 const uiRaw=await sharp(uiSource).ensureAlpha().raw().toBuffer();
 const uiCanvas=createCanvas(W,H);uiCanvas.getContext('2d').drawImage(uiImage,0,0);
 layers.push({name:'04_UI总层_用户原图_原尺寸原位_禁止改动',left:0,top:0,imageData:{data:new Uint8ClampedArray(uiRaw),width:W,height:H},canvas:uiCanvas});
 const beforeUi=composite(layers.slice(0,-1));fs.writeFileSync(path.join(out,'检查/无UI场景与敌人.png'),beforeUi.toBuffer('image/png'));
 const merged=composite(layers),psd={width:W,height:H,canvas:merged,children:layers,guides:[{location:H/2,orientation:'horizontal'},{location:foot,orientation:'horizontal'}]};
 const file=path.join(out,'苍白之血-约瑟夫卡诊所-战斗界面-完整分层.psd');
 fs.writeFileSync(file,Buffer.from(ag.writePsdBuffer(psd)));
 const decoded=ag.readPsd(fs.readFileSync(file),{useImageData:true});
 const decodedUi=decoded.children.find(l=>l.name.startsWith('04_UI总层'));
 const uiDiff=stats(uiRaw,decodedUi.imageData.data);
 if(uiDiff.max!==0)throw Error('UI pixel preservation failed '+JSON.stringify(uiDiff));
 for(const l of decoded.children){if(l.imageData&&!l.canvas){const c=createCanvas(l.imageData.width,l.imageData.height);c.getContext('2d').putImageData(l.imageData,0,0);l.canvas=c;}}
 const rebuilt=composite(decoded.children),preview=path.join(out,'复原预览.png');fs.writeFileSync(preview,rebuilt.toBuffer('image/png'));
 const mergeDiff=stats(merged.getContext('2d').getImageData(0,0,W,H).data,rebuilt.getContext('2d').getImageData(0,0,W,H).data);
 const chk=createCanvas(W,H),cg=chk.getContext('2d');cg.drawImage(rebuilt,0,0);cg.strokeStyle='#e8b456';cg.setLineDash([10,7]);cg.beginPath();cg.moveTo(0,foot);cg.lineTo(W,foot);cg.stroke();fs.writeFileSync(path.join(out,'检查/敌人脚底位置.png'),chk.toBuffer('image/png'));
 const ref=await loadImage(path.join(root,'游戏界面画风锚点/苍白之血-角色选择-观星者-v05.png')),comp=createCanvas(W*2,H);comp.getContext('2d').drawImage(ref,0,0,W,H);comp.getContext('2d').drawImage(rebuilt,W,0);fs.writeFileSync(path.join(out,'原图对比.png'),comp.toBuffer('image/png'));
 if(priorCanvas){const compare=createCanvas(W*2,H),g=compare.getContext('2d');g.drawImage(priorCanvas,0,0);g.drawImage(rebuilt,W,0);fs.writeFileSync(path.join(out,'优化前后对比.png'),compare.toBuffer('image/png'));}
 const meta={canvas:[W,H],userOverride:'用户明确要求不要动UI层，直接挂上去；因此UI保持单一原图层，不拆组件、不替换字体、不修改原文字。',uiSource,uiPlacement:{left:0,top:0,scale:1},uiDecodedPixelDifference:uiDiff,sourceCopyByteIdentical:fs.readFileSync(uiSource).equals(fs.readFileSync(path.join(out,'UI总层.png'))),sceneSource:spec.background,enemies:layout,psdLayerCount:decoded.children.length,editableTextLayers:0,textReason:'按用户最新指令，保留原UI总层；原UI文字为图像的一部分。',verification:{psdLayerReadbackDifference:mergeDiff,photoshopOpened:false},notUsed:'旧诊所素材、旧敌人素材及本轮UI清理稿均未采用'};
 fs.writeFileSync(path.join(out,'文字与布局.json'),JSON.stringify(meta,null,2));
 fs.mkdirSync(path.join(root,'生成界面'),{recursive:true});fs.copyFileSync(preview,path.join(root,'生成界面/苍白之血-约瑟夫卡诊所-战斗界面-v01.png'));
 console.log(JSON.stringify({file,preview,...meta},null,2));
})();

(()=>{'use strict';
const config=JSON.parse(document.getElementById('document-data').textContent);
const $=id=>document.getElementById(id), clone=v=>JSON.parse(JSON.stringify(v));
const base=clone(config.layout), key='norse-map-editor-v1-'+(config.documentId||'default');
let layout=clone(base),selected=null,editing=false,space=false,history=[],future=[],saveTimer,toastTimer;
let assets={...config.assets},images={},allHidden=false,cam={x:0,y:0,s:1},gesture=null,pointers=new Map();
let restored=false;
function validate(d){
 if(!d||d.version!==1||!d.mapSize||d.mapSize.width!==base.mapSize.width||d.mapSize.height!==base.mapSize.height||!Array.isArray(d.landmarks)||d.landmarks.length>200)throw Error('布局格式或地图尺寸不匹配');
 const ids=new Set();for(const p of d.landmarks){if(!p||typeof p.id!=='string'||ids.has(p.id)||!assets[p.asset]||!['x','y','width','rotation','opacity','z'].every(k=>Number.isFinite(p[k]))||p.width<20||p.width>1600||p.x<0||p.x>d.mapSize.width||p.y<0||p.y>d.mapSize.height||p.opacity<0||p.opacity>1||Math.abs(p.rotation)>180||p.z<0||p.z>999||typeof p.name!=='string'||typeof p.region!=='string'||typeof p.description!=='string'||typeof p.visible!=='boolean'||typeof p.locked!=='boolean')throw Error('地标数据无效或缺少素材：'+(p?.id||''));ids.add(p.id);}
}
function toast(msg){$('toast').textContent=msg;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2300);}
function snapshot(){history.push(clone(layout));if(history.length>60)history.shift();future=[];updateHistory();}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{persistCustom();localStorage.setItem(key,JSON.stringify(layout));$('saveState').textContent='已自动保存 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});}catch{$('saveState').textContent='浏览器空间不足，请导出 HTML 或 JSON 保存。';}},180);}
function updateHistory(){$('undo').disabled=!history.length;$('redo').disabled=!future.length;}
function undo(){if(!history.length)return;future.push(clone(layout));layout=history.pop();render();save();}
function redo(){if(!future.length)return;history.push(clone(layout));layout=future.pop();render();save();}
function item(){return layout.landmarks.find(p=>p.id===selected);}
function height(p){const im=images[p.asset];return p.width*(im?im.naturalHeight/im.naturalWidth:1);}
function applyCamera(){const v=$('viewport');cam.s=Math.max(.15,Math.min(5,cam.s));cam.x=Math.max(-layout.mapSize.width*cam.s+60,Math.min(v.clientWidth-60,cam.x));cam.y=Math.max(-layout.mapSize.height*cam.s+60,Math.min(v.clientHeight-60,cam.y));$('world').style.transform=`translate(${cam.x}px,${cam.y}px) scale(${cam.s})`;$('zoomValue').textContent=Math.round(cam.s*100)+'%';}
function fit(){const v=$('viewport');cam.s=Math.min(v.clientWidth/layout.mapSize.width,v.clientHeight/layout.mapSize.height);cam.x=(v.clientWidth-layout.mapSize.width*cam.s)/2;cam.y=(v.clientHeight-layout.mapSize.height*cam.s)/2;applyCamera();hidePop();}
function zoom(factor,cx,cy){const v=$('viewport');cx??=v.clientWidth/2;cy??=v.clientHeight/2;const next=Math.max(.15,Math.min(5,cam.s*factor)),ratio=next/cam.s;cam.x=cx-(cx-cam.x)*ratio;cam.y=cy-(cy-cam.y)*ratio;cam.s=next;applyCamera();hidePop();}
function setEditing(value){editing=value;document.body.classList.toggle('editing',value);$('editor').hidden=!value;$('editToggle').textContent=value?'完成编辑 ✓':'编辑地图 ↗';hidePop();$('hint').textContent=value?'拖动地标调整 · 空格拖动地图 · 修改自动保存':'拖动浏览 · 滚轮滑动 · Ctrl + 滚轮缩放 · 双击放大';render();fit();}
function clean(){document.body.classList.toggle('clean');hidePop();requestAnimationFrame(fit);}
function hidePop(){$('popover').hidden=true;$('tooltip').hidden=true;}
function select(id){selected=id;render();}
function styleNode(el,p){const h=height(p);el.style.left=p.x+'px';el.style.top=p.y+'px';el.style.width=p.width+'px';el.style.height=h+'px';el.style.transform=`translate(-50%,-100%) rotate(${p.rotation}deg)`;el.style.opacity=p.opacity;el.style.zIndex=p.z;el.hidden=!p.visible||allHidden;el.classList.toggle('selected',p.id===selected);el.classList.toggle('locked',p.locked);}
function render(){
 const host=$('landmarks');host.replaceChildren();
 for(const p of layout.landmarks){const el=document.createElement('button');el.className='landmark';el.dataset.id=p.id;el.setAttribute('aria-label',p.region+'：'+p.name);const img=document.createElement('img');img.src=assets[p.asset];img.alt=p.name;img.draggable=false;el.append(img);const handle=document.createElement('span');handle.className='handle';handle.setAttribute('aria-hidden','true');el.append(handle);styleNode(el,p);host.append(el);}
 renderList();fillForm();updateHistory();
}
function renderList(){const list=$('realmList');list.replaceChildren();for(const p of layout.landmarks){const b=document.createElement('button');b.className='realm'+(p.id===selected?' selected':'')+(!p.visible?' is-hidden':'');b.dataset.id=p.id;const img=document.createElement('img');img.src=assets[p.asset];img.alt='';const box=document.createElement('span'),name=document.createElement('strong'),small=document.createElement('small');name.textContent=p.region;small.textContent=p.name;box.append(name,small);b.append(img,box);b.onclick=()=>{select(p.id);focusItem(p);};list.append(b);}$('count').textContent=layout.landmarks.length+' 个独立图层';}
function fillForm(){const p=item();$('empty').hidden=!!p;$('properties').hidden=!p;if(!p)return;$('propThumb').src=assets[p.asset];$('propRegion').textContent=p.region;$('propTitle').textContent=p.name;for(const k of ['name','region','x','y','width','rotation','opacity','z','visible','locked','description']){const f=$(k);if(f.type==='checkbox')f.checked=p[k];else f.value=k==='opacity'?Math.round(p[k]*100):typeof p[k]==='number'?Math.round(p[k]*10)/10:p[k];}}
function focusItem(p=item()){if(!p)return;cam.s=Math.max(cam.s,.9);const v=$('viewport');const available=v.clientWidth-(editing&&innerWidth<=760?300:0);cam.x=available/2-p.x*cam.s;cam.y=v.clientHeight/2-(p.y-height(p)/2)*cam.s;applyCamera();hidePop();}
function showPop(p){const pop=$('popover');$('popRegion').textContent=p.region;$('popName').textContent=p.name;$('popDesc').textContent=p.description;pop.hidden=false;const v=$('viewport');const x=cam.x+p.x*cam.s+30;const y=cam.y+(p.y-height(p)/2)*cam.s-50;pop.style.left=Math.max(12,Math.min(v.clientWidth-264,x))+'px';pop.style.top=Math.max(12,Math.min(v.clientHeight-pop.offsetHeight-20,y))+'px';}
function coords(e){const r=$('viewport').getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
const viewport=$('viewport');
viewport.addEventListener('pointerdown',e=>{
 if(e.button!==0&&e.button!==1)return;
 e.preventDefault();hidePop();pointers.set(e.pointerId,coords(e));viewport.setPointerCapture(e.pointerId);
 if(pointers.size===2){const a=[...pointers.values()];gesture={type:'pinch',distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),s:cam.s,x:cam.x,y:cam.y,cx:(a[0].x+a[1].x)/2,cy:(a[0].y+a[1].y)/2};return;}
 const target=e.target.closest('.landmark'),p=target&&layout.landmarks.find(p=>p.id===target.dataset.id),pos=coords(e);
 if(p&&editing&&!space&&e.button===0){selected=p.id;render();gesture={type:e.target.classList.contains('handle')?'resize':'object',p,start:pos,x:p.x,y:p.y,width:p.width,moved:false,locked:p.locked};}
 else{gesture={type:'pan',start:pos,x:cam.x,y:cam.y,moved:false,clicked:p?.id};viewport.classList.add('dragging');}
});
viewport.addEventListener('pointermove',e=>{
 const pos=coords(e);if(pointers.has(e.pointerId))pointers.set(e.pointerId,pos);
 if(!gesture){const el=e.target.closest('.landmark');if(el&&!editing){const p=layout.landmarks.find(p=>p.id===el.dataset.id);$('tooltip').textContent=p.region+' · '+p.name;$('tooltip').style.left=Math.min(innerWidth-240,e.clientX+15)+'px';$('tooltip').style.top=(e.clientY+20)+'px';$('tooltip').hidden=false;}else $('tooltip').hidden=true;return;}
 const g=gesture;
 if(g.type==='pinch'){if(pointers.size<2)return;const a=[...pointers.values()],distance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),s=Math.max(.15,Math.min(5,g.s*distance/Math.max(1,g.distance)));cam.x=(a[0].x+a[1].x)/2-(g.cx-g.x)*s/g.s;cam.y=(a[0].y+a[1].y)/2-(g.cy-g.y)*s/g.s;cam.s=s;applyCamera();return;}
 const dx=pos.x-g.start.x,dy=pos.y-g.start.y;if(!g.moved&&Math.hypot(dx,dy)>3){g.moved=true;if((g.type==='object'||g.type==='resize')&&!g.locked)snapshot();}
 if(g.type==='pan'){cam.x=g.x+dx;cam.y=g.y+dy;applyCamera();}
 else if(g.moved&&!g.locked){if(g.type==='resize')g.p.width=Math.max(20,Math.min(1600,g.width+dx*2/cam.s));else{g.p.x=Math.max(0,Math.min(layout.mapSize.width,g.x+dx/cam.s));g.p.y=Math.max(0,Math.min(layout.mapSize.height,g.y+dy/cam.s));}styleNode(document.querySelector('.landmark[data-id="'+CSS.escape(g.p.id)+'"]'),g.p);fillForm();}
});
function endPointer(e){const g=gesture;pointers.delete(e.pointerId);if(!g)return;if(g.type==='pinch'){if(pointers.size===1){const pos=[...pointers.values()][0];gesture={type:'pan',start:pos,x:cam.x,y:cam.y,moved:true};}else gesture=null;return;}if(pointers.size)return;gesture=null;viewport.classList.remove('dragging');if(g.moved&&(g.type==='object'||g.type==='resize')&&!g.locked){save();renderList();}if(!g.moved&&g.clicked&&!editing&&e.type==='pointerup'){select(g.clicked);showPop(item());}}
viewport.addEventListener('pointerup',endPointer);viewport.addEventListener('pointercancel',endPointer);viewport.addEventListener('pointerleave',()=>$('tooltip').hidden=true);
viewport.addEventListener('wheel',e=>{e.preventDefault();hidePop();if(e.ctrlKey||e.metaKey){const p=coords(e);zoom(Math.exp(-e.deltaY*.003),p.x,p.y);}else{const unit=e.deltaMode===1?16:e.deltaMode===2?viewport.clientHeight:1;cam.x-=(e.shiftKey?e.deltaY:e.deltaX)*unit;cam.y-=(e.shiftKey?0:e.deltaY)*unit;applyCamera();}},{passive:false});
viewport.addEventListener('dblclick',e=>{if(editing)return;const p=coords(e);zoom(1.5,p.x,p.y);});
for(const k of ['name','region','x','y','width','rotation','opacity','z','visible','locked','description'])$(k).addEventListener('change',()=>{const p=item();if(!p)return;let val;const f=$(k);if(f.type==='checkbox')val=f.checked;else if(['name','region','description'].includes(k))val=f.value;else{val=Number(f.value);if(!Number.isFinite(val)){fillForm();return;}const ranges={x:[0,layout.mapSize.width],y:[0,layout.mapSize.height],width:[20,1600],rotation:[-180,180],opacity:[0,100],z:[0,999]};val=Math.max(ranges[k][0],Math.min(ranges[k][1],val));if(k==='opacity')val/=100;}snapshot();p[k]=val;render();save();});
$('editToggle').onclick=()=>setEditing(!editing);$('editSelected').onclick=()=>setEditing(true);$('closePop').onclick=hidePop;$('clean').onclick=clean;$('restore').onclick=clean;
$('fit').onclick=fit;$('actual').onclick=()=>zoom(1/cam.s);$('zoomIn').onclick=()=>zoom(1.25);$('zoomOut').onclick=()=>zoom(.8);$('undo').onclick=undo;$('redo').onclick=redo;$('focusItem').onclick=()=>focusItem();
$('toggleAll').onclick=()=>{allHidden=!allHidden;$('toggleAll').textContent=allHidden?'显示地标':'只看底图';render();};
$('duplicate').onclick=()=>{const p=item();if(!p)return;snapshot();const next=clone(p);next.id='copy-'+crypto.randomUUID();next.name+=' 副本';next.x=Math.min(layout.mapSize.width,p.x+40);next.y=Math.min(layout.mapSize.height,p.y+30);layout.landmarks.push(next);selected=next.id;render();save();};
function remove(){if(!item())return;snapshot();layout.landmarks=layout.landmarks.filter(p=>p.id!==selected);selected=null;render();save();}
$('remove').onclick=remove;
$('reset').onclick=()=>{snapshot();layout=clone(base);selected=null;allHidden=false;$('toggleAll').textContent='只看底图';render();save();fit();toast('已恢复初始布局，可撤销');};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);}
$('exportJSON').onclick=()=>{const custom={};for(const p of layout.landmarks)if(!config.assets[p.asset])custom[p.asset]=assets[p.asset];download(new Blob([JSON.stringify({...layout,customAssets:custom},null,2)],{type:'application/json'}),'九界地图-布局.json');toast('已导出布局 JSON');};
$('importJSON').onclick=()=>$('jsonFile').click();
$('jsonFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const next=JSON.parse(await file.text()),custom=next.customAssets||{};const additions={};for(const [id,src]of Object.entries(custom)){if(typeof src!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(src))throw Error('自定义素材格式无效');if(!assets[id])additions[id]=src;}const previous=assets;assets={...assets,...additions};try{validate(next);for(const [id,src]of Object.entries(additions))await loadImage(id,src);}catch(err){assets=previous;throw err;}snapshot();delete next.customAssets;layout=next;selected=null;render();save();fit();toast('已导入布局');}catch(err){toast('导入失败：'+err.message);}finally{e.target.value='';}};
$('exportPNG').onclick=async()=>{const b=$('exportPNG');b.disabled=true;try{const c=document.createElement('canvas');c.width=layout.mapSize.width*2;c.height=layout.mapSize.height*2;const ctx=c.getContext('2d');ctx.scale(2,2);ctx.drawImage(images.terrain,0,0,layout.mapSize.width,layout.mapSize.height);for(const p of [...layout.landmarks].sort((a,b)=>a.z-b.z)){if(!p.visible||allHidden)continue;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation*Math.PI/180);ctx.globalAlpha=p.opacity;ctx.drawImage(images[p.asset],-p.width/2,-height(p),p.width,height(p));ctx.restore();}c.toBlob(blob=>{if(blob){download(blob,'九界世界树-纯地图.png');toast('已导出无 UI 地图 PNG');}else toast('PNG 导出失败');},'image/png');}catch(err){toast('导出失败：'+err.message);}finally{b.disabled=false;}};
$('exportHTML').onclick=()=>{
 const doc=document.cloneNode(true);doc.getElementById('document-data').textContent=JSON.stringify({layout:clone(layout),assets,documentId:crypto.randomUUID()}).replaceAll('<','\\u003c');doc.getElementById('landmarks').replaceChildren();doc.getElementById('realmList').replaceChildren();doc.getElementById('world').removeAttribute('style');doc.body.className='';for(const id of ['editor','popover','tooltip','toast'])doc.getElementById(id).hidden=true;doc.getElementById('editToggle').textContent='编辑地图 ↗';download(new Blob(['<!doctype html>\n'+doc.documentElement.outerHTML],{type:'text/html;charset=utf-8'}),'九界地图-可编辑.html');toast('已保存独立 HTML，双击即可继续编辑');
};
$('addAsset').onclick=()=>$('assetFile').click();
$('assetFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>12*1024*1024)throw Error('图片请控制在 12 MB 以内');const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);}),id='custom-'+crypto.randomUUID();await loadImage(id,src);assets[id]=src;snapshot();const v=$('viewport');const p={id,asset:id,region:'自定义地区',name:file.name.replace(/\.[^.]+$/,''),x:Math.max(0,Math.min(layout.mapSize.width,(v.clientWidth/2-cam.x)/cam.s)),y:Math.max(0,Math.min(layout.mapSize.height,(v.clientHeight/2-cam.y)/cam.s)),width:200,rotation:0,opacity:1,z:20,visible:true,locked:false,description:''};layout.landmarks.push(p);selected=id;render();save();persistCustom();toast('已添加独立地标');}catch(err){toast('添加失败：'+err.message);}finally{e.target.value='';}};
function persistCustom(){try{const custom={};for(const p of layout.landmarks)if(!config.assets[p.asset])custom[p.asset]=assets[p.asset];localStorage.setItem(key+'-assets',JSON.stringify(custom));}catch{$('saveState').textContent='自定义图片过大，请保存可编辑 HTML。';}}
document.addEventListener('keydown',e=>{
 if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
 if(e.code==='Space'){space=true;e.preventDefault();return;}
 if(e.key==='Tab'){e.preventDefault();clean();return;}
 if(e.key==='Escape'){hidePop();if(document.body.classList.contains('clean'))clean();return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
 if(e.key.toLowerCase()==='e'){setEditing(!editing);return;}if(e.key.toLowerCase()==='f'){fit();return;}
 const p=item();if(editing&&p&&!p.locked&&e.key.startsWith('Arrow')){e.preventDefault();snapshot();const step=e.shiftKey?10:1;if(e.key==='ArrowLeft')p.x-=step;if(e.key==='ArrowRight')p.x+=step;if(e.key==='ArrowUp')p.y-=step;if(e.key==='ArrowDown')p.y+=step;p.x=Math.max(0,Math.min(layout.mapSize.width,p.x));p.y=Math.max(0,Math.min(layout.mapSize.height,p.y));render();save();}
});
document.addEventListener('keyup',e=>{if(e.code==='Space')space=false;});window.addEventListener('blur',()=>{space=false;gesture=null;pointers.clear();viewport.classList.remove('dragging');});window.addEventListener('resize',fit);
function loadImage(id,src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[id]=im;resolve();};im.onerror=()=>reject(Error('图片载入失败：'+id));im.src=src;});}
async function init(){
 // Custom assets must be restored before validating a saved layout.
 try{const custom=JSON.parse(localStorage.getItem(key+'-assets')||'{}');for(const [id,src]of Object.entries(custom))if(/^data:image\/(png|jpeg|webp);base64,/.test(src))assets[id]=src;const saved=localStorage.getItem(key);if(saved){const parsed=JSON.parse(saved);validate(parsed);layout=parsed;restored=true;}}catch(e){console.warn(e.message);}
 await Promise.all(Object.entries(assets).map(([id,src])=>loadImage(id,src)));$('terrain').src=assets.terrain;$('world').style.width=layout.mapSize.width+'px';$('world').style.height=layout.mapSize.height+'px';render();fit();if(restored)$('saveState').textContent='已恢复上次在此浏览器中的调整。';document.body.dataset.ready='true';
}
init().catch(e=>toast(e.message));
// Exposed read-only snapshot for integration checks and future engine adapters.
window.mapEditor={getLayout:()=>clone(layout),getCamera:()=>({...cam}),getSelected:()=>selected};
})();

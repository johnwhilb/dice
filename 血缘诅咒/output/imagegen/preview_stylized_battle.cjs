const fs = require('fs');
const path = require('path');
const {chromium} = require('C:/Users/DHXM/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const root=path.resolve(__dirname,'../..');
 const records=path.join(root,'拆分ui/战斗界面/处理记录/约瑟夫卡诊所-v01');
 const manifest=JSON.parse(fs.readFileSync(path.join(records,'素材清单.json'),'utf8'));
 const assets=manifest.assets.map(a=>({...a,data:'data:image/png;base64,'+fs.readFileSync(path.join(root,a.file)).toString('base64')}));
 const enemies=assets.filter(a=>a.key!=='background');
 const names={wolf:'兽化狼人',celestial:'小型天界使者',impostor:'假约瑟夫卡'};
 let html='<meta charset="utf-8"><style>body{margin:0;background:#ddd;font:18px sans-serif}.row{display:flex}.item{width:33.333%;text-align:center}.stage{height:640px;background:repeating-conic-gradient(#ddd 0% 25%,#aaa 0% 50%) 0/24px 24px}img{width:100%;height:100%;object-fit:contain}.white .stage{background:#fff}.dark .stage{background:#333}</style>';
 for(const cls of ['checker','white','dark']){
  html+=`<div class="row ${cls}">`;
  for(const a of enemies)html+=`<div class="item"><div>${names[a.key]} / ${cls}</div><div class="stage"><img src="${a.data}"></div></div>`;
  html+='</div>';
 }
 fs.writeFileSync(path.join(records,'透明边缘检查.html'),html);
 let composite='<meta charset="utf-8"><style>body{margin:0;background:#222}.stage{position:relative;width:1672px;height:941px;overflow:hidden}.stage img{position:absolute;max-width:none}</style><div class="stage">';
 composite+=`<img src="${assets[0].data}" style="left:0;top:0;width:1672px;height:941px">`;
 const placements=[];
 for(const a of enemies){
  const [x,y,w,h]=a.display_envelope_reference;
  const [x1,y1,x2,y2]=a.visible_bbox_alpha16;
  const scale=Math.min(w/(x2-x1),h/(y2-y1));
  const left=x+(w-(x2-x1)*scale)/2-x1*scale;
  const top=y+h-(y2-y1)*scale-y1*scale;
  const width=a.size[0]*scale,height=a.size[1]*scale;
  composite+=`<img src="${a.data}" style="left:${left}px;top:${top}px;width:${width}px;height:${height}px">`;
  placements.push({file:a.file,left,top,width,height,scale,usage:'仅素材组合核查参考，非与旧效果图逐像素复原'});
 }
 composite+='</div>';
 fs.writeFileSync(path.join(records,'素材组合预览.html'),composite);
 fs.writeFileSync(path.join(records,'组合预览布局.json'),JSON.stringify({canvas:manifest.canvas,placements},null,2));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:2000},deviceScaleFactor:1});
 await page.setContent(html,{waitUntil:'load'});
 await page.screenshot({path:path.join(records,'透明边缘检查.png'),fullPage:true});
 await page.setViewportSize({width:1672,height:941});
 await page.setContent(composite,{waitUntil:'load'});
 await page.screenshot({path:path.join(records,'素材组合预览.png')});
 await browser.close();
 console.log(path.join(records,'透明边缘检查.png'));
 console.log(path.join(records,'素材组合预览.png'));
})();

const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.join(__dirname,'index.html').replaceAll('\\','/'));
 await page.locator('.kingdom').last().waitFor();
 const data=await page.evaluate(()=>window.mapDesign);
 assert.equal(data.realms.length,9);assert.equal(await page.locator('.kingdom').count(),9);assert.equal(await page.locator('.anomaly').count(),3);assert.equal(await page.locator('.selected').count(),1);
 const names=new Set(data.realms.map(w=>w.name));assert.equal(names.size,9);
 for(const w of data.realms){assert(w.layer>=1&&w.layer<=11);assert(w.x>100&&w.x<1180&&w.y>100&&w.y<600)}
 assert.equal(data.layout.currentNodesPerWorld,1);
 for(const w of data.realms){
 await page.locator('[data-world="'+w.id+'"]').click();
 assert.equal(await page.locator('#selected-name').innerText(),w.name);assert.equal(await page.locator('.selected').count(),1);
 assert((await page.locator('#selected-event').innerText()).includes(w.event));
 }
 await page.locator('#quest-toggle').click();assert((await page.locator('#quest-state').innerText()).includes('进行中'));
 await page.locator('#quest-toggle').click();assert((await page.locator('#quest-state').innerText()).includes('已暂停'));
 await page.locator('[data-world="mid"]').click();await page.locator('#enter').click();assert((await page.locator('#announce').innerText()).includes('米德加德国'));
 await page.locator('#announce').evaluate(e=>e.classList.remove('show'));
 await page.screenshot({path:path.join(__dirname,'mobile-map-design.png')});
 const bounds=await page.locator('.kingdom').evaluateAll(nodes=>nodes.map(e=>({world:e.dataset.world,x:e.offsetLeft,y:e.offsetTop,w:e.offsetWidth,h:e.offsetHeight})));
 const labelCollisions=await page.locator('.info').evaluateAll(nodes=>{const rects=nodes.map(e=>e.getBoundingClientRect());let n=0;for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)n++}return n});
 assert.equal(labelCollisions,0);
 await page.setViewportSize({width:960,height:540});await page.screenshot({path:path.join(__dirname,'mobile-map-phone.png')});
 const phone=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,viewW:innerWidth,viewH:innerHeight,rect:document.querySelector('#frame').getBoundingClientRect().toJSON()}));
 assert.equal(phone.w,phone.viewW);assert.equal(phone.h,phone.viewH);assert(phone.rect.width<=phone.viewW&&phone.rect.height<=phone.viewH);
 for(const w of data.realms){const target=page.locator('[data-world="'+w.id+'"]');await target.click();assert.equal(await page.locator('#selected-name').innerText(),w.name)}
 await page.setViewportSize({width:844,height:390});await page.screenshot({path:path.join(__dirname,'mobile-map-wide-phone.png')});
 const visible=await page.locator('.kingdom').evaluateAll(nodes=>nodes.every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}));
 assert(visible);assert.equal(errors.length,0);
 fs.writeFileSync(path.join(__dirname,'mobile-map-data.json'),JSON.stringify({layout:data.layout,realms:data.realms,checks:{currentNodes:9,labelCollisions,phoneOverflow:false,selection:true,questPauseResume:true,javascriptErrors:errors}},null,2));
 console.log(JSON.stringify({kingdoms:9,currentNodes:9,anomalies:3,labelCollisions,phoneOverflow:false,sizes:['1280x720','960x540','844x390'],selection:true,questPauseResume:true,javascriptErrors:errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});


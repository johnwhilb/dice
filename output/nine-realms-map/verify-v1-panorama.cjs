const fs=require('fs');
const path=require('path');
const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.join(__dirname,'index.html').replaceAll('\\','/'));
 await page.locator('.node').last().waitFor();
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))});
 const report=await page.evaluate(()=>{
  const d=window.mapDesign;
  return {worlds:d.worlds.map(w=>({id:w.id,name:w.name,completed:w.done,nodes:[...document.querySelectorAll('.node[data-world="'+w.id+'"]')].map(n=>({layer:+n.dataset.layer,type:n.dataset.type,baseType:n.dataset.baseType,state:n.dataset.state,x:parseFloat(n.style.left),y:parseFloat(n.style.top)}))})),nodeCount:document.querySelectorAll('.node').length,anomalies:[...document.querySelectorAll('.node.anomaly')].map(n=>({world:n.dataset.world,layer:+n.dataset.layer,state:n.dataset.state,baseType:n.dataset.baseType})),completedBosses:document.querySelectorAll('.node.boss.done').length};
 });
 assert.equal(report.worlds.length,9);assert.equal(report.nodeCount,99);assert.equal(report.anomalies.length,3);assert.equal(report.completedBosses,1);
 for(const w of report.worlds){
  assert.equal(w.nodes.length,11);
  assert.deepEqual(w.nodes.map(n=>n.layer),Array.from({length:11},(_,i)=>i+1));
  const counts={};for(const n of w.nodes){counts[n.baseType]=(counts[n.baseType]||0)+1;assert(n.x>200&&n.x<3800&&n.y>200&&n.y<2200)}
  assert.deepEqual(counts,{battle:7,merchant:1,event:1,camp:1,boss:1});
 }
 for(const a of report.anomalies){assert.equal(a.state,'current');assert.equal(a.baseType,'battle')}
 await page.locator('.node[data-world="mid"][data-layer="5"]').click();
 assert.match(await page.locator('#selection').innerText(),/限时异动/);
 await page.locator('#questresume').click();assert.match(await page.locator('#queststatus').innerText(),/进行中/);
 await page.locator('#questresume').click();assert.match(await page.locator('#queststatus').innerText(),/已暂停/);
 await page.mouse.move(900,500);await page.mouse.wheel(0,-250);
 const zoom=await page.locator('#zoomlabel').innerText();assert.notEqual(zoom,'62%');
 await page.locator('#home').click();
 const before=await page.locator('#viewport').evaluate(e=>({x:e.scrollLeft,y:e.scrollTop}));
 await page.mouse.move(850,480);await page.mouse.down();await page.mouse.move(1050,580,{steps:12});await page.mouse.up();
 const after=await page.locator('#viewport').evaluate(e=>({x:e.scrollLeft,y:e.scrollTop}));
 assert(after.x<before.x&&after.y<before.y);
 await page.locator('#home').click();
 await page.screenshot({path:path.join(__dirname,'nine-realms-viewport.png')});
 await page.setViewportSize({width:3840,height:2400});await page.locator('#fit').click();
 await page.locator('#selection').evaluate(e=>e.innerHTML='');
 await page.screenshot({path:path.join(__dirname,'nine-realms-ui-final.png')});
 await page.setViewportSize({width:900,height:700});await page.locator('#fit').click();
 const layout=await page.evaluate(()=>({hud:document.querySelector('#hud').getBoundingClientRect().bottom,map:document.querySelector('#viewport').getBoundingClientRect(),footer:document.querySelector('#footer').getBoundingClientRect().top}));
 assert(layout.hud<layout.footer);assert.equal(errors.length,0);
 fs.writeFileSync(path.join(__dirname,'map-data.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({worlds:report.worlds.length,nodes:report.nodeCount,anomalies:report.anomalies,completedBosses:report.completedBosses,drag:true,zoom:true,questPauseResume:true,javascriptErrors:errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

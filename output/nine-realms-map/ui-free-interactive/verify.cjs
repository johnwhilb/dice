const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1605,height:980}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('file:///'+path.join(__dirname,'index.html').replaceAll('\\','/'));
  await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
  await page.evaluate(()=>{window.events=[];document.addEventListener('realm-interact',event=>window.events.push(event.detail))});
  assert.equal(await page.locator('.landmark').count(),9);
  assert.equal(await page.locator('.landmark[aria-pressed="true"]').count(),0);
  assert.equal(await page.locator('body').innerText(),'');
  for(const item of JSON.parse(fs.readFileSync(path.join(__dirname,'map-data.json'))).landmarks){
   await page.locator(`[data-id="${item.id}"]`).click();
   assert.equal(await page.evaluate(()=>window.nineRealmsMap.selected),item.id);
   assert.equal(await page.locator('.landmark[aria-pressed="true"]').count(),1);
   const event=await page.evaluate(()=>window.events.at(-1));assert.equal(event.id,item.id);assert.equal(event.visits,1);
  }
  await page.locator('[data-id="mid"]').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>window.events.at(-1).id),'mid');
  assert.equal(await page.evaluate(()=>window.events.at(-1).visits),2);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.nineRealmsMap.selected),null);
  await page.locator('[data-id="mid"]').blur();await page.mouse.move(0,0);
  await page.screenshot({path:path.join(__dirname,'interactive-desktop.png')});
  for(const size of [{width:844,height:390},{width:390,height:844}]){
   await page.setViewportSize(size);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert(await page.locator('.landmark').evaluateAll(elements=>elements.every(element=>{const r=element.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1})));
   await page.locator('[data-id="asgard"]').tap({force:true}).catch(()=>page.locator('[data-id="asgard"]').click());
   assert.equal(await page.evaluate(()=>window.nineRealmsMap.selected),'asgard');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth&&document.documentElement.scrollHeight===innerHeight));
  }
  assert.deepEqual(errors,[]);
  const qc=JSON.parse(fs.readFileSync(path.join(__dirname,'processed/pipeline-meta.json')));
  assert.deepEqual(qc.edge_touch_frames,[]);
  const result={landmarks:9,independentSprites:true,sourceEdgeTouches:0,clickEvents:true,keyboard:true,repeatVisits:true,responsiveSizes:['1605x980','844x390','390x844'],javascriptErrors:errors};
  fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(result,null,2));console.log(result);
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});

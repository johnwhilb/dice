const fs = require('fs');
const path = require('path');
const {chromium} = require('C:/Users/DHXM/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
const folder='C:/Users/DHXM/.codex/generated_images/01a175f4-97e3-73a3-aace-7685d802be91';
const items=[['兽化狼人','exec-27290bb5-1b4b-4bfe-babd-4afcbc8cec2e.png'],['小型天界使者','exec-5949f25e-a29d-4399-9132-9d35c99b57a4.png'],['假约瑟夫卡','exec-5b691aab-0061-4ed5-9e40-d877f7424ee1.png']];
let html='<meta charset="utf-8"><style>body{margin:0;background:#ddd;font:18px sans-serif}.row{display:flex}.item{width:33.333%;text-align:center}.stage{height:640px;background:repeating-conic-gradient(#ddd 0% 25%,#aaa 0% 50%) 0/24px 24px}img{width:100%;height:100%;object-fit:contain}.white .stage{background:#fff}.dark .stage{background:#333}</style>';
for(const cls of ['checker','white','dark']){
 html+=`<div class="row ${cls}">`;
 for(const [label,name] of items){
 const data=fs.readFileSync(path.join(folder,name)).toString('base64');
 html+=`<div class="item"><div>${label} / ${cls}</div><div class="stage"><img src="data:image/png;base64,${data}"></div></div>`;
 }
 html+='</div>';
}
fs.writeFileSync(path.join(__dirname,'约瑟夫卡诊所-透明检查.html'),html);
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1500,height:2000},deviceScaleFactor:1});
await page.setContent(html,{waitUntil:'load'});
await page.screenshot({path:path.join(__dirname,'约瑟夫卡诊所-透明检查.png'),fullPage:true});
await browser.close();
console.log(path.join(__dirname,'约瑟夫卡诊所-透明检查.png'));
})();

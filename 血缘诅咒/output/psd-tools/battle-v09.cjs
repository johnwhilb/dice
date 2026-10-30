const fs=require('fs'),path=require('path');
const runtime='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/';
const {createCanvas,loadImage,GlobalFonts}=require(runtime+'node_modules/@napi-rs/canvas');
const sharp=require(runtime+'node_modules/sharp');
process.env.NODE_PATH=[path.join(__dirname,'node_modules/.pnpm/pako@2.1.0/node_modules'),path.join(__dirname,'node_modules/.pnpm/base64-js@1.5.1/node_modules')].join(path.delimiter);require('module').Module._initPaths();
const ag=require('./node_modules/.pnpm/ag-psd@32.0.0/node_modules/ag-psd');ag.initializeCanvas(createCanvas);
GlobalFonts.registerFromPath('C:/Windows/Fonts/simsun.ttc','ProjectSong');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'拆分ui/战斗界面/v09详细拆分-v01');
const gen='C:/Users/Administrator/.codex/generated_images/01a187e7-9103-7f53-a241-d80ae6a2499c/';
const files={ui:gen+'exec-e5417b23-5492-4394-9bba-d6898519854a.png',bg:gen+'exec-e9c37bc1-5815-425b-bca6-b54c99c4f3b6.png',enemy:gen+'exec-4f51b369-75a9-4ce5-88fb-867ae089eedd.png',source:path.join(root,'生成界面/未命名游戏-战斗界面-草稿-v09.png')};
const W=1672,H=941;
const poly=(name,pts)=>({name,pts});
const box=(name,x,y,w,h)=>poly(name,[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
const defs=[
poly('顶部状态底板',[[0,0],[1074,0],[1065,28],[1052,43],[1046,57],[1025,72],[61,72],[42,53],[40,43],[0,43]]),
poly('暂停按钮',[[1622,4],[1660,43],[1622,82],[1583,43]]),
box('道具袋面板',37,116,172,86),
box('敌人血条1',489,134,166,15),box('敌人血条2',768,126,168,13),box('敌人血条3',1064,148,167,13),
poly('抽牌按钮',[[297,616],[327,582],[512,582],[540,615],[513,648],[327,648]]),
poly('重掷按钮',[[1130,615],[1156,582],[1339,582],[1366,615],[1338,648],[1156,648]]),
poly('结束回合按钮',[[1381,615],[1410,583],[1633,583],[1660,615],[1631,648],[1410,648]]),
...[[607,577],[702,577],[798,577],[894,577],[990,577]].map(([x,y],i)=>box('资源容器'+(i+1),x,y,74,74)),
poly('连接装饰左',[[540,610],[558,610],[572,601],[584,611],[605,611],[605,620],[583,620],[572,630],[558,620],[540,620]]),
poly('连接装饰右',[[1065,610],[1087,610],[1099,601],[1110,611],[1130,611],[1130,620],[1110,620],[1099,630],[1087,620],[1065,620]]),
poly('牌库面板',[[62,774],[220,774],[230,785],[230,873],[218,884],[62,884],[51,872],[51,786]]),
poly('弃牌面板',[[1451,774],[1609,774],[1621,787],[1621,873],[1609,884],[1450,884],[1439,871],[1439,786]]),
poly('手牌总组',[[371,719],[382,709],[547,684],[557,691],[565,681],[730,670],[739,678],[744,664],[920,664],[929,678],[940,675],[1106,686],[1116,698],[1127,689],[1292,716],[1300,728],[1266,923],[1257,931],[1095,906],[1085,908],[931,895],[921,899],[752,899],[741,895],[581,908],[570,906],[413,929],[403,922]])
];
function save(c,file){fs.writeFileSync(path.join(out,file),c.toBuffer('image/png'));}
function clip(image,pts){const c=createCanvas(W,H),g=c.getContext('2d');g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.clip();g.drawImage(image,0,0,W,H);return c;}
function backgrounds(c,prefix){for(const [name,col]of [['白底','#ffffff'],['深灰底','#333333'],['棋盘底',null]]){const b=createCanvas(W,H),g=b.getContext('2d');if(col){g.fillStyle=col;g.fillRect(0,0,W,H);}else for(let y=0;y<H;y+=20)for(let x=0;x<W;x+=20){g.fillStyle=(x/20+y/20)%2?'#bbb':'#eee';g.fillRect(x,y,20,20);}g.drawImage(c,0,0);save(b,'验收预览/'+prefix+name+'.png');}}
async function prep(){for(const d of ['组件','验收预览','素材/背景','素材/敌人'])fs.mkdirSync(path.join(out,d),{recursive:true});const im=await loadImage(files.ui),c=createCanvas(W,H),g=c.getContext('2d');for(const d of defs)g.drawImage(clip(im,d.pts),0,0);save(c,'UI总层-无文字.png');backgrounds(c,'UI-');const zoom=createCanvas(1000,500);zoom.getContext('2d').drawImage(c,350,650,1000,291,0,0,1000,291);save(zoom,'验收预览/手牌边缘放大.png');console.log(out);}
if(process.argv[2]==='prep')prep();
module.exports={fs,path,createCanvas,loadImage,ag,sharp,root,out,files,W,H,defs,save,clip,backgrounds};

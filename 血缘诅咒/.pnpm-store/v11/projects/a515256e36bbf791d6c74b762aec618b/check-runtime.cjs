const M=require('module'),p=require('path'),orig=M._resolveFilename;
M._resolveFilename=function(n,...args){if(n==='pako')return p.join(__dirname,'node_modules/.pnpm/pako@2.1.0/node_modules/pako/index.js');if(n==='base64-js')return p.join(__dirname,'node_modules/.pnpm/base64-js@1.5.1/node_modules/base64-js/index.js');return orig.call(this,n,...args)};
const ag=require('./node_modules/.pnpm/ag-psd@32.0.0/node_modules/ag-psd');
const cv=require('C:/Users/DHXM/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
console.log(JSON.stringify({ag:typeof ag.writePsdBuffer,canvas:typeof cv.createCanvas}));

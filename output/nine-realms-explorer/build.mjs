import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root=path.dirname(fileURLToPath(import.meta.url));
const template=fs.readFileSync(path.join(root,'index.template.html'),'utf8');
const script=template.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if(!script)throw new Error('Missing map script');
new vm.Script(script,{filename:'index.html inline JavaScript'});
const png=fs.readFileSync(path.join(root,'map.png'));
if(png.readUInt32BE(0)!==0x89504e47)throw new Error('Map is not a PNG');
const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
if(Math.abs(width/height-1.5)>.01)throw new Error('Map must have a 3:2 aspect ratio');
const embedded=template.replace('src="map.png"',`src="data:image/png;base64,${png.toString('base64')}"`);
if(embedded===template)throw new Error('Map image was not embedded');
fs.writeFileSync(path.join(root,'index.html'),embedded);
fs.writeFileSync(path.join(root,'check-script.js'),script);
console.log(JSON.stringify({html:'index.html',width,height,bytes:Buffer.byteLength(embedded),syntax:'passed',selfContained:true}));

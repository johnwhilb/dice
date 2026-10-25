const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const layout=JSON.parse(fs.readFileSync(path.join(root,'layout.json'),'utf8'));
const ids=['terrain',...new Set(layout.landmarks.map(p=>p.asset))];
const assets=Object.fromEntries(ids.map(id=>[id,'data:image/png;base64,'+fs.readFileSync(path.join(root,'assets',id+'.png')).toString('base64')]));
const html=fs.readFileSync(path.join(root,'template.html'),'utf8').replace('/*STYLES*/',()=>fs.readFileSync(path.join(root,'style.css'),'utf8')).replace('/*SCRIPT*/',()=>fs.readFileSync(path.join(root,'editor.js'),'utf8')).replace('/*DATA*/',()=>JSON.stringify({layout,assets,documentId:'norse-worldtree-20261024'}).replaceAll('<','\\u003c'));
fs.writeFileSync(path.join(root,'index.html'),html);
console.log('Built offline HTML:',Buffer.byteLength(html),'bytes;',layout.landmarks.length,'independent landmarks');

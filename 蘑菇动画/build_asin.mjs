import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const out='outputs/asin-20261113';await fs.mkdir(out,{recursive:true});
const w=await SpreadsheetFile.importXlsx(await FileBlob.load('C:/Users/DHXM/xwechat_files/wxid_sg26ic6mmdv611_3e1b/msg/file/2026-11/Ref ASIN - 副本.xlsx'));
const s=w.worksheets.getItem('Sheet1');
const images=JSON.parse(await fs.readFile('asin_work/images.json','utf8'));
const details=JSON.parse(await fs.readFile('asin_work/details.json','utf8'));
console.log('Imported workbook and data');
const ids=['B0BKGCN9P6','B09S9SW2VJ','B08JCQPDZ3','B08ND49388','B08ND49388','B0D8BCY87D','B0D6RJ42M2','B07P6KPQHW','B0F2411PZZ','B075DP3KV9'];
console.log('Setting font');
s.getRange('A1:G11').format.font={name:'Arial',size:11};
console.log('Setting layout');
s.getRange('A1:G11').format.verticalAlignment='center';
s.getRange('B2:G11').format.wrapText=true;
for(const [col,width] of Object.entries({A:120,B:172,C:355,D:270,E:165,F:285,G:270}))s.getRange(`${col}1:${col}11`).format.columnWidthPx=width;
s.getRange('A1:G1').format.rowHeightPx=30;
s.getRange('A2:G11').format.rowHeightPx=185;
for(let i=0;i<ids.length;i++){
 console.log('Writing row',i+2);
 const a=ids[i],r=i+2,d=details[a];
 const title=images[a].title.replaceAll('&amp;','&').replaceAll('\\/','/');
 s.getRange(`C${r}:F${r}`).values=[[title,d.size,d.material,d.features]];
 if(r===6)s.getRange('A6').values=[[a]];
 const buf=await fs.readFile(`asin_work/${a}.jpg`);
 // Add a pre-fitted white canvas so every product keeps its aspect ratio.
 const png=await fs.readFile(`asin_work/${a}-thumb.png`);
 s.images.add({dataUrl:`data:image/png;base64,${png.toString('base64')}`,anchor:{from:{row:r-1,col:1},extent:{widthPx:166,heightPx:176}}});
}
function note(cell,body){w.notes.add({id:`Sheet1:${cell}`,target:{cell:{sheetName:'Sheet1',sheetId:s.sheetId,address:cell}},authorId:'',createdAt:'',body:{plainText:body}});}
note('C4','Amazon page could not be retrieved. Cross-checked by exact ASIN B08JCQPDZ3 at https://manuals.plus/asin/B08JCQPDZ3 and https://zambia.desertcart.com/products/230891355-vingli-portable-toilet-indoor-outdoor-commode-w-detachable-inner-bucket . Main image is the Amazon-hosted product image linked by Manuals+. Listed height is inconsistent with closed-lid dimensions on other retailer pages and needs verification.');
note('D2','Amazon product overview lists 16.5 in height and 2.68 kg. Feature text instead mentions 15.7 in height. The size cell follows the product overview.');
note('D9','Bag size follows the Amazon product description (18.5 x 19.7 in); weight follows technical details (0.41 kg). Description separately lists 0.97 lb.');
note('A6','Original row contained only a repeated Website link. ASIN and product information were filled from that link; the row was preserved.');
note('F10','Follow the listing instructions: switch off and remove the immersion heater before immersing or operating the shower pump.');
w.recalculate();
console.log((await w.inspect({kind:'table',range:'Sheet1!A1:G11',include:'values',tableMaxRows:11,tableMaxCols:7})).ndjson);
await (await SpreadsheetFile.exportXlsx(w)).save(`${out}/Ref ASIN - Completed.xlsx`);
console.log('EXPORTED');

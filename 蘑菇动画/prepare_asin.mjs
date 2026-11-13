import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const w=await SpreadsheetFile.importXlsx(await FileBlob.load('C:/Users/DHXM/xwechat_files/wxid_sg26ic6mmdv611_3e1b/msg/file/2026-11/Ref ASIN - 副本.xlsx'));
console.log((await w.inspect({kind:'table',range:'Sheet1!A1:G11',include:'values',tableMaxRows:11,tableMaxCols:7})).ndjson);
const p=await w.render({sheetName:'Sheet1',range:'A1:G5',scale:1,format:'png'});
await fs.writeFile('asin_work/before.png',new Uint8Array(await p.arrayBuffer()));

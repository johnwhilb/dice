import { promises } from "fs";
import JSZip from "jszip";
import { Workbook } from "exceljs";

/** 等待读取 src 指定的 Excel，并兼容带命名空间前缀的标准 SpreadsheetML；不修改源表。 */
export async function readWorkbook(src: string) {
    const buffer = await promises.readFile(src);
    const archive = await JSZip.loadAsync(buffer);
    let normalized = false;
    for (const entry of Object.values(archive.files)) {
        if (entry.dir || !entry.name.startsWith("xl/") || !entry.name.endsWith(".xml")) {
            continue;
        }
        const text = await entry.async("string");
        const namespace = text.match(/xmlns:([A-Za-z][\w.-]*)=(["'])http:\/\/schemas.openxmlformats.org\/spreadsheetml\/2006\/main\2/);
        if (namespace) {
            const prefix = namespace[1];
            archive.file(entry.name, text
                .replace(namespace[0], 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')
                .split(`<${prefix}:`).join("<")
                .split(`</${prefix}:`).join("</"));
            normalized = true;
        }
    }
    const workbook = new Workbook();
    await workbook.xlsx.load(normalized ? await archive.generateAsync({ type: "nodebuffer" }) : buffer);
    return workbook;
}

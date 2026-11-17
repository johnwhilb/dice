"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readWorkbook = void 0;
const fs_1 = require("fs");
const jszip_1 = __importDefault(require("jszip"));
const exceljs_1 = require("exceljs");
/** 等待读取 src 指定的 Excel，并兼容带命名空间前缀的标准 SpreadsheetML；不修改源表。 */
async function readWorkbook(src) {
    const buffer = await fs_1.promises.readFile(src);
    const archive = await jszip_1.default.loadAsync(buffer);
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
    const workbook = new exceljs_1.Workbook();
    await workbook.xlsx.load(normalized ? await archive.generateAsync({ type: "nodebuffer" }) : buffer);
    return workbook;
}
exports.readWorkbook = readWorkbook;

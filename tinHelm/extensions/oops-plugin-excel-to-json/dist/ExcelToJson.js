"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const path_1 = __importDefault(require("path"));
const JsonToTs_1 = require("./JsonToTs");
const main_1 = require("./main");
const fs = require("fs");
const excel = require("exceljs");
/**
 * 读取 Excel 第二个 Sheet 生成 Enum
 *
 * Sheet2:
 * 1001    Dwarf
 * 1002    Elf
 *
 * Race.xlsx =>
 *
 * export enum EnumRace {
 *     Dwarf = 1001,
 *     Elf = 1002,
 * }
 *
 * Enum 只负责提供明确的配置 ID，不生成 getAllEnum()。
 */
async function createEnumTs(workbook, name) {
    if (workbook.worksheets.length < 2) {
        return;
    }
    const worksheet = workbook.worksheets[1];
    const enumName = `Enum${name}`;
    let fields = "";
    worksheet.eachRow((row, rowNumber) => {
        const idText = row.getCell(1).text.trim();
        const memberName = row.getCell(2).text.trim();
        if (idText === "" && memberName === "") {
            return;
        }
        const id = parseInt(idText);
        if (Number.isNaN(id)) {
            console.warn(`文件【${name}】Sheet2 第【${rowNumber}】行枚举值错误：【${idText}】`);
            return;
        }
        if (memberName === "") {
            console.warn(`文件【${name}】Sheet2 第【${rowNumber}】行枚举名称为空`);
            return;
        }
        if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(memberName)) {
            console.warn(`文件【${name}】Sheet2 第【${rowNumber}】行枚举名称不合法：【${memberName}】`);
            return;
        }
        fields += `    ${memberName} = ${id},\n`;
    });
    if (fields === "") {
        return;
    }
    const script = `/**
 * 自动生成文件，请勿手动修改
 */
export enum ${enumName} {
${fields}}
`;
    const p = path_1.default.join(__dirname, main_1.config.PathTsClient.replace("project://", "../../../") + "/");
    fs.writeFileSync(`${p}${enumName}.ts`, script);
    console.log(`枚举【${enumName}】生成成功`);
}
/**
 * Excel 转 Json 数据
 * @param src       读取的 Excel 文件目录
 * @param dst       导出的 Json 文件目录
 * @param name      Excel 文件名
 * @param isClient  是否为客户端数据
 */
function getCellValue(cell) {
    return cell.formula ? cell.result : cell.text;
}
function parseJsonCellValue(src, key, type, value, cell) {
    const text = String(value).trim();
    if (text === "") {
        return null;
    }
    try {
        return JSON.parse(text);
    }
    catch (_a) {
        console.log("Cell " +
            cell.address +
            " has value " +
            cell.text);
        console.warn("File [" + src + "] field [" + key + "] type [" + type + "] value [" + value + "] JSON parse error");
        return null;
    }
}
function parseBooleanCellValue(src, key, value) {
    if (typeof value === "boolean") {
        return value;
    }
    const text = String(value).trim().toLowerCase();
    if (text === "true") {
        return true;
    }
    if (text === "false") {
        return false;
    }
    console.warn("File [" + src + "] field [" + key + "] boolean value must be true/false, current value: " + value);
    return false;
}
function getJsonTypeValue(src, key, type, value, cell) {
    const parsed = parseJsonCellValue(src, key, type, value, cell);
    if (parsed != null &&
        !Array.isArray(parsed) &&
        typeof parsed === "object") {
        return parsed;
    }
    console.warn("File [" + src + "] field [" + key + "] json type must be a valid JSON object");
    return null;
}
function getArrayTypeValue(src, key, type, value, cell) {
    const parsed = parseJsonCellValue(src, key, type, value, cell);
    if (Array.isArray(parsed)) {
        return parsed;
    }
    console.warn("File [" + src + "] field [" + key + "] array type must be a valid JSON array");
    return [];
}
async function convert(src, dst, name, isClient) {
    let r = {};
    let names = [];
    let keys = [];
    let types = [];
    let types_client = {};
    let servers = [];
    let clients = [];
    let primary = [];
    let primary_index = [];
    const workbook = new excel.Workbook();
    await workbook.xlsx.readFile(src);
    console.log("读取Excel文件成功", src);
    if (isClient) {
        await createEnumTs(workbook, name);
    }
    const worksheet = workbook.getWorksheet(1);
    worksheet.eachRow((row, rowNumber) => {
        let data = {};
        row.eachCell((cell, colNumber) => {
            const value = cell.text;
            if (rowNumber === 1) {
                names.push(value);
                if (value.indexOf("【KEY】") > -1) {
                    primary_index.push(colNumber);
                }
            }
            else if (rowNumber === 2) {
                keys.push(value);
                if (primary_index.indexOf(colNumber) > -1) {
                    primary.push(value);
                }
            }
            else if (rowNumber === 3) {
                types.push(value);
            }
            else if (isClient === false && rowNumber === 4) {
                servers.push(value);
            }
            else if (isClient === true && rowNumber === 5) {
                clients.push(value);
            }
            else if (rowNumber > 5) {
                const index = colNumber - 1;
                const type = String(types[index]).trim().toLowerCase();
                const server = servers[index];
                const client = clients[index];
                const isWrite = (isClient && client === "client") ||
                    (!isClient && server === "server");
                if (!isWrite) {
                    return;
                }
                const key = keys[index];
                switch (type) {
                    case "int":
                        data[key] = parseInt(getCellValue(cell));
                        types_client[key] = {
                            en: "number",
                            zh: names[index]
                        };
                        break;
                    case "float":
                        data[key] = parseFloat(getCellValue(cell));
                        types_client[key] = {
                            en: "number",
                            zh: names[index]
                        };
                        break;
                    case "string":
                        data[key] = value;
                        types_client[key] = {
                            en: "string",
                            zh: names[index]
                        };
                        break;
                    case "boolean":
                        data[key] = parseBooleanCellValue(src, key, getCellValue(cell));
                        types_client[key] = {
                            en: "boolean",
                            zh: names[index]
                        };
                        break;
                    case "json":
                        data[key] = getJsonTypeValue(src, key, type, getCellValue(cell), cell);
                        types_client[key] = {
                            en: "Record<string, any>",
                            zh: names[index]
                        };
                        break;
                    case "array":
                        data[key] = getArrayTypeValue(src, key, type, getCellValue(cell), cell);
                        types_client[key] = {
                            en: "any[]",
                            zh: names[index]
                        };
                        break;
                    case "any":
                        try {
                            data[key] = JSON.parse(String(getCellValue(cell)).trim());
                            types_client[key] = {
                                en: "any",
                                zh: names[index]
                            };
                        }
                        catch (_a) {
                            console.log("Cell " +
                                cell.address +
                                " has value " +
                                cell.text);
                            console.warn("File [" + src + "] field [" + key + "] value [" + value + "] JSON parse error [" + client + "]");
                        }
                        break;
                }
            }
        });
        if (rowNumber > 5) {
            let temp = null;
            for (let i = 0; i < primary.length; i++) {
                const k = primary[i];
                const id = data[k];
                delete data[k];
                if (primary.length === 1) {
                    r[id] = data;
                }
                else {
                    if (i === primary.length - 1) {
                        temp[id] = data;
                    }
                    else if (i === 0) {
                        if (r[id] === undefined) {
                            r[id] = {};
                        }
                        temp = r[id];
                    }
                    else {
                        temp[id] = {};
                        temp = temp[id];
                    }
                }
            }
        }
    });
    if (r["undefined"] == null) {
        fs.writeFileSync(dst, JSON.stringify(r));
        if (isClient) {
            await (0, JsonToTs_1.createTsClient)(name, types_client, r, primary);
        }
        else {
            await (0, JsonToTs_1.createTsServer)(name, types_client, r, primary);
        }
        console.log(isClient ? "客户端数据" : "服务器数据", "生成成功", dst);
    }
    else {
        console.log(isClient ? "客户端数据" : "服务器数据", "无数据", dst);
    }
}
function run() {
    const inputExcelPath = path_1.default.join(__dirname, main_1.config.PathExcel.replace("project://", "../../../") + "/");
    const outJsonPathClient = path_1.default.join(__dirname, main_1.config.PathJsonClient.replace("project://", "../../../") + "/");
    let outJsonPathServer = null;
    if (main_1.config.PathJsonServer != null &&
        main_1.config.PathJsonServer.length > 0) {
        outJsonPathServer = path_1.default.join(__dirname, main_1.config.PathJsonServer.replace("project://", "../../../") + "/");
    }
    const files = fs.readdirSync(inputExcelPath);
    files.forEach((f) => {
        const name = f.substring(0, f.indexOf("."));
        const ext = f.toString().substring(f.lastIndexOf(".") + 1);
        if (ext !== "xlsx") {
            return;
        }
        if (outJsonPathServer) {
            convert(inputExcelPath + f, outJsonPathServer + name + ".json", name, false);
        }
        convert(inputExcelPath + f, outJsonPathClient + name + ".json", name, true);
    });
}
exports.run = run;

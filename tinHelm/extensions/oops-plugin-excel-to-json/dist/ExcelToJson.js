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
const LOCAL_ID_BASE = 10000;
function parseTableIdentity(fileName) {
    const resourceName = path_1.default.basename(fileName, path_1.default.extname(fileName));
    const match = /^(\d+)_([A-Za-z][A-Za-z0-9]*)$/.exec(resourceName);
    if (!match) {
        throw new Error(`配置表文件名【${fileName}】不合法，必须使用“表ID_表名.xlsx”，例如“1_Role.xlsx”`);
    }
    const tableId = Number(match[1]);
    if (!Number.isInteger(tableId) || tableId <= 0) {
        throw new Error(`配置表【${resourceName}】的表ID必须是大于0的整数`);
    }
    return {
        tableId,
        resourceName,
        className: match[2]
    };
}
function validatePrimaryId(identity, rowNumber, id) {
    const localId = id % LOCAL_ID_BASE;
    const ownerTableId = Math.floor(id / LOCAL_ID_BASE);
    if (!Number.isInteger(id)) {
        throw new Error(`配置表【${identity.resourceName}】第【${rowNumber}】行主键必须是整数，当前值：【${id}】`);
    }
    if (ownerTableId !== identity.tableId) {
        throw new Error(`配置表【${identity.resourceName}】第【${rowNumber}】行主键【${id}】不属于表ID【${identity.tableId}】`);
    }
    if (localId <= 0 || localId >= LOCAL_ID_BASE) {
        throw new Error(`配置表【${identity.resourceName}】第【${rowNumber}】行主键【${id}】后四位必须在0001到9999之间`);
    }
}
/**
 * 读取 Excel 第二个 Sheet 生成 Enum
 *
 * Sheet2:
 * 10001    Dwarf
 * 10002    Elf
 *
 * Race.xlsx =>
 *
 * export enum EnumRace {
 *     Dwarf = 10001,
 *     Elf = 10002,
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
async function convert(src, dst, identity, isClient) {
    const name = identity.className;
    let r = {};
    let names = [];
    let keys = [];
    let types = [];
    let types_client = {};
    let servers = [];
    let clients = [];
    let primary = [];
    let primary_index = [];
    const primaryIds = new Set();
    const workbook = new excel.Workbook();
    await workbook.xlsx.readFile(src);
    console.log("读取Excel文件成功", src);
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet || worksheet.name !== identity.resourceName) {
        throw new Error(`配置表【${identity.resourceName}】第一个工作表名称必须是【${identity.resourceName}】`);
    }
    if (isClient) {
        await createEnumTs(workbook, name);
    }
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
            if (primary.length !== 1) {
                throw new Error(`配置表【${identity.resourceName}】必须且只能有一个主键`);
            }
            const primaryId = Number(getCellValue(row.getCell(primary_index[0])));
            validatePrimaryId(identity, rowNumber, primaryId);
            data[primary[0]] = primaryId;
            if (primaryIds.has(primaryId)) {
                throw new Error(`配置表【${identity.resourceName}】第【${rowNumber}】行主键【${primaryId}】重复`);
            }
            primaryIds.add(primaryId);
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
            await (0, JsonToTs_1.createTsClient)(name, identity.resourceName, identity.tableId, types_client, r, primary);
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
async function run() {
    const inputExcelPath = path_1.default.join(__dirname, main_1.config.PathExcel.replace("project://", "../../../") + "/");
    const outJsonPathClient = path_1.default.join(__dirname, main_1.config.PathJsonClient.replace("project://", "../../../") + "/");
    let outJsonPathServer = null;
    if (main_1.config.PathJsonServer != null &&
        main_1.config.PathJsonServer.length > 0) {
        outJsonPathServer = path_1.default.join(__dirname, main_1.config.PathJsonServer.replace("project://", "../../../") + "/");
    }
    const files = fs.readdirSync(inputExcelPath);
    const tableIds = new Map();
    const classNames = new Set();
    for (const f of files) {
        const ext = f.toString().substring(f.lastIndexOf(".") + 1);
        if (ext !== "xlsx") {
            continue;
        }
        const identity = parseTableIdentity(f);
        const existingTable = tableIds.get(identity.tableId);
        if (existingTable) {
            throw new Error(`配置表【${identity.resourceName}】与【${existingTable}】使用了重复表ID【${identity.tableId}】`);
        }
        if (classNames.has(identity.className)) {
            throw new Error(`配置表逻辑名称【${identity.className}】重复`);
        }
        tableIds.set(identity.tableId, identity.resourceName);
        classNames.add(identity.className);
        const src = path_1.default.join(inputExcelPath, f);
        if (outJsonPathServer) {
            await convert(src, path_1.default.join(outJsonPathServer, identity.resourceName + ".json"), identity, false);
        }
        await convert(src, path_1.default.join(outJsonPathClient, identity.resourceName + ".json"), identity, true);
    }
}
exports.run = run;

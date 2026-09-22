import path from "path";
import { Workbook, Worksheet } from "exceljs";
import { createTsClient, createTsServer } from "./JsonToTs";
import { config } from "./main";

const fs = require("fs");

const LOCAL_ID_BASE = 10000;
const enumSuffix = "_ENUM";

interface FieldEnum {
    name: string;
    column: number;
    members: Map<string, number>;
}

function getFieldKey(value: string) {
    const key = value.trim();
    return key.endsWith(enumSuffix) ? key.slice(0, -enumSuffix.length) : key;
}

/** 从主表字段后缀读取枚举声明，JSON 和配置类使用去掉后缀的字段名。 */
function getFieldEnums(worksheet: Worksheet, name: string) {
    const fields: FieldEnum[] = [];
    const keys = new Set<string>();
    const enumNames = new Set<string>();

    worksheet.getRow(2).eachCell((cell, column) => {
        const header = cell.text.trim();
        const key = getFieldKey(header);
        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) {
            throw new Error(`配置表【${name}】字段名不合法：【${header}】`);
        }
        if (keys.has(key)) {
            throw new Error(`配置表【${name}】去掉_ENUM后字段名重复：【${key}】`);
        }
        keys.add(key);

        if (!header.endsWith(enumSuffix)) {
            return;
        }
        if (worksheet.getRow(3).getCell(column).text.trim().toLowerCase() !== "string") {
            throw new Error(`配置表【${name}】枚举字段【${header}】必须使用string类型`);
        }

        const enumName = `${name}${key.charAt(0).toUpperCase()}${key.slice(1)}Enum`;
        if (enumNames.has(enumName)) {
            throw new Error(`配置表【${name}】枚举名称重复：【${enumName}】`);
        }
        enumNames.add(enumName);
        fields.push({ name: enumName, column, members: new Map<string, number>() });
    });

    return fields;
}

/** 将字段中的英文成员名映射到同一行的配置主键。 */
function collectFieldEnums(fields: FieldEnum[], worksheet: Worksheet, rowNumber: number, id: number) {
    for (const field of fields) {
        const memberName = worksheet.getRow(rowNumber).getCell(field.column).text.trim();
        if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(memberName)) {
            throw new Error(`枚举【${field.name}】第【${rowNumber}】行成员名为空或不合法：【${memberName}】`);
        }
        if (field.members.has(memberName)) {
            throw new Error(`枚举【${field.name}】第【${rowNumber}】行成员名重复：【${memberName}】`);
        }
        field.members.set(memberName, id);
    }
}

function writeFieldEnums(fields: FieldEnum[]) {
    const outputPath = path.join(__dirname, config.PathTsClient.replace("project://", "../../../"));
    for (const field of fields) {
        const members = Array.from(field.members, ([memberName, id]) => {
            return `    ${memberName} = ${id},`;
        }).join("\n");
        const script = `/**\n * 自动生成文件，请勿手动修改\n */\nexport enum ${field.name} {\n${members}\n}\n`;
        fs.writeFileSync(path.join(outputPath, `${field.name}.ts`), script);
        console.log(`枚举【${field.name}】生成成功`);
    }
}

interface TableIdentity {
    tableId: number;
    resourceName: string;
    className: string;
}

function parseTableIdentity(fileName: string): TableIdentity {
    const resourceName = path.basename(fileName, path.extname(fileName));
    const match = /^(\d+)_([A-Za-z][A-Za-z0-9]*)$/.exec(resourceName);

    if (!match) {
        throw new Error(
            `配置表文件名【${fileName}】不合法，必须使用“表ID_表名.xlsx”，例如“1_Role.xlsx”`
        );
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

function validatePrimaryId(
    identity: TableIdentity,
    rowNumber: number,
    id: number
) {
    const localId = id % LOCAL_ID_BASE;
    const ownerTableId = Math.floor(id / LOCAL_ID_BASE);

    if (!Number.isInteger(id)) {
        throw new Error(
            `配置表【${identity.resourceName}】第【${rowNumber}】行主键必须是整数，当前值：【${id}】`
        );
    }

    if (ownerTableId !== identity.tableId) {
        throw new Error(
            `配置表【${identity.resourceName}】第【${rowNumber}】行主键【${id}】不属于表ID【${identity.tableId}】`
        );
    }

    if (localId <= 0 || localId >= LOCAL_ID_BASE) {
        throw new Error(
            `配置表【${identity.resourceName}】第【${rowNumber}】行主键【${id}】后四位必须在0001到9999之间`
        );
    }
}

/**
 * 兼容尚未迁移的配置表：读取 Excel 第二个 Sheet 生成 Enum。
 * 主表包含 _ENUM 字段时不会使用此规则。
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
async function createLegacyEnumTs(workbook: Workbook, name: string) {
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
            console.warn(
                `文件【${name}】Sheet2 第【${rowNumber}】行枚举值错误：【${idText}】`
            );
            return;
        }

        if (memberName === "") {
            console.warn(
                `文件【${name}】Sheet2 第【${rowNumber}】行枚举名称为空`
            );
            return;
        }

        if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(memberName)) {
            console.warn(
                `文件【${name}】Sheet2 第【${rowNumber}】行枚举名称不合法：【${memberName}】`
            );
            return;
        }

        fields += `    ${memberName} = ${id},\n`;
    });

    if (fields === "") {
        return;
    }

    const script =
        `/**
 * 自动生成文件，请勿手动修改
 */
export enum ${enumName} {
${fields}}
`;

    const p = path.join(
        __dirname,
        config.PathTsClient.replace("project://", "../../../") + "/"
    );

    fs.writeFileSync(
        `${p}${enumName}.ts`,
        script
    );

    console.log(`枚举【${enumName}】生成成功`);
}

/**
 * Excel 转 Json 数据
 * @param src       读取的 Excel 文件目录
 * @param dst       导出的 Json 文件目录
 * @param name      Excel 文件名
 * @param isClient  是否为客户端数据
 */

function getCellValue(cell: any) {
    return cell.formula ? cell.result : cell.text;
}

function parseJsonCellValue(
    src: string,
    key: string,
    type: string,
    value: any,
    cell: any
) {
    const text = String(value).trim();

    if (text === "") {
        return null;
    }

    try {
        return JSON.parse(text);
    }
    catch {
        console.log(
            "Cell " +
            cell.address +
            " has value " +
            cell.text
        );

        console.warn(
            "File [" + src + "] field [" + key + "] type [" + type + "] value [" + value + "] JSON parse error"
        );

        return null;
    }
}

function parseBooleanCellValue(
    src: string,
    key: string,
    value: any
) {
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

    console.warn(
        "File [" + src + "] field [" + key + "] boolean value must be true/false, current value: " + value
    );

    return false;
}

function getJsonTypeValue(
    src: string,
    key: string,
    type: string,
    value: any,
    cell: any
) {
    const parsed = parseJsonCellValue(
        src,
        key,
        type,
        value,
        cell
    );

    if (
        parsed != null &&
        !Array.isArray(parsed) &&
        typeof parsed === "object"
    ) {
        return parsed;
    }

    console.warn(
        "File [" + src + "] field [" + key + "] json type must be a valid JSON object"
    );

    return null;
}

function getArrayTypeValue(
    src: string,
    key: string,
    type: string,
    value: any,
    cell: any
) {
    const parsed = parseJsonCellValue(
        src,
        key,
        type,
        value,
        cell
    );

    if (Array.isArray(parsed)) {
        return parsed;
    }

    console.warn(
        "File [" + src + "] field [" + key + "] array type must be a valid JSON array"
    );

    return [];
}
async function convert(
    src: string,
    dst: string,
    identity: TableIdentity,
    isClient: boolean
) {
    const name = identity.className;
    let r: any = {};
    let names: any[] = [];
    let keys: any[] = [];
    let types: any[] = [];
    let types_client: any = {};
    let servers: any[] = [];
    let clients: any[] = [];
    let primary: string[] = [];
    let primary_index: number[] = [];
    const primaryIds = new Set<number>();

    const workbook = new Workbook();

    await workbook.xlsx.readFile(src);
    console.log("读取Excel文件成功", src);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet || worksheet.name !== identity.resourceName) {
        throw new Error(
            `配置表【${identity.resourceName}】第一个工作表名称必须是【${identity.resourceName}】`
        );
    }

    const fieldEnums = getFieldEnums(worksheet, name);

    worksheet.eachRow((row: any, rowNumber: number) => {
        let data: any = {};

        row.eachCell((cell: any, colNumber: number) => {
            const value = cell.text;

            if (rowNumber === 1) {
                names[colNumber - 1] = value;

                if (value.indexOf("【KEY】") > -1) {
                    primary_index.push(colNumber);
                }
            }
            else if (rowNumber === 2) {
                const key = getFieldKey(value);
                keys[colNumber - 1] = key;

                if (primary_index.indexOf(colNumber) > -1) {
                    primary.push(key);
                }
            }
            else if (rowNumber === 3) {
                types[colNumber - 1] = value;
            }
            else if (isClient === false && rowNumber === 4) {
                servers[colNumber - 1] = value;
            }
            else if (isClient === true && rowNumber === 5) {
                clients[colNumber - 1] = value;
            }
            else if (rowNumber > 5) {
                const index = colNumber - 1;
                const type = String(types[index]).trim().toLowerCase();
                const server = servers[index];
                const client = clients[index];

                const isWrite =
                    (isClient && client === "client") ||
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
                        data[key] = parseBooleanCellValue(
                            src,
                            key,
                            getCellValue(cell)
                        );

                        types_client[key] = {
                            en: "boolean",
                            zh: names[index]
                        };
                        break;

                    case "json":
                        data[key] = getJsonTypeValue(
                            src,
                            key,
                            type,
                            getCellValue(cell),
                            cell
                        );

                        types_client[key] = {
                            en: "Record<string, any>",
                            zh: names[index]
                        };
                        break;

                    case "array":
                        data[key] = getArrayTypeValue(
                            src,
                            key,
                            type,
                            getCellValue(cell),
                            cell
                        );

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
                        catch {
                            console.log(
                                "Cell " +
                                cell.address +
                                " has value " +
                                cell.text
                            );

                            console.warn(
                                "File [" + src + "] field [" + key + "] value [" + value + "] JSON parse error [" + client + "]"
                            );
                        }
                        break;
                }
            }
        });

        if (rowNumber > 5) {
            if (primary.length !== 1) {
                throw new Error(
                    `配置表【${identity.resourceName}】必须且只能有一个主键`
                );
            }

            const primaryId = Number(
                getCellValue(row.getCell(primary_index[0]))
            );
            validatePrimaryId(identity, rowNumber, primaryId);
            data[primary[0]] = primaryId;
            if (primaryIds.has(primaryId)) {
                throw new Error(
                    `配置表【${identity.resourceName}】第【${rowNumber}】行主键【${primaryId}】重复`
                );
            }
            primaryIds.add(primaryId);
            collectFieldEnums(fieldEnums, worksheet, rowNumber, primaryId);

            let temp: any = null;

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
        if (isClient) {
            if (fieldEnums.length > 0) {
                writeFieldEnums(fieldEnums);
            }
            else {
                await createLegacyEnumTs(workbook, name);
            }
        }

        fs.writeFileSync(
            dst,
            JSON.stringify(r)
        );

        if (isClient) {
            await createTsClient(
                name,
                identity.resourceName,
                identity.tableId,
                types_client,
                r,
                primary
            );
        }
        else {
            await createTsServer(
                name,
                types_client,
                r,
                primary
            );
        }

        console.log(
            isClient ? "客户端数据" : "服务器数据",
            "生成成功",
            dst
        );
    }
    else {
        console.log(
            isClient ? "客户端数据" : "服务器数据",
            "无数据",
            dst
        );
    }
}

export async function run() {
    const inputExcelPath = path.join(
        __dirname,
        config.PathExcel.replace("project://", "../../../") + "/"
    );

    const outJsonPathClient = path.join(
        __dirname,
        config.PathJsonClient.replace("project://", "../../../") + "/"
    );

    let outJsonPathServer: string = null!;

    if (
        config.PathJsonServer != null &&
        config.PathJsonServer.length > 0
    ) {
        outJsonPathServer = path.join(
            __dirname,
            config.PathJsonServer.replace("project://", "../../../") + "/"
        );
    }

    const files = fs.readdirSync(inputExcelPath);
    const tableIds = new Map<number, string>();
    const classNames = new Set<string>();

    for (const f of files) {
        const ext = f.toString().substring(
            f.lastIndexOf(".") + 1
        );

        if (ext !== "xlsx") {
            continue;
        }

        const identity = parseTableIdentity(f);
        const existingTable = tableIds.get(identity.tableId);
        if (existingTable) {
            throw new Error(
                `配置表【${identity.resourceName}】与【${existingTable}】使用了重复表ID【${identity.tableId}】`
            );
        }
        if (classNames.has(identity.className)) {
            throw new Error(`配置表逻辑名称【${identity.className}】重复`);
        }
        tableIds.set(identity.tableId, identity.resourceName);
        classNames.add(identity.className);

        const src = path.join(inputExcelPath, f);

        if (outJsonPathServer) {
            await convert(
                src,
                path.join(outJsonPathServer, identity.resourceName + ".json"),
                identity,
                false
            );
        }

        await convert(
            src,
            path.join(outJsonPathClient, identity.resourceName + ".json"),
            identity,
            true
        );
    }
}

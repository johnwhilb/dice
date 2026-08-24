import path from "path";
import { createTsClient, createTsServer } from "./JsonToTs";
import { config } from "./main";

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
async function createEnumTs(workbook: any, name: string) {
    if (workbook.worksheets.length < 2) {
        return;
    }

    const worksheet = workbook.worksheets[1];
    const enumName = `Enum${name}`;
    let fields = "";

    worksheet.eachRow((row: any, rowNumber: number) => {
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
async function convert(
    src: string,
    dst: string,
    name: string,
    isClient: boolean
) {
    let r: any = {};
    let names: any[] = [];
    let keys: any[] = [];
    let types: any[] = [];
    let types_client: any = {};
    let servers: any[] = [];
    let clients: any[] = [];
    let primary: string[] = [];
    let primary_index: number[] = [];

    const workbook = new excel.Workbook();

    await workbook.xlsx.readFile(src);
    console.log("读取Excel文件成功", src);

    if (isClient) {
        await createEnumTs(workbook, name);
    }

    const worksheet = workbook.getWorksheet(1);

    worksheet.eachRow((row: any, rowNumber: number) => {
        let data: any = {};

        row.eachCell((cell: any, colNumber: number) => {
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
                const type = types[index];
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
                        data[key] = cell.formula
                            ? parseInt(cell.result)
                            : parseInt(value);

                        types_client[key] = {
                            en: "number",
                            zh: names[index]
                        };
                        break;

                    case "float":
                        data[key] = cell.formula
                            ? parseFloat(cell.result)
                            : parseFloat(value);

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

                    case "any":
                        try {
                            data[key] = JSON.parse(value);

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
                                `文件【${src}】的【${key}】字段【${data[key]}】类型数据【${value}】JSON转字段串错误【${client}】`
                            );
                        }
                        break;
                }
            }
        });

        if (rowNumber > 5) {
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
        fs.writeFileSync(
            dst,
            JSON.stringify(r)
        );

        if (isClient) {
            await createTsClient(
                name,
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

export function run() {
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

    files.forEach((f: string) => {
        const name = f.substring(
            0,
            f.indexOf(".")
        );

        const ext = f.toString().substring(
            f.lastIndexOf(".") + 1
        );

        if (ext !== "xlsx") {
            return;
        }

        if (outJsonPathServer) {
            convert(
                inputExcelPath + f,
                outJsonPathServer + name + ".json",
                name,
                false
            );
        }

        convert(
            inputExcelPath + f,
            outJsonPathClient + name + ".json",
            name,
            true
        );
    });
}
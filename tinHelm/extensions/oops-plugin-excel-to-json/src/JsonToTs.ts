/*
 * @Author: dgflash
 * @Date: 2022-07-26 18:21:52
 *
 * Client 生成规则：
 *
 * BaseXXX.ts
 * - 自动生成
 * - 每次读表都会覆盖
 * - 负责配置字段与查询
 *
 * TableXXX.ts
 * - 只在文件不存在时创建
 * - 后续绝不覆盖
 * - 用于编写项目自己的扩展方法
 */

import path from "path";
import { config } from "./main";

const fs = require("fs");

interface FieldTypeInfo {
    en: string;
    zh: string;
}

interface FieldTypeMap {
    [key: string]: FieldTypeInfo;
}

export async function createTsClient(
    name: string,
    fieldType: FieldTypeMap,
    _data: unknown,
    primary: string[]
) {
    if (primary.length !== 1) {
        console.warn(
            `配置表【${name}】主键数量为【${primary.length}】，Base${name} 暂只支持单主键配置表`
        );
        return;
    }

    const primaryKey = primary[0];

    if (fieldType[primaryKey] == null) {
        console.warn(
            `配置表【${name}】主键字段【${primaryKey}】没有客户端类型信息`
        );
        return;
    }

    let interfaceFields = "";

    for (const key in fieldType) {
        if (key === primaryKey) {
            continue;
        }

        interfaceFields +=
            `    ${key}: ${fieldType[key].en};\n`;
    }

    let getters = "";

    for (const key in fieldType) {
        if (key === primaryKey) {
            continue;
        }

        getters += `
    /** ${fieldType[key].zh} */
    get ${key}(): ${fieldType[key].en} {
        return this.data.${key};
    }
`;
    }

    const baseScript =
        `import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * ${name} 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface ${name}ConfigData {
${interfaceFields}}

/**
 * Base${name} 派生类构造类型。
 */
interface Base${name}Constructor<T extends Base${name}> {
    new (): T;
    TableName: string;
}

/**
 * ${name} 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class Base${name} {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "${name}";

    /** 配置主键 */
    ${primaryKey}: number = 0;

    /** 当前配置原始数据 */
    private data: ${name}ConfigData = null!;

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends Base${name}>(
        this: Base${name}Constructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, ${name}ConfigData> | null;

        if (table == null) {
            return [];
        }

        const result: T[] = [];

        for (const key of Object.keys(table)) {
            const id = Number(key);

            if (Number.isNaN(id)) {
                continue;
            }

            const configData = table[key];

            if (configData == null) {
                continue;
            }

            const item = new this();

            item.setConfig(
                id,
                configData
            );

            result.push(item);
        }

        return result;
    }

    /**
     * 根据 ID 获取配置。
     *
     * 不存在时返回 null。
     */
    static getConfigById<T extends Base${name}>(
        this: Base${name}Constructor<T>,
        id: number
    ): T | null {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, ${name}ConfigData> | null;

        if (table == null) {
            return null;
        }

        const configData = table[String(id)];

        if (configData == null) {
            return null;
        }

        const item = new this();

        item.setConfig(
            id,
            configData
        );

        return item;
    }

    /**
     * Base 内部初始化配置对象。
     */
    protected setConfig(
        id: number,
        data: ${name}ConfigData
    ) {
        this.${primaryKey} = id;
        this.data = data;
    }
${getters}}
`;

    const tableScript =
        `import { Base${name} } from "./Base${name}";

/**
 * ${name} 配置扩展类。
 *
 * 此文件只会自动创建一次。
 * 可以在这里安全编写项目自己的方法。
 */
export class Table${name} extends Base${name} {

}
`;

    const p = path.join(
        __dirname,
        config.PathTsClient.replace("project://", "../../../") + "/"
    );

    const basePath = `${p}Base${name}.ts`;
    const tablePath = `${p}Table${name}.ts`;

    fs.writeFileSync(
        basePath,
        baseScript
    );

    console.log(
        `配置基类【Base${name}】生成成功`
    );

    if (!fs.existsSync(tablePath)) {
        fs.writeFileSync(
            tablePath,
            tableScript
        );

        console.log(
            `配置扩展【Table${name}】生成成功`
        );
    }
    else {
        console.log(
            `配置扩展【Table${name}】已存在，跳过生成`
        );
    }
}

/**
 * 生成服务器配置脚本。
 *
 * Server 暂时保持 OOPS 原插件的 TableXXX 结构，
 * 不参与客户端 BaseXXX / TableXXX 分层。
 */
export async function createTsServer(
    name: string,
    fieldType: FieldTypeMap,
    _data: unknown,
    primary: string[]
) {
    let scriptInitParams = "";
    let scriptInitData = "";
    let scriptInitVar = "";
    let scriptInitValue = "";

    primary.forEach(key => {
        scriptInitParams += `${key}: number, `;
        scriptInitData += `[${key}]`;

        scriptInitVar +=
            `/** ${fieldType[key].zh} */
    ${key}: number = 0;\r    `;

        scriptInitValue +=
            `this.${key} = ${key};\r        `;
    });

    scriptInitParams = scriptInitParams.substring(
        0,
        scriptInitParams.length - 2
    );

    scriptInitVar = scriptInitVar.substring(
        0,
        scriptInitVar.length - 5
    );

    scriptInitValue = scriptInitValue.substring(
        0,
        scriptInitValue.length - 9
    );

    let field = "";

    for (const id in fieldType) {
        if (primary.indexOf(id) === -1) {
            field += `
    /** ${fieldType[id].zh} */
    get ${id}(): ${fieldType[id].en} {
        return this.data.${id};
    }`;
        }
    }

    const script =
        `
export class Table${name} {

    static TableName: string = "/game/${name}.json";

    static Table: any = null!;

    static load() {
        const fs = require("fs");

        const data = fs.readFileSync(
            __dirname + this.TableName,
            "utf8"
        );

        this.Table = JSON.parse(data);
    }

    private data: any;

    init(${scriptInitParams}) {
        this.data = Table${name}.Table${scriptInitData};

        ${scriptInitValue}
    }

    ${scriptInitVar}
${field}
}
`;

    const p = path.join(
        __dirname,
        config.PathTsServer.replace("project://", "../../../") + "/"
    );

    fs.writeFileSync(
        `${p}Table${name}.ts`,
        script
    );
}
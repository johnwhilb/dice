const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { Workbook } = require('exceljs');

const identity = { tableId: 99, resourceName: '99_Example', className: 'Example' };

function createWorkbook() {
    const workbook = new Workbook();
    workbook.addWorksheet(identity.resourceName).addRows([
        ['编号【KEY】', '规则', '说明', '事件类型'],
        ['id', 'numNeed_ENUM', 'des', 'type_ENUM'],
        ['int', 'string', 'string', 'string'],
        ['server', 'server', 'server_no', 'server'],
        ['client', 'client', 'client', 'client_no'],
        [990001, 'DOUBLE', '双骰', 'SHOP'],
        [990002, 'TRIPLE', '三骰', 'ENEMY']
    ]);
    return workbook;
}

// 执行真实转换逻辑，仅将文件读写和下游代码生成替换为内存输出。
function createConverter(workbook) {
    const writes = new Map();
    const generatedTypes = [];
    workbook.xlsx.readFile = async () => {
        return workbook;
    };
    const exports = {};
    const context = {
        exports,
        __dirname: path.join(__dirname, 'dist'),
        console: {
            log() {
            },
            warn() {
            }
        },
        require(name) {
            switch (name) {
                case 'exceljs':
                    return {
                        Workbook: class {
                            constructor() {
                                return workbook;
                            }
                        }
                    };
                case 'fs':
                    return {
                        writeFileSync(filePath, value) {
                            writes.set(path.basename(filePath), value);
                        }
                    };
                case './main':
                    return { config: { PathTsClient: 'project://temp' } };
                case './JsonToTs':
                    return {
                        async createTsClient(name, resource, id, types) {
                            generatedTypes.push(types);
                        },
                        async createTsServer(name, types) {
                            generatedTypes.push(types);
                        }
                    };
                default:
                    return require(name);
            }
        }
    };
    const code = fs.readFileSync(path.join(__dirname, 'dist/ExcelToJson.js'), 'utf8');
    vm.runInNewContext(`${code}\nexports.convert = convert;`, context);
    return {
        writes,
        generatedTypes,
        async run(isClient = true) {
            await exports.convert('99_Example.xlsx', '99_Example.json', identity, isClient);
            return JSON.parse(writes.get('99_Example.json'));
        }
    };
}

test('单主表多枚举字段：成员映射主键，JSON和配置类去掉后缀，支持仅生成枚举', async () => {
    const converter = createConverter(createWorkbook());
    const json = await converter.run();
    assert.deepEqual(json, {
        990001: { numNeed: 'DOUBLE', des: '双骰' },
        990002: { numNeed: 'TRIPLE', des: '三骰' }
    });
    assert.match(converter.writes.get('ExampleNumNeedEnum.ts'), /DOUBLE = 990001,/);
    assert.match(converter.writes.get('ExampleTypeEnum.ts'), /ENEMY = 990002,/);
    assert.equal(converter.generatedTypes[0].numNeed.en, 'string');
    assert.equal(converter.generatedTypes[0].numNeed_ENUM, undefined);
    assert.equal(converter.generatedTypes[0].type, undefined);
    assert.equal(converter.writes.has('EnumExample.ts'), false);
});

test('服务端同样去掉后缀，并遵循server导出标记', async () => {
    const converter = createConverter(createWorkbook());
    const json = await converter.run(false);
    assert.deepEqual(json, {
        990001: { numNeed: 'DOUBLE', type: 'SHOP' },
        990002: { numNeed: 'TRIPLE', type: 'ENEMY' }
    });
    assert.equal(converter.generatedTypes[0].numNeed.en, 'string');
    assert.equal(converter.writes.has('ExampleNumNeedEnum.ts'), false);
});

test('主表枚举优先，忽略尚未删除的Sheet2', async () => {
    const workbook = createWorkbook();
    workbook.addWorksheet('Sheet2').addRow([123, 'OUTDATED']);
    const converter = createConverter(workbook);
    await converter.run();
    assert.equal(converter.writes.has('EnumExample.ts'), false);
    assert.match(converter.writes.get('ExampleNumNeedEnum.ts'), /TRIPLE = 990002,/);
});

test('没有标记的表不生成字段枚举，旧Sheet2暂时兼容', async () => {
    const workbook = createWorkbook();
    workbook.worksheets[0].getCell('B2').value = 'numNeed';
    workbook.worksheets[0].getCell('D2').value = 'type';
    workbook.addWorksheet('Sheet2').addRow([1, 'DIALOG']);
    const converter = createConverter(workbook);
    await converter.run();
    assert.equal(converter.writes.has('ExampleNumNeedEnum.ts'), false);
    assert.match(converter.writes.get('EnumExample.ts'), /DIALOG = 1,/);
});

const invalidCases = [
    ['B7', 'DOUBLE', /成员名重复/],
    ['B6', null, /成员名为空或不合法/],
    ['B6', '1INVALID', /成员名为空或不合法/],
    ['B3', 'int', /必须使用string类型/],
    ['C2', 'numNeed', /字段名重复/],
    ['D2', 'NumNeed_ENUM', /枚举名称重复/],
    ['A7', 990001, /主键.*重复/],
    ['A7', 980001, /不属于表ID/]
];

for (const [address, value, error] of invalidCases) {
    test(`错误配置在写出前失败：${address} = ${value}`, async () => {
        const workbook = createWorkbook();
        workbook.worksheets[0].getCell(address).value = value;
        const converter = createConverter(workbook);
        await assert.rejects(converter.run(), error);
        assert.equal(converter.writes.size, 0);
    });
}

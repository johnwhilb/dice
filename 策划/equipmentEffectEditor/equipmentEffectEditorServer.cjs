'use strict';
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Excel = require('../../tinHelm/extensions/oops-plugin-excel-to-json/node_modules/exceljs');
const catalog = require('./effectCatalog.js');
const equipmentTypes = ['Component', 'Weapon', 'Armor'];

function validateEffects(nodes, depth = 0, count = { value: 0 }) {
    if (!Array.isArray(nodes) || depth > 20) {
        throw new Error('效果必须是数组，最多嵌套20层');
    }
    for (const node of nodes) {
        count.value += 1;
        if (count.value > 500 || !node || !catalog[node.type]) {
            throw new Error('效果类型无效，或单件装备超过500个效果节点');
        }
        if (!['SELF', 'ENEMY'].includes(node.target) || !node.params
            || typeof node.params !== 'object' || Array.isArray(node.params)) {
            throw new Error('效果目标仅支持 SELF/ENEMY，params 必须是对象');
        }
        if (node.condition) {
            validateCondition(node.condition);
        }
        for (const branch of ['children', 'elseEffects']) {
            if (Object.prototype.hasOwnProperty.call(node, branch)) {
                validateEffects(node[branch], depth + 1, count);
            }
        }
    }
}

function validateCondition(condition, depth = 0) {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition) || depth > 20) {
        throw new Error('条件必须是对象，最多嵌套20层');
    }
    if (condition.rules) {
        if (!['AND', 'OR'].includes(condition.op) || !Array.isArray(condition.rules)) {
            throw new Error('组合条件需要 AND/OR 和 rules 数组');
        }
        condition.rules.forEach(rule => {
            validateCondition(rule, depth + 1);
        });
    }
    else if (!['==', '!=', '>', '>=', '<', '<='].includes(condition.cmp)
        || !['number', 'string'].includes(typeof condition.lhs)
        || !['number', 'string'].includes(typeof condition.rhs)) {
        throw new Error('条件需要 lhs、cmp、rhs，比较值为数值或表达式');
    }
}

function validateEquipment(records) {
    if (!Array.isArray(records) || records.length > 9999) {
        throw new Error('equipments 必须是数组，最多9999件装备');
    }
    const ids = new Set();
    for (const record of records) {
        if (!record || !Number.isSafeInteger(record.id) || record.id < 190001
            || record.id > 199999 || ids.has(record.id)) {
            throw new Error('装备编号必须是唯一的190001～199999');
        }
        ids.add(record.id);
        if (typeof record.name !== 'string' || !record.name.trim()
            || typeof record.des !== 'string' || typeof record.effectDes !== 'string') {
            throw new Error(record.id + '：名称不能为空，描述必须是文本');
        }
        if (!equipmentTypes.includes(record.type) || !Number.isSafeInteger(record.price) || record.price < 0) {
            throw new Error(record.id + '：类型无效或价格不是非负整数');
        }
        if (!Array.isArray(record.combine) || ![0, 2].includes(record.combine.length)) {
            throw new Error(record.id + '：combine 必须是空数组或两个材料编号');
        }
        validateEffects(record.effect);
    }
    const byId = new Map(records.map(record => {
        return [record.id, record];
    }));
    const complete = new Set();
    const visiting = new Set();
    function visit(id) {
        if (visiting.has(id)) {
            throw new Error(id + '：合成配方存在循环引用');
        }
        if (complete.has(id)) {
            return;
        }
        visiting.add(id);
        for (const materialId of byId.get(id).combine) {
            if (!Number.isSafeInteger(materialId) || !ids.has(materialId)) {
                throw new Error(id + '：材料 ' + materialId + ' 不存在，请先修改引用再删除');
            }
            visit(materialId);
        }
        visiting.delete(id);
        complete.add(id);
    }
    records.forEach(record => {
        visit(record.id);
    });
}

function generateConfig() {
    const pluginPath = path.resolve(__dirname, '../../tinHelm/extensions/oops-plugin-excel-to-json/dist');
    const main = require(path.join(pluginPath, 'main.js'));
    main.config = require('../../tinHelm/settings/v2/packages/oops-plugin-excel-to-json.json');
    return require(path.join(pluginPath, 'ExcelToJson.js')).run();
}

function createEditor(root = path.resolve(__dirname, '..'), options = {}) {
    const file = path.join(root, 'excel', '19_Equipment.xlsx');
    let writing = false;
    // 等待文件读取和 Excel 解析完成，确保每次读取的是磁盘上的最新表格。
    async function readTable() {
        const buffer = await fs.readFile(file);
        const workbook = new Excel.Workbook();
        await workbook.xlsx.load(buffer);
        const sheet = workbook.worksheets[0];
        const fields = [];
        sheet.getRow(2).eachCell((cell, column) => {
            fields.push({ key: cell.text, label: sheet.getCell(1, column).text,
                type: sheet.getCell(3, column).text, column });
        });
        for (const required of ['id', 'name', 'effectDes', 'des', 'effect', 'type', 'price', 'combine']) {
            if (!fields.some(field => field.key === required)) {
                throw new Error('装备表缺少字段：' + required);
            }
        }
        const equipments = [];
        sheet.eachRow((row, index) => {
            if (index < 6 || !row.getCell(1).value) {
                return;
            }
            const record = {};
            for (const field of fields) {
                let value = row.getCell(field.column).value;
                if (['array', 'json', 'any'].includes(field.type)) {
                    try {
                        value = typeof value === 'string' && value.trim() ? JSON.parse(value) : [];
                    }
                    catch (error) {
                        throw new Error('第' + index + '行 ' + field.key + ' JSON 无效：' + error.message);
                    }
                }
                if (field.type === 'string') {
                    value = row.getCell(field.column).text || '';
                }
                record[field.key] = value;
            }
            equipments.push(record);
        });
        return { revision: crypto.createHash('sha256').update(buffer).digest('hex'),
            equipments, fields, workbook, buffer };
    }

    // 等待版本检查、工作簿序列化、原子替换和可选配置生成，避免同时写入。
    async function saveEquipment(payload) {
        if (writing) {
            throw new Error('正在保存，请稍后重试');
        }
        writing = true;
        const temporary = file + '.editor-tmp';
        try {
            const data = await readTable();
            if (!payload || payload.revision !== data.revision) {
                throw new Error('Excel 已被外部修改，请导出当前修改备份，再重新读取');
            }
            validateEquipment(payload.equipments);
            const sheet = data.workbook.worksheets[0];
            const originals = new Map(data.equipments.map(record => {
                return [record.id, record];
            }));
            const template = data.fields.map(field => {
                return { column: field.column, style: JSON.parse(JSON.stringify(sheet.getCell(6, field.column).style)),
                    width: sheet.getColumn(field.column).width };
            });
            const rowCount = Math.max(sheet.rowCount, payload.equipments.length + 5);
            for (let row = 6; row <= rowCount; row++) {
                const record = payload.equipments[row - 6];
                const original = record ? originals.get(record.id) || {} : {};
                for (const field of data.fields) {
                    const cell = sheet.getCell(row, field.column);
                    if (row > data.equipments.length + 5 && record) {
                        cell.style = template.find(entry => entry.column === field.column).style;
                    }
                    const value = record ? (Object.prototype.hasOwnProperty.call(record, field.key)
                        ? record[field.key] : original[field.key]) : null;
                    // 未修改的文本保留原单元格富文本，避免保存效果时覆盖字体格式。
                    if (field.type === 'string' && cell.text === value) {
                        continue;
                    }
                    cell.value = value && typeof value === 'object' ? JSON.stringify(value) : value;
                }
            }
            const output = await data.workbook.xlsx.writeBuffer();
            if ((await readTable()).revision !== data.revision) {
                throw new Error('保存期间 Excel 发生变化，请重新读取');
            }
            await fs.writeFile(file + '.editor-backup', data.buffer);
            await fs.writeFile(temporary, output);
            await fs.rename(temporary, file);
            let warning = '';
            let generated = false;
            if (options.generate !== false) {
                try {
                    await generateConfig();
                    generated = true;
                }
                catch (error) {
                    warning = '表格已保存，但客户端配置生成失败：' + error.message;
                }
            }
            return { revision: (await readTable()).revision, generated, warning };
        }
        catch (error) {
            if (['EPERM', 'EACCES', 'EBUSY'].includes(error.code)) {
                throw new Error('装备表被占用，请保存并关闭 Excel 后重试');
            }
            throw error;
        }
        finally {
            writing = false;
            await fs.unlink(temporary).catch(() => {
                // 保存失败或不存在临时文件时无需重复报错。
            });
        }
    }

    // 等待请求体和文件操作完成后再返回，保存错误以 JSON 显示给网页。
    const server = http.createServer(async (request, response) => {
        response.setHeader('Cache-Control', 'no-store');
        const send = (status, value) => {
            response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
            response.end(JSON.stringify(value));
        };
        try {
            const url = new URL(request.url, 'http://localhost');
            if (request.method === 'GET' && url.pathname === '/api/equipments') {
                const data = await readTable();
                send(200, { revision: data.revision, equipments: data.equipments, fields: data.fields,
                    types: equipmentTypes, catalog });
            }
            else if (request.method === 'POST' && url.pathname === '/api/equipments') {
                if (request.headers.origin !== 'http://' + request.headers.host
                    || request.headers['content-type'] !== 'application/json') {
                    throw new Error('请求来源或格式无效');
                }
                let body = '';
                for await (const chunk of request) {
                    body += chunk;
                    if (Buffer.byteLength(body) > 5 * 1024 * 1024) {
                        throw new Error('请求超过5 MB');
                    }
                }
                send(200, await saveEquipment(JSON.parse(body)));
            }
            else if (request.method === 'GET' && ['/','/equipmentEffectEditor.html',
                '/equipmentEffectEditor.js'].includes(url.pathname)) {
                const filename = url.pathname.endsWith('.js') ? 'equipmentEffectEditor.js' : 'equipmentEffectEditor.html';
                response.writeHead(200, { 'Content-Type': filename.endsWith('.js')
                    ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8' });
                response.end(await fs.readFile(path.join(__dirname, filename)));
            }
            else {
                send(404, { error: '不存在的地址' });
            }
        }
        catch (error) {
            send(400, { error: error.message });
        }
    });
    return { server, readTable, saveEquipment };
}

if (require.main === module) {
    const port = Number(process.env.PORT) || 3213;
    const editor = createEditor();
    editor.server.on('error', error => {
        if (error.code === 'EADDRINUSE') {
            console.error('端口 ' + port + ' 已被占用，编辑器可能已启动：http://127.0.0.1:' + port);
        }
        else {
            console.error('装备编辑器启动失败：' + error.message);
        }
        process.exitCode = 1;
    });
    editor.server.listen(port, '127.0.0.1', () => {
        console.log('装备编辑器：http://127.0.0.1:' + port);
    });
}
module.exports = { createEditor, validateEquipment, validateEffects, generateConfig };

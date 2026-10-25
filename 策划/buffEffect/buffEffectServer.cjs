const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const { readTables, validateCards, validateBuffRows, validateBuffEffects, buffDurations, buffRuleNames, root, Excel, loadWorkbook } = require('../effectEditorTables.cjs');
let writing = false;
// 等待源表与运行时代码引用检查，阻止删除仍被使用的Buff。
async function validateBuffReferences(data, buffs) {
    const original = new Map(data.buffs.map(buff => [buff.id, buff]));
    for (const buff of buffs) {
        if (original.has(buff.id) && original.get(buff.id).type !== buff.type
            || data.buffs.some(previous => previous.type === buff.type && previous.id !== buff.id)) {
            throw new Error('已有Buff的编号和枚举不可更改，请新增Buff后迁移引用');
        }
    }
    const removed = data.buffs.filter(buff => !buffs.some(item => item.id === buff.id));
    const contains = (value, id) => {
        return value === id || Array.isArray(value) && value.some(item => contains(item, id))
            || value && typeof value === 'object' && Object.values(value).some(item => contains(item, id));
    };
    const checkCode = async directory => {
        for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
            const filename = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                await checkCode(filename);
            }
            else if (entry.name.endsWith('.ts') && entry.name !== 'BattleBuffTypeEnum.ts') {
                const source = await fs.readFile(filename, 'utf8');
                for (const buff of removed) {
                    if (new RegExp('BattleBuffTypeEnum\\.' + buff.type + '\\b').test(source)) {
                        throw new Error(`${buff.name}仍被战斗代码引用，不能删除`);
                    }
                }
            }
        }
    };
    if (!removed.length) {
        return;
    }
    for (const buff of removed) {
        if (buffs.some(item => contains(item.effects, buff.id))) {
            throw new Error(`${buff.name}仍被其他Buff引用，不能删除`);
        }
    }
    for (const name of await fs.readdir(path.join(root, 'excel'))) {
        if (!name.endsWith('.xlsx') || name.startsWith('~$') || name === '20_BattleBuff.xlsx') {
            continue;
        }
        const workbook = new Excel.Workbook();
        await loadWorkbook(workbook, await fs.readFile(path.join(root, 'excel', name)));
        workbook.worksheets[0].eachRow((row, index) => {
            if (index < 6) {
                return;
            }
            row.eachCell(cell => {
                let value = cell.value;
                if (typeof value === 'string' && /^[\[{]/.test(value.trim())) {
                    value = JSON.parse(value);
                }
                for (const buff of removed) {
                    if (contains(value, buff.id)) {
                        throw new Error(`${buff.name}仍被${name}第${index}行引用，不能删除`);
                    }
                }
            });
        });
    }
    await checkCode(path.resolve(root, '../tinHelm/assets/script/game'));
}
// 定点写入Buff字段，保留工作表结构、样式及其他扩展列。
function updateBuffWorkbook(data, buffs) {
    const sheet = data.workbooks[3].worksheets[0];
    for (const [field, label, type] of [['defaultDuration', '默认持续时间', 'string'], ['dispellable', '可被驱散', 'boolean']]) {
        if (!sheet.getRow(2).values.includes(field)) {
            const column = sheet.columnCount + 1;
            [label, field, type, 'server', 'client'].forEach((value, index) => {
                sheet.getCell(index + 1, column).value = value;
            });
        }
    }
    const original = new Map(data.buffs.map(buff => [buff.id, buff]));
    const fields = sheet.getRow(2).values;
    const end = Math.max(sheet.rowCount, buffs.length + 5);
    for (let row = 6; row <= end; row++) {
        const buff = buffs[row - 6];
        fields.forEach((field, column) => {
            const key = field.replace(/_ENUM$/, '');
            const previous = buff ? original.get(buff.id) || {} : {};
            let value = buff ? (Object.prototype.hasOwnProperty.call(buff, key) ? buff[key] : previous[key]) : null;
            if (value && typeof value === 'object') {
                value = JSON.stringify(value);
            }
            sheet.getCell(row, column).value = value === undefined ? null : value;
        });
    }
    return data.workbooks[3];
}
// 等待版本、引用及效果校验通过，再原子替换Excel并保留备份。
async function saveBuffs(payload) {
    const data = await readTables();
    if (payload.revision !== data.revision) {
        throw new Error('Excel已被外部修改，请导出JSON备份后重新读取');
    }
    validateBuffRows(payload.buffs);
    const proposed = { ...data, buffs: payload.buffs };
    validateBuffEffects(proposed);
    validateCards(data.cards, proposed);
    await validateBuffReferences(data, payload.buffs);
    const buffer = await updateBuffWorkbook(data, payload.buffs).xlsx.writeBuffer();
    if ((await readTables()).revision !== payload.revision) {
        throw new Error('保存期间表格发生变化，请重新读取');
    }
    const filename = path.join(root, 'excel', '20_BattleBuff.xlsx');
    await fs.copyFile(filename, filename + '.editor-backup');
    await fs.writeFile(filename + '.editor-tmp', buffer);
    await fs.rename(filename + '.editor-tmp', filename);
    return { revision: (await readTables()).revision };
}
const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    /**
 * @returns {void}
 */
    const send = (status, value) => {
        response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify(value));
    };
    return (async () => {
        const url = new URL(request.url, 'http://localhost');
        if (request.method === 'GET' && url.pathname === '/api/tables') {
            const { revision, roles, cards, dice, buffs, effects } = await readTables();
            send(200, { revision, roles, cards, dice, buffs, effects, buffDurations, buffRuleNames });
        }
        else if (request.method === 'GET' && url.pathname === '/buffEditor.js') {
            response.writeHead(200, {'Content-Type': 'text/javascript; charset=utf-8'});
            response.end(await fs.readFile(path.join(__dirname, 'buffEditor.js')));
        }
        else if (request.method === 'POST' && url.pathname === '/api/buffs') {
            if (request.headers.origin !== `http://${request.headers.host}` || request.headers['content-type'] !== 'application/json' || writing) {
                send(409, { error: '请求来源无效或正在保存' });
                return;
            }
            writing = true;
            await (async () => {
                let body = '';
                for await (const chunk of request) {
                    body += chunk;
                    if (body.length > 5 * 1024 * 1024) {
                        throw new Error('数据超过 5 MB');
                    }
                }
                send(200, await saveBuffs(JSON.parse(body)));
            })().finally(() => {
                writing = false;
            });
        }

        else if (request.method === 'GET' && ['/effectEditorCore.js', '/effectEditor.css'].includes(url.pathname)) {
            response.writeHead(200, {'Content-Type': url.pathname.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8'});
            response.end(await fs.readFile(path.join(__dirname, '..', url.pathname.slice(1))));
        }
        else if (request.method === 'GET' && ['/', '/buffEffect.html'].includes(url.pathname)) {
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end(await fs.readFile(path.join(__dirname, 'buffEffect.html')));
        }
        else {
            send(404, { error: '不存在的地址' });
        }
    })().catch(error => {
        send(400, { error: error.message });
    });
});
if (require.main === module) {
    const port = Number(process.env.PORT) || 3212;
    server.on('error', error => {
        if (error.code === 'EADDRINUSE') {
            console.error(`端口 ${port} 已被占用。编辑器可能已经启动，可直接打开 http://127.0.0.1:${port}。`);
        }
        else {
            console.error('编辑器启动失败：' + error.message);
        }
        process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
        console.log(`Buff编辑器：http://127.0.0.1:${port}`);
    });
}
module.exports = { readTables, validateBuffReferences, updateBuffWorkbook, saveBuffs, server };

const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Excel = require('../../tinHelm/extensions/oops-plugin-excel-to-json/node_modules/exceljs');
const effectTypes = new Set(['DAMAGE', 'BLOCK', 'HEAL', 'LOSE_HP', 'KILL_IF', 'MULTIPLY_BLOCK',
    'REMOVE_BLOCK', 'PIERCE_BLOCK', 'BLOCK_NEXT_TURN', 'APPLY_STATUS', 'REMOVE_STATUS', 'MULTIPLY_STATUS',
    'TRANSFER_STATUS', 'CLEANSE', 'MODIFY_STAT', 'SET_STAT', 'DOUBLE_STAT', 'SET_INTANGIBLE', 'IF', 'SEQUENCE',
    'REPEAT', 'REGISTER_TRIGGER', 'SCHEDULE', 'CHOOSE_ONE', 'RANDOM_CHOICE', 'DISCARD', 'EXHAUST',
    'DISCARD_HAND', 'EXHAUST_HAND', 'GAIN_GOLD', 'LOSE_GOLD', 'SET_VARIABLE', 'MODIFY_VARIABLE']);
function validateEffects(nodes, depth = 0) {
    if (!Array.isArray(nodes) || depth > 20 || nodes.length > 100) {
        throw new Error('效果必须是数组，最多嵌套 20 层');
    }
    for (const node of nodes) {
        if (!node || !effectTypes.has(node.type) || !['SELF', 'ENEMY'].includes(node.target)) {
            throw new Error('效果类型或目标无效');
        }
        if (!node.params || typeof node.params !== 'object' || Array.isArray(node.params)) {
            throw new Error('params 必须是对象');
        }
        for (const branch of ['children', 'elseEffects']) {
            if (node[branch]) {
                validateEffects(node[branch], depth + 1);
            }
        }
    }
}
function createEditor(root = path.resolve(__dirname, '..')) {
    let writing = false;
    const files = ['17_Item', '5_Enemy'].map(name => {
        return path.join(root, 'excel', name + '.xlsx');
    });
    async function readTables() {
        const buffers = await Promise.all(files.map(file => {
            return fs.readFile(file);
        }));
        const workbooks = await Promise.all(buffers.map(async (buffer) => {
            const workbook = new Excel.Workbook();
            await workbook.xlsx.load(buffer);
            return workbook;
        }));
        const rows = workbooks.map(workbook => {
            const sheet = workbook.worksheets[0];
            const fields = sheet.getRow(2).values;
            const records = [];
            sheet.eachRow((row, index) => {
                if (index < 6 || !row.getCell(1).value) {
                    return;
                }
                const record = {};
                fields.forEach((field, col) => {
                    let value = row.getCell(col).value;
                    if (['array', 'json', 'any'].includes(sheet.getCell(3, col).value) && typeof value === 'string' && value.trim()) {
                        value = JSON.parse(value);
                    }
                    record[field] = value;
                });
                records.push(record);
            });
            return records;
        });
        return { revision: crypto.createHash('sha256').update(Buffer.concat(buffers)).digest('hex'),
            items: rows[0], enemies: rows[1], workbooks, buffers };
    }
    async function saveItems(payload) {
        if (writing) {
            throw new Error('正在保存，请稍后重试');
        }
        writing = true;
        try {
            const data = await readTables();
            if (payload.revision !== data.revision) {
                throw new Error('Excel 已被外部修改，请导出备份后重新读取');
            }
            if (!Array.isArray(payload.items) || !payload.drops || typeof payload.drops !== 'object') {
                throw new Error('items 或 drops 格式无效');
            }
            const ids = new Set();
            for (const item of payload.items) {
                if (!Number.isSafeInteger(item.id) || Math.floor(item.id / 10000) !== 17 || item.id % 10000 === 0 || ids.has(item.id)) {
                    throw new Error('道具编号必须是唯一的 170001～179999');
                }
                ids.add(item.id);
                if (typeof item.name !== 'string' || !item.name.trim() || typeof item.des !== 'string' || !item.des.trim() || !['SELF', 'ENEMY'].includes(item.target)
                    || !['ATTACK', 'SKILL', 'POWER'].includes(item.type)
                    || !Number.isSafeInteger(item.price) || item.price <= 0) {
                    throw new Error(`${item.id}：名称、描述、目标或类型无效`);
                }
                validateEffects(item.effect);
            }
            const enemyIds = new Set(data.enemies.map(enemy => {
                return String(enemy.id);
            }));
            for (const [enemyId, itemId] of Object.entries(payload.drops)) {
                if (!enemyIds.has(enemyId) || (itemId !== 0 && !ids.has(itemId))) {
                    throw new Error(`${enemyId}：掉落引用不存在`);
                }
            }
            for (const enemy of data.enemies) {
                const drop = Object.prototype.hasOwnProperty.call(payload.drops, enemy.id) ? payload.drops[enemy.id] : enemy.itemRewad || 0;
                if (drop && !ids.has(drop)) {
                    throw new Error(`不能删除 ${enemy.name} 正在引用的道具`);
                }
            }
            const sheet = data.workbooks[0].worksheets[0];
            const fields = sheet.getRow(2).values;
            const originals = new Map(data.items.map(item => {
                return [item.id, item];
            }));
            for (let row = 6; row <= Math.max(sheet.rowCount, payload.items.length + 5); row++) {
                const item = payload.items[row - 6];
                fields.forEach((field, col) => {
                    const previous = item ? originals.get(item.id) || {} : {};
                    const value = item ? (Object.prototype.hasOwnProperty.call(item, field) ? item[field] : previous[field] || null) : null;
                    sheet.getCell(row, col).value = value && typeof value === 'object' ? JSON.stringify(value) : value;
                });
            }
            const enemySheet = data.workbooks[1].worksheets[0];
            const dropCol = enemySheet.getRow(2).values.indexOf('itemRewad');
            if (dropCol < 1) {
                throw new Error('敌人表缺少 itemRewad 字段');
            }
            enemySheet.eachRow((row, index) => {
                if (index >= 6 && Object.prototype.hasOwnProperty.call(payload.drops, row.getCell(1).value)) {
                    row.getCell(dropCol).value = payload.drops[row.getCell(1).value] || null;
                }
            });
            const output = await Promise.all(data.workbooks.map(workbook => {
                return workbook.xlsx.writeBuffer();
            }));
            if ((await readTables()).revision !== data.revision) {
                throw new Error('保存期间 Excel 发生变化，请重新读取');
            }
            // 保留备份，写失败时还原两张表，避免留下悬空引用。
            await Promise.all(files.map((file, index) => {
                return fs.writeFile(file + '.editor-backup', data.buffers[index]);
            }));
            try {
                for (const [index, file] of files.entries()) {
                    await fs.writeFile(file + '.editor-tmp', output[index]);
                    await fs.rename(file + '.editor-tmp', file);
                }
            }
            catch (error) {
                await Promise.all(files.map((file, index) => {
                    return fs.writeFile(file, data.buffers[index]);
                }));
                throw error;
            }
            return { revision: (await readTables()).revision };
        }
        finally {
            writing = false;
        }
    }
    const server = http.createServer(async (request, response) => {
        response.setHeader('Cache-Control', 'no-store');
        const send = (status, value) => {
            response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
            response.end(JSON.stringify(value));
        };
        try {
            const url = new URL(request.url, 'http://localhost');
            if (request.method === 'GET' && url.pathname === '/api/items') {
                const { revision, items, enemies } = await readTables();
                send(200, { revision, items, enemies, effectTypes: [...effectTypes] });
            }
            else if (request.method === 'POST' && url.pathname === '/api/items') {
                if (request.headers.origin !== `http://${request.headers.host}` || request.headers['content-type'] !== 'application/json') {
                    throw new Error('请求来源或格式无效');
                }
                let body = '';
                for await (const chunk of request) {
                    body += chunk;
                    if (body.length > 5 * 1024 * 1024) {
                        throw new Error('请求超过 5 MB');
                    }
                }
                send(200, await saveItems(JSON.parse(body)));
            }
            else if (request.method === 'GET' && ['/', '/itemEffectEditor.html', '/itemEffectEditor.js'].includes(url.pathname)) {
                const filename = url.pathname.endsWith('.js') ? 'itemEffectEditor.js' : 'itemEffectEditor.html';
                response.writeHead(200, { 'Content-Type': filename.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8' });
                response.end(await fs.readFile(path.join(__dirname, filename)));
            }
            else if (request.method === 'GET' && url.pathname === '/effectCatalog.js') {
                response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
                response.end(await fs.readFile(path.join(__dirname, 'effectCatalog.js')));
            }
            else {
                send(404, { error: '不存在的地址' });
            }
        }
        catch (error) {
            send(400, { error: error.message });
        }
    });
    return { server, readTables, saveItems };
}
if (require.main === module) {
    const editor = createEditor();
    const port = Number(process.env.PORT) || 3212;
    editor.server.on('error', error => {
        if (error.code === 'EADDRINUSE') {
            console.error(`端口 ${port} 已被占用。编辑器可能已经启动，可直接打开 http://127.0.0.1:${port}。`);
        }
        else {
            console.error('编辑器启动失败：' + error.message);
        }
        process.exitCode = 1;
    });
    editor.server.listen(port, '127.0.0.1', () => {
        console.log(`道具编辑器：http://127.0.0.1:${port}`);
    });
}
module.exports = { createEditor, validateEffects };

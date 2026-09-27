const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Excel = require('../extensions/oops-plugin-excel-to-json/node_modules/exceljs');

const root = path.resolve(__dirname, '..');
const tables = ['1_Role', '2_Card', '3_Dice'];
const unsupportedEffects = new Set([
    'DRAW', 'DRAW_UNTIL', 'NO_DRAW', 'GAIN_ENERGY', 'GAIN_ENERGY_NEXT_TURN',
    'ENERGY_NEXT_TURN', 'DOUBLE_ENERGY', 'SET_ENERGY', 'GAIN_ENERGY_PER',
    'X_COST', 'SET_CARD_COST', 'MODIFY_CARD_COST'
]);
let writing = false;

async function readTables() {
    const buffers = await Promise.all(tables.map(name => fs.readFile(path.join(root, 'excel', name + '.xlsx'))));
    const revision = crypto.createHash('sha256').update(Buffer.concat(buffers)).digest('hex');
    const workbooks = await Promise.all(buffers.map(async buffer => {
        const workbook = new Excel.Workbook();
        await workbook.xlsx.load(buffer);
        return workbook;
    }));
    const rows = workbooks.map(workbook => {
        const sheet = workbook.worksheets[0];
        const fields = sheet.getRow(2).values;
        const data = [];
        sheet.eachRow((row, index) => {
            if (index < 6 || !row.getCell(1).value) {
                return;
            }
            const record = {};
            fields.forEach((field, col) => {
                let value = row.getCell(col).value;
                const type = sheet.getRow(3).getCell(col).value;
                if (['array', 'json', 'any'].includes(type) && typeof value === 'string' && value.trim()) {
                    value = JSON.parse(value);
                }
                record[field] = value;
            });
            data.push(record);
        });
        return data;
    });
    return { revision, workbooks, roles: rows[0], cards: rows[1], dice: rows[2] };
}

function validateCards(cards, data) {
    if (!Array.isArray(cards)) {
        throw new Error('cards 必须是数组');
    }
    const ids = new Set();
    for (const card of cards) {
        const id = Number(card.id);
        if (!Number.isSafeInteger(id) || id <= 0 || ids.has(id)) {
            throw new Error('卡牌 ID 必须是唯一正整数');
        }
        ids.add(id);
        if (!data.roles.some(role => role.id === Number(card.role)) || ![1, 2, 3].includes(card.level) || !Number.isSafeInteger(card.price) || card.price < 0) {
            throw new Error(`${id}：角色、等级或价格无效`);
        }
        if (!['SELF', 'ENEMY'].includes(card.target) || !Array.isArray(card.DiceNeed) || card.DiceNeed.length > 5 || card.DiceNeed.some(diceId => !data.dice.some(dice => dice.id === diceId && dice.role === Number(card.role)))) {
            throw new Error(`${id}：目标或骰子条件无效（只能使用所属角色的骰子，最多 5 个）`);
        }
        if (!Array.isArray(card.effect)) {
            throw new Error(`${id}：effect 必须是数组`);
        }
        const inspect = nodes => {
            for (const node of nodes) {
                if (!['SELF', 'ENEMY'].includes(node.target) || unsupportedEffects.has(node.type) || /ORB|STANCE|MANTRA|MARK|SCRY|DAMAGE_ALL|DAMAGE_RANDOM|POISON_EXPLODE/.test(node.type)) {
                    throw new Error(`${id}：效果包含不支持的目标或机制`);
                }
                for (const branch of ['children', 'elseEffects']) {
                    if (node[branch]) {
                        inspect(node[branch]);
                    }
                }
            }
        };
        inspect(card.effect);
    }
}

async function saveCards(payload) {
    const data = await readTables();
    if (payload.revision !== data.revision) {
        throw new Error('Excel 已被外部修改，请先导出当前 JSON 备份，再重新读取表格');
    }
    validateCards(payload.cards, data);
    const workbook = data.workbooks[1];
    const sheet = workbook.worksheets[0];
    const extra = [['target', '出牌目标', 'string'], ['type', '卡牌类型', 'string'], ['upId', '升级卡牌', 'int'], ['flags', '特殊属性', 'json']];
    const legacyUpIdColumn = sheet.getRow(2).values.indexOf('up_id');
    if (legacyUpIdColumn > 0) {
        sheet.getCell(2, legacyUpIdColumn).value = 'upId';
    }
    for (const [field, label, type] of extra) {
        if (!sheet.getRow(2).values.includes(field)) {
            const col = sheet.columnCount + 1;
            [label, field, type, 'server', 'client'].forEach((value, index) => {
                sheet.getCell(index + 1, col).value = value;
            });
        }
    }
    const fields = sheet.getRow(2).values;
    const original = new Map(data.cards.map(card => [Number(card.id), card]));
    const end = Math.max(sheet.rowCount, payload.cards.length + 5);
    for (let row = 6; row <= end; row++) {
        const card = payload.cards[row - 6];
        fields.forEach((field, col) => {
            const previous = card ? original.get(Number(card.id)) || {} : {};
            let value = card ? (Object.prototype.hasOwnProperty.call(card, field) ? card[field] : previous[field]) : null;
            if (field === 'upId' && card && !Object.prototype.hasOwnProperty.call(card, field)) {
                value = previous.up_id || null;
            }
            if (value === undefined || value === '') {
                value = null;
            }
            if (value && typeof value === 'object') {
                value = JSON.stringify(value);
            } else if (value !== null && sheet.getCell(3, col).value === 'int') {
                value = Number(value);
            }
            sheet.getCell(row, col).value = value;
        });
    }
    const buffer = await workbook.xlsx.writeBuffer();
    // 写入前再次核对，避免覆盖 Excel 中刚刚保存的配置。
    if ((await readTables()).revision !== payload.revision) {
        throw new Error('保存期间表格发生变化，请重新读取');
    }
    const filename = path.join(root, 'excel', '2_Card.xlsx');
    await fs.copyFile(filename, filename + '.editor-backup');
    const temporary = filename + '.editor-tmp';
    await fs.writeFile(temporary, buffer);
    await fs.rename(temporary, filename);
    return { revision: (await readTables()).revision };
}

const server = http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const send = (status, value) => {
        response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify(value));
    };
    try {
        const url = new URL(request.url, 'http://localhost');
        if (request.method === 'GET' && url.pathname === '/api/tables') {
            const { revision, roles, cards, dice } = await readTables();
            send(200, { revision, roles, cards, dice });
        } else if (request.method === 'POST' && url.pathname === '/api/cards') {
            if (request.headers.origin !== `http://${request.headers.host}` || request.headers['content-type'] !== 'application/json' || writing) {
                send(409, { error: '请求来源无效或正在保存' });
                return;
            }
            writing = true;
            try {
                let body = '';
                for await (const chunk of request) {
                    body += chunk;
                    if (body.length > 5 * 1024 * 1024) {
                        throw new Error('数据超过 5 MB');
                    }
                }
                send(200, await saveCards(JSON.parse(body)));
            } finally {
                writing = false;
            }
        } else if (request.method === 'GET' && ['/', '/cardEffectEditor.html'].includes(url.pathname)) {
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end(await fs.readFile(path.join(__dirname, 'cardEffectEditor.html')));
        } else {
            send(404, { error: '不存在的地址' });
        }
    } catch (error) {
        send(400, { error: error.message });
    }
});

if (require.main === module) {
    const port = Number(process.env.PORT) || 3210;
    server.on('error', error => {
        if (error.code === 'EADDRINUSE') {
            console.error(`端口 ${port} 已被占用。编辑器可能已经启动，可直接打开 http://127.0.0.1:${port}。`);
        } else {
            console.error('编辑器启动失败：' + error.message);
        }
        process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
        console.log(`卡牌编辑器：http://127.0.0.1:${port}`);
    });
}
module.exports = { readTables, validateCards, saveCards, server };

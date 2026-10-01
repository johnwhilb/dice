const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Excel = require('../../tinHelm/extensions/oops-plugin-excel-to-json/node_modules/exceljs');

const root = path.resolve(__dirname, '..');
let writing = false;

async function readTables() {
    const buffer = await fs.readFile(path.join(root, 'excel', '5_Enemy.xlsx'));
    const revision = crypto.createHash('sha256').update(buffer).digest('hex');
    const workbook = new Excel.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    const fields = sheet.getRow(2).values;
    const enemies = [];
    sheet.eachRow((row, index) => {
        if (index < 6 || !row.getCell(1).value) {
            return;
        }
        const enemy = {};
        fields.forEach((field, col) => {
            let value = row.getCell(col).value;
            const type = sheet.getRow(3).getCell(col).value;
            if (['array', 'json', 'any'].includes(type) && typeof value === 'string' && value.trim()) {
                value = JSON.parse(value);
            }
            enemy[field] = value;
        });
        enemies.push(enemy);
    });
    return { revision, workbook, enemies };
}

const actionTypes = new Set(['ATTACK', 'DEFEND', 'BUFF', 'DEBUFF', 'HEAL', 'WAIT', 'LOSE_HP',
    'REMOVE_BLOCK', 'CLEANSE', 'DISCARD', 'EXHAUST', 'ADD_CARD', 'EFFECTS']);
const conditionFields = new Set(['TURN', 'TURN_MOD', 'SELF_HP_PERCENT', 'PLAYER_HP_PERCENT', 'SELF_BLOCK',
    'PLAYER_BLOCK', 'LAST_ACTION', 'REPEAT_COUNT']);
const operators = new Set(['<', '<=', '==', '!=', '>=', '>']);
const buffs = new Set(['STRENGTH', 'DEXTERITY', 'ARTIFACT', 'INTANGIBLE', 'THORNS', 'REGENERATION', 'METALLICIZE', 'BARRICADE']);
const debuffs = new Set(['WEAK', 'VULNERABLE', 'FRAIL', 'POISON']);
const effectTypes = new Set(['DAMAGE', 'BLOCK', 'HEAL', 'LOSE_HP', 'KILL_IF', 'MULTIPLY_BLOCK',
    'REMOVE_BLOCK', 'PIERCE_BLOCK', 'BLOCK_NEXT_TURN', 'APPLY_STATUS', 'REMOVE_STATUS',
    'MULTIPLY_STATUS', 'TRANSFER_STATUS', 'CLEANSE', 'MODIFY_STAT', 'SET_STAT', 'DOUBLE_STAT',
    'SET_INTANGIBLE', 'IF', 'SEQUENCE', 'REPEAT', 'REGISTER_TRIGGER', 'SCHEDULE', 'RANDOM_CHOICE',
    'DISCARD', 'EXHAUST', 'DISCARD_HAND', 'EXHAUST_HAND', 'GAIN_GOLD', 'LOSE_GOLD',
    'SET_VARIABLE', 'MODIFY_VARIABLE', 'ADD_CARD']);

function validateEffects(effects, depth = 0) {
    if (!Array.isArray(effects) || depth > 20 || effects.length > 100) {
        throw new Error('复合效果格式错误或嵌套过深');
    }
    effects.forEach(effect => {
        if (!effect || typeof effect !== 'object' || Array.isArray(effect) || !effectTypes.has(effect.type)) {
            throw new Error('复合效果包含未支持的类型');
        }
        if (effect.target && !['SELF', 'ENEMY'].includes(effect.target)) {
            throw new Error('复合效果目标无效');
        }
        if (effect.params && (typeof effect.params !== 'object' || Array.isArray(effect.params))) {
            throw new Error('复合效果参数格式错误');
        }
        if (effect.children) {
            validateEffects(effect.children, depth + 1);
        }
        if (effect.elseEffects) {
            validateEffects(effect.elseEffects, depth + 1);
        }
    });
}

function validateBehavior(node, depth = 0) {
    if (!node || typeof node !== 'object' || Array.isArray(node) || depth > 20) {
        throw new Error('行为树格式错误或嵌套过深');
    }
    if (node.type === 'ACTION') {
        if (!actionTypes.has(node.action)) {
            throw new Error('敌人行动类型无效');
        }
        if (['ATTACK', 'DEFEND', 'HEAL', 'LOSE_HP', 'REMOVE_BLOCK'].includes(node.action)
            && (!Number.isSafeInteger(node.amount) || node.amount < 0 || node.amount > 9999)) {
            throw new Error('行动数值须为 0 至 9999 的整数');
        }
        if (node.action === 'ATTACK' && (!Number.isSafeInteger(node.hits) || node.hits < 1 || node.hits > 100)) {
            throw new Error('攻击次数须为 1 至 100');
        }
        if (['BUFF', 'DEBUFF'].includes(node.action)
            && (!(node.action === 'BUFF' ? buffs : debuffs).has(node.status)
                || !Number.isSafeInteger(node.stacks) || node.stacks < 1 || node.stacks > 999)) {
            throw new Error('状态类型或层数无效');
        }
        if (['LOSE_HP', 'REMOVE_BLOCK', 'CLEANSE'].includes(node.action)
            && !['PLAYER', 'ENEMY'].includes(node.target || (node.action === 'CLEANSE' ? 'ENEMY' : 'PLAYER'))) {
            throw new Error('行动目标无效');
        }
        if (['DISCARD', 'EXHAUST', 'ADD_CARD'].includes(node.action)
            && (!Number.isSafeInteger(node.count) || node.count < 1 || node.count > 100)) {
            throw new Error('卡牌张数须为 1 至 100');
        }
        if (node.action === 'ADD_CARD' && (!Number.isSafeInteger(node.cardId) || node.cardId < 1
            || !['DRAW', 'DISCARD', 'HAND'].includes(node.pile))) {
            throw new Error('卡牌 ID 或目标牌堆无效');
        }
        if (node.action === 'EFFECTS') {
            validateEffects(node.effects);
            if (!node.effects.length) {
                throw new Error('复合效果至少需要一项');
            }
        }
        return;
    }
    if (!['SELECTOR', 'RANDOM', 'SEQUENCE', 'CYCLE', 'CONDITION'].includes(node.type)
        || !Array.isArray(node.children) || !node.children.length) {
        throw new Error('分支节点需要至少一个子节点');
    }
    if (node.type === 'CONDITION' && (node.children.length !== 1 || !conditionFields.has(node.field)
        || !operators.has(node.operator)
        || (node.field === 'LAST_ACTION' ? !actionTypes.has(node.actionValue) || !['==', '!='].includes(node.operator)
            : !Number.isFinite(node.value))
        || (node.field === 'TURN_MOD' && (!Number.isSafeInteger(node.modulus) || node.modulus < 1 || node.modulus > 1000)))) {
        throw new Error('条件节点须配置字段、比较符、数值及一个子节点');
    }
    if (node.type === 'RANDOM' && node.children.some(child =>
        child.weight !== undefined && (!Number.isSafeInteger(child.weight) || child.weight < 1 || child.weight > 1000))) {
        throw new Error('随机权重须为 1 至 1000');
    }
    node.children.forEach(child => validateBehavior(child, depth + 1));
}

function validateEnemies(enemies) {
    if (!Array.isArray(enemies) || !enemies.length) {
        throw new Error('敌人列表不能为空');
    }
    const ids = new Set();
    for (const enemy of enemies) {
        if (!Number.isSafeInteger(enemy.id) || enemy.id < 50001 || enemy.id > 59999 || ids.has(enemy.id)) {
            throw new Error('敌人 ID 须为唯一的 50001 至 59999 整数');
        }
        ids.add(enemy.id);
        if (!String(enemy.name || '').trim() || !Number.isSafeInteger(enemy.originHp) || enemy.originHp < 1) {
            throw new Error(`${enemy.id}：名称或初始生命无效`);
        }
        validateBehavior(enemy.behavior);
    }
}

async function saveEnemies(payload) {
    const data = await readTables();
    if (payload.revision !== data.revision) {
        throw new Error('Excel 已被外部修改，请重新读取表格');
    }
    validateEnemies(payload.enemies);
    const sheet = data.workbook.worksheets[0];
    const fields = sheet.getRow(2).values;
    if (!fields.includes('behavior') || fields.includes('nomalAttack')) {
        throw new Error('Enemy 表尚未迁移到 behavior 字段');
    }
    const end = Math.max(sheet.rowCount, payload.enemies.length + 5);
    for (let row = 6; row <= end; row++) {
        const enemy = payload.enemies[row - 6];
        fields.forEach((field, col) => {
            let value = enemy ? enemy[field] : null;
            if (value && typeof value === 'object') {
                value = JSON.stringify(value);
            }
            sheet.getCell(row, col).value = value === undefined ? null : value;
        });
    }
    const buffer = await data.workbook.xlsx.writeBuffer();
    if ((await readTables()).revision !== payload.revision) {
        throw new Error('保存期间表格发生变化，请重新读取');
    }
    const filename = path.join(root, 'excel', '5_Enemy.xlsx');
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
        if (request.method === 'GET' && url.pathname === '/api/enemies') {
            const { revision, enemies } = await readTables();
            send(200, { revision, enemies });
        } else if (request.method === 'POST' && url.pathname === '/api/enemies') {
            if (request.headers.origin !== `http://${request.headers.host}`
                || request.headers['content-type'] !== 'application/json' || writing) {
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
                send(200, await saveEnemies(JSON.parse(body)));
            } finally {
                writing = false;
            }
        } else if (request.method === 'GET' && url.pathname === '/enemyBehaviorGraph.js') {
            response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
            response.end(await fs.readFile(path.join(__dirname, 'enemyBehaviorGraph.js')));
        } else if (request.method === 'GET' && ['/', '/enemyBehaviorEditor.html'].includes(url.pathname)) {
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end(await fs.readFile(path.join(__dirname, 'enemyBehaviorEditor.html')));
        } else {
            send(404, { error: '不存在的地址' });
        }
    } catch (error) {
        send(400, { error: error.message });
    }
});

if (require.main === module) {
    const port = Number(process.env.PORT) || 3211;
    server.listen(port, '127.0.0.1', () => {
        console.log(`敌人行为树编辑器：http://127.0.0.1:${port}`);
    });
}

module.exports = { readTables, validateBehavior, validateEnemies, saveEnemies, server };

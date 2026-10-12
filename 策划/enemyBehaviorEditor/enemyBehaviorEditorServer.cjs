/**
 * @typedef {import('../../tinHelm/assets/script/game/battle/model/BattleTypes').BattleEffect} BattleEffect
 * @typedef {import('../../tinHelm/assets/script/game/battle/model/BattleTypes').EnemyBehaviorNode & {editorX?:number,editorY?:number}} EditorBehaviorNode
 * @typedef {{id:number|string,name:string,role:number,level:number,price:number,DiceNeed:number[],des:string,type:string,target:string,upId?:number|string|null,flags:Record<string,boolean>,effect:BattleEffect[]}} EditorCard
 * @typedef {{id:number,name:string,hp:number,behavior:EditorBehaviorNode,mechanics:import('../../tinHelm/assets/script/game/battle/model/BattleTypes').EnemyMechanics}} EditorEnemy
 * @typedef {{id:number,type:string,name:string,category:string,stackMode:string,maxStacks:number,decayAtTurnEnd:boolean,description:string}} BuffConfig
 * @typedef {{key:string,label:string,kind:string,options:(number|string)[]|null}} EffectField
 * @typedef {{id:number,type:string,name:string,category:string,description:string,defaultTarget:string,defaultParams:import('../../tinHelm/assets/script/game/battle/model/BattleTypes').BattleEffectParams,fields:EffectField[],container:string,cardEnabled:boolean,enemyEnabled:boolean}} EffectConfig
 * @typedef {{node:BattleEffect,arr:BattleEffect[],index:number,parent:BattleEffect|null,branch:string}} EffectLocation
 */
/** @typedef {{revision:string,workbook:import("../../tinHelm/extensions/oops-plugin-excel-to-json/node_modules/exceljs").Workbook,enemies:EditorEnemy[],buffs:BuffConfig[],effects:EffectConfig[]}} EditorTables */
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Excel = require('../../tinHelm/extensions/oops-plugin-excel-to-json/node_modules/exceljs');
const root = path.resolve(__dirname, '..');
let writing = false;
/**
 * @returns {void}
 */
function validateBuffRows(rows) {
    if (!Array.isArray(rows) || !rows.length) {
        throw new Error('Buff表不能为空');
    }
    const ids = new Set();
    const types = new Set();
    for (const row of rows) {
        if (!Number.isSafeInteger(row.id) || row.id <= 0 || ids.has(row.id) || types.has(row.type)
            || typeof row.type !== 'string' || !row.type || typeof row.name !== 'string' || !row.name
            || !['BUFF', 'DEBUFF'].includes(row.category) || !['ADD', 'MAX', 'REPLACE'].includes(row.stackMode) || !Number.isSafeInteger(row.maxStacks) || row.maxStacks < 1 || typeof row.description !== 'string' || typeof row.decayAtTurnEnd !== 'boolean') {
            throw new Error('Buff表的编号、枚举、名称或分类无效');
        }
        ids.add(row.id);
        types.add(row.type);
    }
}
// 等待敌人与Buff表读取完成，两个文件共同参与保存版本校验。
/**
 * @returns {void}
 */
function validateEffectRows(rows) {
    if (!Array.isArray(rows) || !rows.length) {
        throw new Error('效果表不能为空');
    }
    const ids = new Set();
    const types = new Set();
    for (const row of rows) {
        if (!Number.isSafeInteger(row.id) || row.id <= 0 || ids.has(row.id) || types.has(row.type)
            || typeof row.type !== 'string' || !row.type || typeof row.name !== 'string' || !row.name
            || !Array.isArray(row.fields) || !row.defaultParams || typeof row.defaultParams !== 'object'
            || Array.isArray(row.defaultParams) || !['SELF', 'ENEMY'].includes(row.defaultTarget)
            || typeof row.cardEnabled !== 'boolean' || typeof row.enemyEnabled !== 'boolean') {
            throw new Error('效果表的编号、枚举、名称或参数定义无效');
        }
        ids.add(row.id);
        types.add(row.type);
    }
}
// 等待业务表、效果表与Buff表读取完成，共同参与保存版本校验。
/**
 * @returns {Promise<EditorTables>}
 */
async function readTables() {
    const buffers = await Promise.all(['5_Enemy', '20_BattleBuff', '21_BattleEffect'].map(name => {
        return fs.readFile(path.join(root, 'excel', name + '.xlsx'));
    }));
    const revision = crypto.createHash('sha256').update(Buffer.concat(buffers)).digest('hex');
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
                if (['array', 'json', 'any'].includes(sheet.getRow(3).getCell(col).value) && typeof value === 'string' && value.trim()) {
                    value = JSON.parse(value);
                }
                record[field.replace(/_ENUM$/, '')] = value;
            });
            records.push(record);
        });
        return records;
    });
    validateBuffRows(rows[1]);
    validateEffectRows(rows[2]);
    return { revision, workbook: workbooks[0], enemies: rows[0], buffs: rows[1], effects: rows[2] };
}
const actionTypes = new Set(['ATTACK', 'DEFEND', 'BUFF', 'DEBUFF', 'HEAL', 'WAIT', 'LOSE_HP',
    'REMOVE_BLOCK', 'CLEANSE', 'DISCARD', 'EXHAUST', 'ADD_CARD', 'EFFECTS']);
const conditionFields = new Set(['TURN', 'TURN_MOD', 'SELF_HP_PERCENT', 'PLAYER_HP_PERCENT', 'SELF_BLOCK',
    'PLAYER_BLOCK', 'LAST_ACTION', 'REPEAT_COUNT']);
const operators = new Set(['<', '<=', '==', '!=', '>=', '>']);
const durations = new Set(['DEFAULT', 'ACTION', 'TURN', 'NEXT_TURN', 'COMBAT', 'RUN']);
const mechanismEvents = new Set(['ON_COMBAT_START', 'ON_TURN_START', 'ON_TURN_END', 'ON_CARD_PLAYED',
    'ON_ATTACK_PLAYED', 'ON_SKILL_PLAYED', 'ON_POWER_PLAYED', 'ON_DAMAGE_DEALT', 'ON_DAMAGE_TAKEN', 'ON_HP_LOSS']);
/**
 * @returns {void}
 */
function validateEffects(effects, buffRows, effectRows, depth = 0) {
    const BattleEffectTypeEnum = Object.fromEntries(effectRows.map(row => [row.type, row.id]));
    if (!Array.isArray(effects) || depth > 20 || effects.length > 100) {
        throw new Error('复合效果格式错误或嵌套过深');
    }
    effects.forEach(effect => {
        if (!effect || typeof effect !== 'object' || Array.isArray(effect) || !effectRows.some(row => row.id === effect.type && row.enemyEnabled)) {
            throw new Error('复合效果包含未支持的类型');
        }
        if (effect.target && !['SELF', 'ENEMY'].includes(effect.target)) {
            throw new Error('复合效果目标无效');
        }
        if (effect.params && (typeof effect.params !== 'object' || Array.isArray(effect.params))) {
            throw new Error('复合效果参数格式错误');
        }
        if ([BattleEffectTypeEnum.APPLY_STATUS, BattleEffectTypeEnum.REMOVE_STATUS, BattleEffectTypeEnum.MULTIPLY_STATUS, BattleEffectTypeEnum.TRANSFER_STATUS].includes(effect.type)) {
            if (!effect.params || !buffRows.some(buff => {
                return buff.id === effect.params.status;
            })
                && !(effect.type === BattleEffectTypeEnum.REMOVE_STATUS && effect.params.status === 'ALL')) {
                throw new Error('复合效果状态编号不在 Buff 表中');
            }
        }
        if ([BattleEffectTypeEnum.MODIFY_STAT, BattleEffectTypeEnum.SET_STAT, BattleEffectTypeEnum.DOUBLE_STAT].includes(effect.type)
            && (!effect.params || !buffRows.some(buff => {
                return buff.id === effect.params.stat;
            }) && !['HP', 'MAX_HP', 'BLOCK'].includes(effect.params.stat))) {
            throw new Error('复合效果属性编号不在 Buff 表中');
        }
        if (effect.type === BattleEffectTypeEnum.APPLY_STATUS) {
            const params = effect.params || {};
            const validStacks = Number.isSafeInteger(params.stacks) && Math.abs(params.stacks) <= 999
                || typeof params.stacks === 'string' && params.stacks.trim().length > 0 && params.stacks.length <= 512;
            if (!buffRows.some(buff => {
                return buff.id === params.status;
            })
                || !validStacks
                || !durations.has(params.duration || 'DEFAULT')) {
                throw new Error('复合效果状态、层数或持续范围无效');
            }
        }
        if (effect.children) {
            validateEffects(effect.children, buffRows, effectRows, depth + 1);
        }
        if (effect.elseEffects) {
            validateEffects(effect.elseEffects, buffRows, effectRows, depth + 1);
        }
    });
}
/**
 * @returns {void}
 */
function validateBehavior(node, buffRows, effectRows, depth = 0) {
    if (!node || typeof node !== 'object' || Array.isArray(node) || depth > 20) {
        throw new Error('行为树格式错误或嵌套过深');
    }
    if (node.type === 'ACTION') {
        if (node.duration && !durations.has(node.duration)) {
            throw new Error('状态持续范围无效');
        }
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
            && (!buffRows.some(buff => {
                return buff.id === node.status && buff.category === (node.action === 'DEBUFF' ? 'DEBUFF' : 'BUFF');
            })
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
            validateEffects(node.effects, buffRows, effectRows);
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
    if (node.type === 'RANDOM' && node.children.some(child => {
        return child.weight !== undefined && (!Number.isSafeInteger(child.weight) || child.weight < 1 || child.weight > 1000);
    })) {
        throw new Error('随机权重须为 1 至 1000');
    }
    node.children.forEach(child => {
        return validateBehavior(child, buffRows, effectRows, depth + 1);
    });
}
/**
 * @returns {void}
 */
function validateMechanics(mechanics, buffRows, effectRows) {
    if (!mechanics) {
        return;
    }
    if (typeof mechanics !== 'object' || Array.isArray(mechanics)
        || !Array.isArray(mechanics.initialStatuses) || !Array.isArray(mechanics.phases) || !Array.isArray(mechanics.triggers)
        || mechanics.initialStatuses.length > 20 || mechanics.phases.length > 10 || mechanics.triggers.length > 20) {
        throw new Error('特殊机制须包含 initialStatuses、phases、triggers 数组，且数量不能超过20/10/20');
    }
    for (const initial of mechanics.initialStatuses) {
        if (!initial || !buffRows.some(buff => {
            return buff.id === initial.status && buff.category === 'BUFF';
        }) || !Number.isSafeInteger(initial.stacks)
            || initial.stacks < 1 || initial.stacks > 999 || !durations.has(initial.duration || 'COMBAT')) {
            throw new Error('战斗初始状态无效');
        }
    }
    const phaseIds = new Set();
    for (const phase of mechanics.phases) {
        if (!phase || typeof phase.id !== 'string' || !phase.id.trim() || phaseIds.has(phase.id)
            || typeof phase.name !== 'string' || !phase.name.trim()
            || !['HP_BELOW', 'TURN_AT_LEAST', 'HITS_AT_LEAST'].includes(phase.condition)
            || !Number.isFinite(phase.value) || phase.value <= 0
            || (phase.condition === 'HP_BELOW' ? phase.value > 100 : !Number.isSafeInteger(phase.value))) {
            throw new Error('阶段编号、名称、触发条件或阈值无效');
        }
        phaseIds.add(phase.id);
        validateEffects(phase.effects, buffRows, effectRows);
        if (phase.behavior) {
            validateBehavior(phase.behavior, buffRows, effectRows);
        }
    }
    for (const trigger of mechanics.triggers) {
        if (!trigger || !mechanismEvents.has(trigger.event)
            || !['ENEMY', 'PLAYER'].includes(trigger.listenSide || 'ENEMY')
            || !Number.isSafeInteger(trigger.limit || 0) || (trigger.limit || 0) < 0
            || (trigger.filter && (typeof trigger.filter !== 'object' || Array.isArray(trigger.filter)))) {
            throw new Error('特殊机制触发器无效');
        }
        validateEffects(trigger.effects, buffRows, effectRows);
    }
}
/**
 * @returns {void}
 */
function validateEnemies(enemies, buffRows, effectRows) {
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
        validateBehavior(enemy.behavior, buffRows, effectRows);
        validateMechanics(enemy.mechanics, buffRows, effectRows);
    }
}
// 等待表格读写或输入校验完成，失败信息统一显示到编辑器。
/**
 * @returns {Promise<{revision:string}>}
 */
async function saveEnemies(payload) {
    const data = await readTables();
    if (payload.revision !== data.revision) {
        throw new Error('Excel 已被外部修改，请重新读取表格');
    }
    validateEnemies(payload.enemies, data.buffs, data.effects);
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
        if (request.method === 'GET' && url.pathname === '/api/enemies') {
            const { revision, enemies, buffs, effects } = await readTables();
            send(200, { revision, enemies, buffs, effects });
        }
        else if (request.method === 'POST' && url.pathname === '/api/enemies') {
            if (request.headers.origin !== `http://${request.headers.host}`
                || request.headers['content-type'] !== 'application/json' || writing) {
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
                send(200, await saveEnemies(JSON.parse(body)));
            })().finally(() => {
                writing = false;
            });
        }
        else if (request.method === 'GET' && url.pathname === '/enemyBehaviorGraph.js') {
            response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
            response.end(await fs.readFile(path.join(__dirname, 'enemyBehaviorGraph.js')));
        }
        else if (request.method === 'GET' && ['/', '/enemyBehaviorEditor.html'].includes(url.pathname)) {
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end(await fs.readFile(path.join(__dirname, 'enemyBehaviorEditor.html')));
        }
        else {
            send(404, { error: '不存在的地址' });
        }
    })().catch(error => {
        send(400, { error: error.message });
    });
});
if (require.main === module) {
    const port = Number(process.env.PORT) || 3211;
    server.listen(port, '127.0.0.1', () => {
        console.log(`敌人行为树编辑器：http://127.0.0.1:${port}`);
    });
}
module.exports = { readTables, validateBehavior, validateMechanics, validateEnemies, saveEnemies, server };

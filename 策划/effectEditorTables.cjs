/**
 * @typedef {import('../tinHelm/assets/script/game/battle/model/BattleTypes').BattleEffect} BattleEffect
 * @typedef {import('../tinHelm/assets/script/game/battle/model/BattleTypes').EnemyBehaviorNode & {editorX?:number,editorY?:number}} EditorBehaviorNode
 * @typedef {{id:number|string,name:string,role:number,level:number,price:number,DiceNeed:number[],des:string,type:string,target:string,upId?:number|string|null,flags:Record<string,boolean|number|string>,effect:BattleEffect[]}} EditorCard
 * @typedef {{id:number,name:string,hp:number,behavior:EditorBehaviorNode,mechanics:import('../tinHelm/assets/script/game/battle/model/BattleTypes').EnemyMechanics}} EditorEnemy
 * @typedef {{id:number,type:string,name:string,category:string,stackMode:string,maxStacks:number,decayAtTurnEnd:boolean,description:string,effects:BattleEffect[],rules:Record<string,number>}} BuffConfig
 * @typedef {{key:string,label:string,kind:string,options:(number|string)[]|null}} EffectField
 * @typedef {{id:number,type:string,name:string,category:string,description:string,defaultTarget:string,defaultParams:import('../tinHelm/assets/script/game/battle/model/BattleTypes').BattleEffectParams,fields:EffectField[],container:string,cardEnabled:boolean,enemyEnabled:boolean}} EffectConfig
 * @typedef {{node:BattleEffect,arr:BattleEffect[],index:number,parent:BattleEffect|null,branch:string}} EffectLocation
 */
/** @typedef {{revision:string,workbooks:import("../tinHelm/extensions/oops-plugin-excel-to-json/node_modules/exceljs").Workbook[],roles:Array<{id:number,name:string}>,cards:EditorCard[],dice:Array<{id:number,name:string,role:number[],diceNum:number[]}>,buffs:BuffConfig[],effects:EffectConfig[]}} EditorTables */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Excel = require('../tinHelm/extensions/oops-plugin-excel-to-json/node_modules/exceljs');
const { loadWorkbook } = require('../tinHelm/extensions/oops-plugin-excel-to-json/workbook-loader.cjs');
const root = __dirname;
const tables = ['1_Role', '2_Card', '3_Dice', '20_BattleBuff', '21_BattleEffect'];
const buffDurations = ['DEFAULT', 'TURN', 'NEXT_TURN', 'COMBAT', 'UNTIL_ENEMY_END', 'ACTION'];
const buffRuleNames = ['SKILL_FREE_EXHAUST', 'FIRST_BLOCK_DOUBLE', 'VULNERABLE_BONUS', 'SHIV_DAMAGE', 'SHIV_RETAIN', 'FIRST_SHIV_DAMAGE', 'POISON_REPEATS', 'SLY_SKILLS', 'WEAK_ATTACK_DOUBLE', 'BLADE_REPEAT', 'BLADE_BLOCK', 'FREE_CARDS_PER_TURN'];
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
        if (!Number.isSafeInteger(row.id) || Math.floor(row.id / 10000) !== 20 || row.id % 10000 === 0 || ids.has(row.id) || types.has(row.type)
            || typeof row.type !== 'string' || !row.type || typeof row.name !== 'string' || !row.name
            || !['BUFF', 'DEBUFF'].includes(row.category) || !['ADD', 'MAX', 'REPLACE'].includes(row.stackMode) || !Number.isSafeInteger(row.maxStacks) || row.maxStacks < 1 || typeof row.description !== 'string' || typeof row.decayAtTurnEnd !== 'boolean'
            || !Array.isArray(row.effects) || !row.rules || typeof row.rules !== 'object' || Array.isArray(row.rules)) {
            throw new Error('Buff表的编号、枚举、名称或分类无效');
        }
        ids.add(row.id);
        types.add(row.type);
        if (!/^[A-Z][A-Z0-9_]*$/.test(row.type) || !buffDurations.includes(row.defaultDuration)
            || typeof row.dispellable !== 'boolean') {
            throw new Error(`${row.name}：枚举、默认持续时间或驱散设置无效`);
        }
        for (const [kind, amount] of Object.entries(row.rules)) {
            if (!buffRuleNames.includes(kind)
                || typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
                throw new Error(`${row.name}：持续规则或数值无效`);
            }
        }
    }
}
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
    const buffers = await Promise.all(tables.map(name => {
        return fs.readFile(path.join(root, 'excel', name + '.xlsx'));
    }));
    const revision = crypto.createHash('sha256').update(Buffer.concat(buffers)).digest('hex');
    const workbooks = await Promise.all(buffers.map(async (buffer) => {
        const workbook = new Excel.Workbook();
        await loadWorkbook(workbook, buffer);
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
                record[field.replace(/_ENUM$/, '')] = value;
            });
            if (record.stackMode) {
                record.defaultDuration = record.defaultDuration || 'DEFAULT';
                record.dispellable = typeof record.dispellable === 'undefined' || record.dispellable === null ? true : record.dispellable;
            }
            data.push(record);
        });
        return data;
    });
    validateBuffRows(rows[3]);
    validateEffectRows(rows[4]);
    const data = { revision, workbooks, roles: rows[0], cards: rows[1], dice: rows[2], buffs: rows[3], effects: rows[4], buffDurations, buffRuleNames };
    validateBuffEffects(data);
    return data;
}
// 复用卡牌效果校验，Buff中的变化目标只检查卡牌存在性，不限制来源角色。
function validateBuffEffects(data) {
    validateCards(data.buffs.map(buff => {
        return { id: buff.id, name: buff.name, role: data.roles[0].id, level: 1, price: 0,
            DiceNeed: [], target: 'SELF', type: 'SKILL', flags: {}, effect: buff.effects };
    }), data, true);
}
/**
 * @returns {void}
 */
function validateCards(cards, data, buffEffects = false) {
    if (!Array.isArray(cards)) {
        throw new Error('cards 必须是数组');
    }
    const BattleEffectTypeEnum = data.effects.reduce((types, row) => {
        types[row.type] = row.id;
        return types;
    }, {});
    const effectRows = new Map(data.effects.map(row => [row.id, row]));
    const buffIds = new Set(data.buffs.map(buff => {
        return buff.id;
    }));
    const ids = new Set();
    for (const card of cards) {
        const id = Number(card.id);
        if (!Number.isSafeInteger(id) || id <= 0 || ids.has(id)) {
            throw new Error('卡牌 ID 必须是唯一正整数');
        }
        ids.add(id);
        if (!data.roles.some(role => {
            return role.id === Number(card.role);
        }) || ![1, 2, 3].includes(card.level) || !Number.isSafeInteger(card.price) || card.price < 0) {
            throw new Error(`${id}：角色、等级或价格无效`);
        }
        if (!['SELF', 'ENEMY'].includes(card.target) || !Array.isArray(card.DiceNeed) || card.DiceNeed.length > 5 || card.DiceNeed.some(diceId => {
            return !data.dice.some(dice => {
                return dice.id === diceId && Array.isArray(dice.role) && dice.role.includes(Number(card.role));
            });
        })) {
            throw new Error(`${id}：目标或骰子条件无效（只能使用所属角色的骰子，最多 5 个）`);
        }
        if (!Array.isArray(card.effect)) {
            throw new Error(`${id}：effect 必须是数组`);
        }
        if (card.type === 'POWER' && (!card.effect.length || card.effect.some(effect => {
            return effect.type !== BattleEffectTypeEnum.APPLY_STATUS || effect.trigger && effect.trigger !== 'ON_PLAY';
        }))) {
            throw new Error(`${id}：能力牌只能在打出时施加Buff，持续行为请配置在Buff表中`);
        }
        if (!['ATTACK', 'SKILL', 'POWER', 'STATUS', 'CURSE'].includes(card.type)
            || !card.flags || typeof card.flags !== 'object' || Array.isArray(card.flags)) {
            throw new Error(`${id}：卡牌类型或特殊属性无效`);
        }
        if (card.flags.starCost !== undefined && (!Number.isSafeInteger(card.flags.starCost) || card.flags.starCost < 0 || card.flags.starCost > 999)
            || card.flags.sly !== undefined && typeof card.flags.sly !== 'boolean'
            || card.flags.archetype !== undefined && !['SHIV', 'SOVEREIGN_BLADE'].includes(card.flags.archetype)) {
            throw new Error(`${id}：星星费用、奇巧或衍生牌类型无效`);
        }
        if (card.flags.discountDice && !data.dice.some(dice => {
            return dice.id === card.flags.discountDice && Array.isArray(dice.role) && dice.role.includes(Number(card.role));
        }) || card.flags.discountMax !== undefined && (!Number.isSafeInteger(card.flags.discountMax)
            || card.flags.discountMax < 0 || card.flags.discountMax > 5)) {
            throw new Error(`${id}：减免骰子必须属于当前角色，数量必须是 0–5 的整数`);
        }
        /**
 * @returns {void}
 */
        const inspectEffects = (nodes, depth = 0) => {
            if (depth > 20 || !Array.isArray(nodes)) {
                throw new Error(`${id}：效果嵌套超过20层或格式无效`);
            }
            for (const node of nodes) {
                if (buffEffects && node.trigger && node.trigger !== 'ON_PLAY') {
                    throw new Error(`${id}：Buff使用事件监听配置持续触发，不能使用卡牌触发时机`);
                }
                const effectRow = effectRows.get(node.type);
                if (!['SELF', 'ENEMY'].includes(node.target) || !effectRow || !effectRow.cardEnabled) {
                    throw new Error(`${id}：效果包含不支持的目标或机制`);
                }
                const params = node.params;
                if ([BattleEffectTypeEnum.MOVE_CARD, BattleEffectTypeEnum.COPY_CARD, BattleEffectTypeEnum.PLAY_CARD,
                    BattleEffectTypeEnum.TRANSFORM_CARD, BattleEffectTypeEnum.GENERATE_CARD,
                    BattleEffectTypeEnum.GROW_CARD, BattleEffectTypeEnum.CARD_RULE,
                    BattleEffectTypeEnum.GAIN_STARS, BattleEffectTypeEnum.FORGE,
                    BattleEffectTypeEnum.SUMMON_BLADE, BattleEffectTypeEnum.END_TURN].includes(node.type) && node.target !== 'SELF') {
                    throw new Error(`${id}：卡牌机制只支持 SELF`);
                }
                if (!params || typeof params !== 'object' || Array.isArray(params)
                    || !Array.isArray(node.children) || !Array.isArray(node.elseEffects)) {
                    throw new Error(`${id}：效果参数或分支格式无效`);
                }
                for (const field of effectRow.fields) {
                    const value = params[field.key];
                    if (value === undefined || ['status', 'stat', 'powerId'].includes(field.key)) {
                        continue;
                    }
                    if (field.kind === 'enum' && field.options && !field.options.includes(value)
                        || field.kind === 'bool' && typeof value !== 'boolean') {
                        throw new Error(`${id}：${field.label} 参数无效`);
                    }
                }
                if (node.type === BattleEffectTypeEnum.TRANSFORM_CARD
                    && !(buffEffects ? data.cards : cards).some(targetCard => {
                        return Number(targetCard.id) === params.cardId && (buffEffects || Number(targetCard.role) === Number(card.role));
                    })) {
                    throw new Error(`${id}：变化目标必须是当前角色的有效卡牌`);
                }
                if ((node.type === BattleEffectTypeEnum.FORGE || node.type === BattleEffectTypeEnum.GENERATE_CARD && params.cardId)
                    && !(buffEffects ? data.cards : cards).some(targetCard => {
                        return Number(targetCard.id) === params.cardId
                            && (buffEffects || Number(targetCard.role) === Number(card.role))
                            && (node.type !== BattleEffectTypeEnum.FORGE || targetCard.flags.archetype === 'SOVEREIGN_BLADE');
                    })) {
                    throw new Error(`${id}：生成或铸造的目标卡牌不存在、角色不符或不是君王之剑`);
                }
                if ([BattleEffectTypeEnum.DRAW, BattleEffectTypeEnum.GAIN_ENERGY].includes(node.type)) {
                    if (node.target !== 'SELF') {
                        throw new Error(`${id}：抽牌和补充能量效果只支持 SELF`);
                    }
                    const key = node.type === BattleEffectTypeEnum.DRAW ? 'count' : 'amount';
                    const value = params && params[key];
                    if (typeof value === 'number' ? !Number.isSafeInteger(value) || value < 0 : typeof value !== 'string' || !value.trim()) {
                        throw new Error(`${id}：${key} 必须是非负整数或数值表达式`);
                    }
                }
                if ([BattleEffectTypeEnum.APPLY_STATUS, BattleEffectTypeEnum.REMOVE_STATUS, BattleEffectTypeEnum.MULTIPLY_STATUS].includes(node.type)) {
                    if (!params || !buffIds.has(params.status) && !(node.type === BattleEffectTypeEnum.REMOVE_STATUS && params.status === 'ALL')) {
                        throw new Error(id + '：状态编号不在 Buff 表中');
                    }
                }
                if (node.type === BattleEffectTypeEnum.MODIFY_STAT
                    && (!params || !buffIds.has(params.stat) && !['HP', 'MAX_HP', 'BLOCK'].includes(params.stat))) {
                    throw new Error(id + '：属性编号不在 Buff 表中');
                }
                for (const branch of ['children', 'elseEffects']) {
                    if (node[branch]) {
                        inspectEffects(node[branch], depth + 1);
                    }
                }
            }
        };
        inspectEffects(card.effect);
    }
}
// 等待表格读写或输入校验完成，失败信息统一显示到编辑器。
/**
 * @returns {Promise<{revision:string}>}
 */
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
    const original = new Map(data.cards.map(card => {
        return [Number(card.id), card];
    }));
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
            }
            else if (value !== null && sheet.getCell(3, col).value === 'int') {
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

module.exports = { readTables, validateCards, validateBuffRows, validateBuffEffects, saveCards, buffDurations, buffRuleNames, root, Excel, loadWorkbook };

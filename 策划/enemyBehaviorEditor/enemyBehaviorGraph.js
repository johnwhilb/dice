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
/**
 * @returns {BattleEffect}
 */
function prepareEffectNode(node) {
    if (!node || typeof node !== 'object' || !Number.isSafeInteger(node.type) || !effectRows.some(row => row.id === node.type && row.enemyEnabled)) {
        throw new Error('效果节点需要type');
    }
    if (!node.params) {
        node.params = {};
    }
    if (!node.target) {
        node.target = 'SELF';
    }
    if (!node.children) {
        node.children = [];
    }
    if (!node.elseEffects) {
        node.elseEffects = [];
    }
    node.children = node.children.map(prepareEffectNode);
    node.elseEffects = node.elseEffects.map(prepareEffectNode);
    return node;
}
const labels = { SELECTOR: '优先选择', RANDOM: '随机选择', CYCLE: '回合循环', SEQUENCE: '连续行动', CONDITION: '条件判断', ACTION: '执行行动' };
const actions = { ATTACK: '攻击', DEFEND: '防御', BUFF: '强化', DEBUFF: '削弱', HEAL: '治疗', LOSE_HP: '失去生命', REMOVE_BLOCK: '移除格挡', CLEANSE: '净化', DISCARD: '弃牌', EXHAUST: '消耗手牌', ADD_CARD: '塞入卡牌', EFFECTS: '复合效果', WAIT: '等待' };
const fields = { TURN: '当前回合', TURN_MOD: '回合取余', SELF_HP_PERCENT: '敌人生命 %', PLAYER_HP_PERCENT: '玩家生命 %', SELF_BLOCK: '敌人格挡', PLAYER_BLOCK: '玩家格挡', LAST_ACTION: '上回合行动', REPEAT_COUNT: '连续使用次数' };
let buffs = {};
let debuffs = {};
let buffRows = [];
let effectRows = [];
let BattleEffectTypeEnum = {};
const nodeWidth = 228;
const nodeHeight = 106;
let enemies = [];
let revision = '';
let selectedEnemy = 0;
let selectedNodeId = '';
let dirty = false;
let nextNodeId = 1;
let pointerState = null;
let suppressPaletteClick = false;
const looseByEnemy = new Map();
/**
 * @returns {HTMLElement}
 */
const getElementById = id => {
    return document.getElementById(id);
};
/**
 * @returns {string}
 */
const escapeHtml = value => {
    return String(value ?? '').replace(/[&<>"']/g, char => {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]);
    });
};
/**
 * @returns {void}
 */
function showNotice(message, error = false) {
    getElementById('notice').textContent = message;
    getElementById('notice').className = error ? 'error' : 'ok';
}
/**
 * @returns {void}
 */
function markChanges() {
    dirty = true;
    getElementById('save').textContent = '保存到 Excel *';
}
/**
 * @returns {EditorEnemy|undefined}
 */
function getCurrentEnemy() {
    return enemies.find(enemy => {
        return enemy.id === selectedEnemy;
    });
}
/**
 * @returns {EditorBehaviorNode[]}
 */
function getLooseNodes() {
    return looseByEnemy.get(selectedEnemy) || [];
}
/**
 * @returns {void}
 */
function visitTree(node, callback, parent = null) {
    if (!node) {
        return;
    }
    callback(node, parent);
    (node.children || []).forEach(child => {
        return visitTree(child, callback, node);
    });
}
/**
 * @returns {EditorBehaviorNode[]}
 */
function getAllNodes() {
    const nodes = [];
    visitTree(getCurrentEnemy()?.behavior, node => {
        return nodes.push(node);
    });
    getLooseNodes().forEach(node => {
        return visitTree(node, child => {
            return nodes.push(child);
        });
    });
    return nodes;
}
/**
 * @returns {EditorBehaviorNode|undefined}
 */
function getNodeById(id) {
    return getAllNodes().find(node => {
        return node.editorId === id;
    });
}
/**
 * @returns {EditorBehaviorNode|null}
 */
function getParentById(id) {
    let found = null;
    visitTree(getCurrentEnemy()?.behavior, (node, parent) => {
        if (node.editorId === id) {
            found = parent;
        }
    });
    getLooseNodes().forEach(root => {
        return visitTree(root, (node, parent) => {
            if (node.editorId === id) {
                found = parent;
            }
        });
    });
    return found;
}
/**
 * @returns {boolean}
 */
function isLooseRoot(id) {
    return getLooseNodes().some(node => {
        return node.editorId === id;
    });
}
/**
 * @returns {boolean}
 */
function containsNode(root, id) {
    let found = false;
    visitTree(root, node => {
        if (node.editorId === id) {
            found = true;
        }
    });
    return found;
}
/**
 * @returns {void}
 */
function assignEditorData(root, depth = 0, row = { value: 0 }, used = new Set()) {
    if (!root) {
        return;
    }
    const existingId = /^node(\d+)$/.exec(root.editorId || '');
    if (existingId) {
        nextNodeId = Math.max(nextNodeId, Number(existingId[1]) + 1);
    }
    if (!root.editorId || used.has(root.editorId)) {
        root.editorId = `node${nextNodeId++}`;
    }
    used.add(root.editorId);
    if (!Number.isFinite(root.editorX)) {
        root.editorX = 70 + depth * 300;
    }
    if (!Number.isFinite(root.editorY)) {
        root.editorY = 90 + row.value * 155;
    }
    row.value++;
    (root.children || []).forEach(child => {
        return assignEditorData(child, depth + 1, row, used);
    });
}
/**
 * @returns {void}
 */
function prepareEnemy(enemy) {
    assignEditorData(enemy.behavior);
    looseByEnemy.set(enemy.id, []);
}
/**
 * @returns {EditorBehaviorNode}
 */
function makeNode(type, x = 90, y = 90) {
    const node = { type, editorId: `node${nextNodeId++}`, editorX: Math.max(12, Math.round(x)), editorY: Math.max(12, Math.round(y)) };
    if (type === 'ACTION') {
        Object.assign(node, { action: 'ATTACK', amount: 5, hits: 1 });
    }
    else if (type === 'CONDITION') {
        Object.assign(node, { field: 'TURN', operator: '<=', value: 1, children: [] });
    }
    else {
        node.children = [];
    }
    node.weight = 1;
    node.children = Array.isArray(node.children) ? node.children : [];
    return node;
}
/**
 * @returns {void}
 */
function addNode(type, x, y) {
    const enemy = getCurrentEnemy();
    if (!enemy || !labels[type]) {
        return;
    }
    const node = makeNode(type, x, y);
    if (!enemy.behavior) {
        enemy.behavior = node;
    }
    else {
        getLooseNodes().push(node);
    }
    selectedNodeId = node.editorId;
    markChanges();
    renderGraph();
    renderInspector();
    previewIntent();
}
/**
 * @returns {void}
 */
function detachNode(node) {
    const parent = getParentById(node.editorId);
    if (parent) {
        parent.children = parent.children.filter(child => {
            return child !== node;
        });
    }
    else {
        const index = getLooseNodes().indexOf(node);
        if (index >= 0) {
            getLooseNodes().splice(index, 1);
        }
    }
}
/**
 * @returns {void}
 */
function connectNodes(sourceId, targetId) {
    const source = getNodeById(sourceId);
    const target = getNodeById(targetId);
    const enemy = getCurrentEnemy();
    if (!source || !target || !enemy || source === target) {
        return false;
    }
    if (source.type === 'ACTION') {
        showNotice('行动节点不能连接子节点', true);
        return false;
    }
    if (enemy.behavior === target) {
        showNotice('根节点不能作为其他节点的子节点', true);
        return false;
    }
    if (containsNode(target, sourceId)) {
        showNotice('连接会形成循环', true);
        return false;
    }
    if ((source.children || []).includes(target)) {
        return false;
    }
    if (source.type === 'CONDITION' && source.children.length) {
        showNotice('条件节点只能连接一个子节点', true);
        return false;
    }
    detachNode(target);
    source.children.push(target);
    selectedNodeId = targetId;
    markChanges();
    renderGraph();
    renderInspector();
    previewIntent();
    showNotice('已连接节点');
    return true;
}
/**
 * @returns {void}
 */
function disconnectNode(id) {
    const node = getNodeById(id);
    const parent = getParentById(id);
    if (!node || !parent) {
        return;
    }
    detachNode(node);
    getLooseNodes().push(node);
    markChanges();
    renderGraph();
    renderInspector();
    previewIntent();
}
/**
 * @returns {void}
 */
function deleteNode(id) {
    const node = getNodeById(id);
    const enemy = getCurrentEnemy();
    if (!node || !enemy) {
        return;
    }
    if (enemy.behavior === node) {
        if (!confirm('删除根节点及其全部子节点？')) {
            return;
        }
        enemy.behavior = null;
    }
    else {
        detachNode(node);
    }
    selectedNodeId = enemy.behavior?.editorId || '';
    markChanges();
    renderGraph();
    renderInspector();
    previewIntent();
}
/**
 * @returns {void}
 */
function setRoot(id) {
    const node = getNodeById(id);
    const enemy = getCurrentEnemy();
    if (!node || !enemy || enemy.behavior === node) {
        return;
    }
    detachNode(node);
    if (enemy.behavior) {
        getLooseNodes().push(enemy.behavior);
    }
    enemy.behavior = node;
    markChanges();
    renderGraph();
    renderInspector();
    previewIntent();
}
/**
 * @returns {void}
 */
function moveSibling(id, direction) {
    const node = getNodeById(id);
    const parent = getParentById(id);
    if (!node || !parent) {
        return;
    }
    const index = parent.children.indexOf(node);
    const next = index + direction;
    if (next < 0 || next >= parent.children.length) {
        return;
    }
    [parent.children[index], parent.children[next]] = [parent.children[next], parent.children[index]];
    markChanges();
    renderGraph();
    renderInspector();
    previewIntent();
}
/**
 * @returns {void}
 */
function arrangeNodes() {
    const enemy = getCurrentEnemy();
    if (!enemy?.behavior) {
        addNode('SELECTOR', 80, 90);
        return;
    }
    const row = { value: 0 };
    visitTree(enemy.behavior, (node, parent) => {
        node.editorX = parent ? parent.editorX + 300 : 70;
        node.editorY = 90 + row.value * 155;
        row.value++;
    });
    getLooseNodes().forEach(root => {
        visitTree(root, (node, parent) => {
            node.editorX = parent ? parent.editorX + 300 : 70;
            node.editorY = 90 + row.value * 155;
            row.value++;
        });
    });
    markChanges();
    renderGraph();
}
/**
 * @returns {string}
 */
function renderOptions(map, selected) {
    return Object.entries(map).map(([key, name]) => {
        return `<option value="${key}" ${key === selected ? 'selected' : ''}>${name}</option>`;
    }).join('');
}
/**
 * @returns {void}
 */
function renderEnemies() {
    const query = getElementById('search').value.trim().toLowerCase();
    const visible = enemies.filter(enemy => {
        return `${enemy.id} ${enemy.name} ${enemy.title || ''}`.toLowerCase().includes(query);
    });
    getElementById('enemyList').innerHTML = visible.map(enemy => {
        return `<div class="enemy ${enemy.id === selectedEnemy ? 'selected' : ''}" data-enemy="${enemy.id}"><strong>${escapeHtml(enemy.name)}</strong><small>${enemy.id} · ${enemy.originHp} HP</small></div>`;
    }).join('');
    getElementById('count').textContent = `${visible.length} 个敌人`;
}
/**
 * @returns {string}
 */
function describeNode(node) {
    if (node.type === 'ACTION') {
        const name = node.moveName?.trim() || actions[node.action] || node.action;
        if (node.action === 'ATTACK') {
            return `${name} ${node.amount ?? 0} × ${node.hits ?? 1}`;
        }
        if (['DEFEND', 'HEAL', 'LOSE_HP', 'REMOVE_BLOCK'].includes(node.action)) {
            return `${name} ${node.amount ?? 0}`;
        }
        if (['BUFF', 'DEBUFF'].includes(node.action)) {
            return `${name} ${buffRows.find(buff => buff.id === node.status)?.name} ${node.stacks ?? 0}`;
        }
        if (['DISCARD', 'EXHAUST'].includes(node.action)) {
            return `${name} ${node.count ?? 1} 张`;
        }
        if (node.action === 'ADD_CARD') {
            return `${name} ${node.cardId ?? 0} × ${node.count ?? 1} → ${node.pile || 'DISCARD'}`;
        }
        if (node.action === 'EFFECTS') {
            return `${name} ${node.effects?.length || 0} 项`;
        }
        return name;
    }
    if (node.type === 'CONDITION') {
        if (node.field === 'LAST_ACTION') {
            return `${fields[node.field]} ${node.operator || '=='} ${actions[node.actionValue] || node.actionValue}`;
        }
        if (node.field === 'TURN_MOD') {
            return `回合 % ${node.modulus ?? 2} ${node.operator || '=='} ${node.value ?? 0}`;
        }
        return `${fields[node.field] || node.field} ${node.operator || ''} ${node.value ?? 0}`;
    }
    return `${node.children?.length || 0} 个子节点`;
}
/**
 * @returns {string}
 */
function createGraphPath(fromX, fromY, toX, toY) {
    const bend = Math.max(70, Math.abs(toX - fromX) * 0.45);
    return `M ${fromX} ${fromY} C ${fromX + bend} ${fromY}, ${toX - bend} ${toY}, ${toX} ${toY}`;
}
/**
 * @returns {void}
 */
function renderEdges() {
    const stage = getElementById('graphStage');
    const svg = getElementById('graphLinks');
    if (!stage || !svg) {
        return;
    }
    const paths = [];
    /**
 * @returns {void}
 */
    const appendEdges = node => {
        (node.children || []).forEach((child, index) => {
            const path = createGraphPath(node.editorX + nodeWidth, node.editorY + nodeHeight / 2, child.editorX, child.editorY + nodeHeight / 2);
            paths.push(`<path class="graph-edge" d="${path}"></path><text class="graph-edge-label" x="${(node.editorX + nodeWidth + child.editorX) / 2}" y="${(node.editorY + child.editorY) / 2 + nodeHeight / 2 - 9}">${index + 1}</text>`);
        });
    };
    visitTree(getCurrentEnemy()?.behavior, appendEdges);
    getLooseNodes().forEach(node => {
        return visitTree(node, appendEdges);
    });
    svg.innerHTML = paths.join('') + '<path id="draftEdge" class="graph-edge draft" d=""></path>';
}
/**
 * @returns {void}
 */
function renderGraph() {
    const enemy = getCurrentEnemy();
    const nodes = getAllNodes();
    const stage = getElementById('graphStage');
    const maxX = Math.max(1000, ...nodes.map(node => {
        return node.editorX + nodeWidth + 90;
    }));
    const maxY = Math.max(620, ...nodes.map(node => {
        return node.editorY + nodeHeight + 90;
    }));
    stage.style.width = `${maxX}px`;
    stage.style.height = `${maxY}px`;
    getElementById('graphNodes').innerHTML = nodes.map(node => {
        const parent = getParentById(node.editorId);
        const order = parent ? parent.children.indexOf(node) + 1 : 0;
        const root = enemy?.behavior === node;
        const loose = !root && !parent && isLooseRoot(node.editorId);
        const className = `graph-node ${node.type.toLowerCase()} ${selectedNodeId === node.editorId ? 'selected' : ''} ${loose ? 'loose' : ''}`;
        return `<div class="${className}" data-node-id="${node.editorId}" style="left:${node.editorX}px;top:${node.editorY}px">
            <span class="graph-port input" data-input="${node.editorId}" title="拖入连接"></span>
            <div class="graph-node-head" data-drag="${node.editorId}"><span class="graph-kind">${labels[node.type] || node.type}</span><span class="graph-tag">${root ? '根节点' : loose ? '未连接' : `第 ${order} 路`}</span></div>
            <div class="graph-node-summary">${escapeHtml(describeNode(node))}</div>
            <div class="graph-node-foot">${node.type === 'ACTION' ? escapeHtml(node.action || '') : `${node.children?.length || 0} 条输出`}</div>
            <span class="graph-port output" data-output="${node.editorId}" title="拖出连线"></span>
        </div>`;
    }).join('');
    renderEdges();
    getElementById('graphEmpty').hidden = !!nodes.length;
    getElementById('addRoot').textContent = enemy?.behavior ? '自动排列' : '创建根节点';
    getElementById('graphStatus').textContent = `${nodes.length} 个节点 · ${getLooseNodes().length} 个未连接`;
}
/**
 * @returns {void}
 */
function renderInspector() {
    const node = getNodeById(selectedNodeId);
    if (!node) {
        getElementById('inspectorBody').innerHTML = '<p class="hint">选择画布节点，再编辑参数。拖动输出圆点到另一个节点的输入圆点即可建立连接。</p>';
        return;
    }
    const parent = getParentById(node.editorId);
    let html = `<div class="field"><label>节点类型</label><select data-field="type">${renderOptions(labels, node.type)}</select></div>`;
    if (parent?.type === 'RANDOM') {
        html += `<div class="field"><label>随机权重（1–1000）</label><input data-field="weight" type="number" min="1" max="1000" value="${node.weight ?? 1}"></div>`;
    }
    if (node.type === 'ACTION') {
        html += `<div class="field"><label>行动类型</label><select data-field="action">${renderOptions(actions, node.action)}</select></div>`;
        html += `<div class="field"><label>招式名称（意图显示）</label><input data-field="moveName" type="text" maxlength="50" value="${escapeHtml(node.moveName || '')}" placeholder="如：毒刺、蓄力"></div>`;
        if (['ATTACK', 'DEFEND', 'HEAL', 'LOSE_HP', 'REMOVE_BLOCK'].includes(node.action)) {
            html += `<div class="field"><label>${node.action === 'ATTACK' ? '每段伤害' : '数值'}</label><input data-field="amount" type="number" min="0" max="9999" value="${node.amount ?? 0}"></div>`;
        }
        if (node.action === 'ATTACK') {
            html += `<div class="field"><label>攻击次数（1–100）</label><input data-field="hits" type="number" min="1" max="100" value="${node.hits ?? 1}"></div>`;
        }
        if (['BUFF', 'DEBUFF'].includes(node.action)) {
            html += `<div class="field"><label>状态</label><select data-field="status">${renderOptions(node.action === 'BUFF' ? buffs : debuffs, node.status)}</select></div><div class="field"><label>层数</label><input data-field="stacks" type="number" min="1" max="999" value="${node.stacks ?? 1}"></div>`;
            html += `<div class="field"><label>持续范围（duration）</label><select data-field="duration">${renderOptions({ DEFAULT: '默认：减益按回合递减', TURN: '当前回合', NEXT_TURN: '持续到下一回合结束', COMBAT: '整场战斗' }, node.duration || 'DEFAULT')}</select></div>`;
        }
        if (['LOSE_HP', 'REMOVE_BLOCK', 'CLEANSE'].includes(node.action)) {
            html += `<div class="field"><label>目标</label><select data-field="target">${renderOptions({ PLAYER: '玩家', ENEMY: '敌人' }, node.target || (node.action === 'CLEANSE' ? 'ENEMY' : 'PLAYER'))}</select></div>`;
        }
        if (['DISCARD', 'EXHAUST', 'ADD_CARD'].includes(node.action)) {
            html += `<div class="field"><label>张数（1–100）</label><input data-field="count" type="number" min="1" max="100" value="${node.count ?? 1}"></div>`;
        }
        if (node.action === 'ADD_CARD') {
            html += `<div class="field"><label>卡牌 ID</label><input data-field="cardId" type="number" min="1" value="${node.cardId ?? 0}"></div><div class="field"><label>放入牌堆</label><select data-field="pile">${renderOptions({ DRAW: '抽牌堆', DISCARD: '弃牌堆', HAND: '手牌' }, node.pile || 'DISCARD')}</select></div>`;
        }
        if (node.action === 'EFFECTS') {
            html += `<div class="field"><label>效果 JSON 数组</label><textarea data-field="effects" spellcheck="false">${escapeHtml(JSON.stringify(node.effects || [], null, 2))}</textarea><p class="hint">沿用战斗效果格式。目标 ENEMY 指玩家，SELF 指敌人。可组合伤害、护甲、状态、失去生命、变量及触发效果。</p></div>`;
        }
    }
    if (node.type === 'CONDITION') {
        html += `<div class="field"><label>判断字段</label><select data-field="field">${renderOptions(fields, node.field)}</select></div><div class="field"><label>比较符</label><select data-field="operator">${renderOptions({ '<': '小于', '<=': '小于等于', '==': '等于', '!=': '不等于', '>=': '大于等于', '>': '大于' }, node.operator)}</select></div>`;
        if (node.field === 'LAST_ACTION') {
            html += `<div class="field"><label>行动类型</label><select data-field="actionValue">${renderOptions(actions, node.actionValue || 'ATTACK')}</select></div>`;
        }
        else {
            if (node.field === 'TURN_MOD') {
                html += `<div class="field"><label>取余基数</label><input data-field="modulus" type="number" min="1" max="1000" value="${node.modulus ?? 2}"></div>`;
            }
            html += `<div class="field"><label>比较数值</label><input data-field="value" type="number" value="${node.value ?? 0}"></div>`;
        }
    }
    html += '<div class="inspector-actions">';
    if (parent) {
        html += '<button class="btn" data-node-action="up">上移</button><button class="btn" data-node-action="down">下移</button><button class="btn" data-node-action="disconnect">断开连接</button>';
    }
    else if (isLooseRoot(node.editorId)) {
        html += '<button class="btn" data-node-action="root">设为根节点</button>';
    }
    html += '<button class="btn danger" data-node-action="delete">删除节点</button></div>';
    getElementById('inspectorBody').innerHTML = html;
}
/**
 * @returns {void}
 */
function renderEditor() {
    const enemy = getCurrentEnemy();
    renderEnemies();
    getElementById('heading').textContent = enemy ? `${enemy.name} · ${enemy.id}` : '选择敌人';
    getElementById('enemyFields').innerHTML = enemy ? [
        ['id', '敌人 ID', 'number'], ['name', '名称', 'text'], ['title', '称号', 'text'], ['originHp', '初始生命', 'number'], ['info', '描述', 'textarea']
    ].map(([key, label, type]) => {
        return `<div class="field ${key === 'info' ? 'wide' : ''}"><label>${label}</label>${type === 'textarea' ? `<textarea data-enemy-field="${key}">${escapeHtml(enemy[key] || '')}</textarea>` : `<input data-enemy-field="${key}" type="${type}" value="${escapeHtml(enemy[key] ?? '')}">`}</div>`;
    }).join('') : '<p class="hint">请先选择敌人。</p>';
    renderGraph();
    renderInspector();
    getElementById('mechanicsJson').value = JSON.stringify(enemy?.mechanics || { initialStatuses: [], phases: [], triggers: [] }, null, 2);
    getElementById('previewPhase').innerHTML = '<option value="">初始阶段</option>' + (enemy?.mechanics?.phases || []).map((phase) => {
        return `<option value="${escapeHtml(phase.id)}">${escapeHtml(phase.name)}</option>`;
    }).join('');
}
/**
 * @returns {EditorBehaviorNode[]}
 */
function selectActions(node, state, depth = 0) {
    if (!node || depth > 20) {
        return [];
    }
    const children = node.children || [];
    if (node.type === 'ACTION') {
        return [node];
    }
    if (node.type === 'CONDITION') {
        const actual = node.field === 'TURN_MOD' ? state.TURN % Math.max(1, node.modulus || 1)
            : state[node.field] ?? 0;
        const value = node.value ?? 0;
        const pass = node.field === 'LAST_ACTION'
            ? (node.operator === '==' ? actual === node.actionValue : node.operator === '!=' && actual !== node.actionValue)
            : { '<': actual < value, '<=': actual <= value, '==': actual === value, '!=': actual !== value, '>=': actual >= value, '>': actual > value }[node.operator];
        return pass ? selectActions(children[0], state, depth + 1) : [];
    }
    if (node.type === 'SEQUENCE') {
        const result = [];
        for (const child of children) {
            const selected = selectActions(child, state, depth + 1);
            if (!selected.length) {
                return [];
            }
            result.push(...selected);
        }
        return result;
    }
    if (node.type === 'SELECTOR') {
        for (const child of children) {
            const selected = selectActions(child, state, depth + 1);
            if (selected.length) {
                return selected;
            }
        }
    }
    if (node.type === 'CYCLE' && children.length) {
        const offset = Math.max(0, state.TURN - (state.phaseStartTurn || 1));
        return selectActions(children[offset % children.length], state, depth + 1);
    }
    if (node.type === 'RANDOM') {
        const choices = children.map(child => {
            return ({ actions: selectActions(child, state, depth + 1), weight: child.weight ?? 1 });
        })
            .filter(choice => {
            return choice.actions.length && choice.weight > 0;
        });
        let roll = Math.random() * choices.reduce((sum, choice) => {
            return sum + choice.weight;
        }, 0);
        for (const choice of choices) {
            roll -= choice.weight;
            if (roll < 0) {
                return choice.actions;
            }
        }
    }
    return [];
}
/**
 * @returns {void}
 */
function previewIntent() {
    const enemy = getCurrentEnemy();
    if (!enemy) {
        getElementById('intent').textContent = '';
        return;
    }
    const state = {
        TURN: Number(getElementById('previewTurn').value), SELF_HP_PERCENT: Number(getElementById('previewEnemyHp').value),
        PLAYER_HP_PERCENT: Number(getElementById('previewPlayerHp').value), SELF_BLOCK: Number(getElementById('previewEnemyBlock').value),
        PLAYER_BLOCK: Number(getElementById('previewPlayerBlock').value), LAST_ACTION: getElementById('previewLastAction').value,
        REPEAT_COUNT: Number(getElementById('previewRepeatCount').value)
    };
    const phase = (enemy.mechanics?.phases || []).find((entry) => {
        return entry.id === getElementById('previewPhase').value;
    });
    state.phaseStartTurn = phase ? Number(getElementById('previewPhaseStartTurn').value) || 1 : 1;
    const selected = selectActions(phase?.behavior || enemy.behavior, state);
    getElementById('intent').textContent = selected.length ? selected.map(describeNode).join(' + ') : '等待（没有命中任何行动）';
}
/**
 * @returns {void}
 */
function validateNode(node, depth = 0) {
    if (!node || depth > 20) {
        throw new Error('行为树为空或嵌套过深');
    }
    if (node.type === 'ACTION') {
        if (!actions[node.action]) {
            throw new Error('行动类型无效');
        }
        if (['ATTACK', 'DEFEND', 'HEAL', 'LOSE_HP', 'REMOVE_BLOCK'].includes(node.action)
            && (!Number.isSafeInteger(node.amount) || node.amount < 0 || node.amount > 9999)) {
            throw new Error('行动数值须为 0–9999 整数');
        }
        if (node.action === 'ATTACK' && (!Number.isSafeInteger(node.hits) || node.hits < 1 || node.hits > 100)) {
            throw new Error('攻击次数须为 1–100');
        }
        if (['BUFF', 'DEBUFF'].includes(node.action)
            && (!(node.action === 'BUFF' ? buffs : debuffs)[node.status]
                || !Number.isSafeInteger(node.stacks) || node.stacks < 1 || node.stacks > 999)) {
            throw new Error('状态或层数无效');
        }
        if (['DISCARD', 'EXHAUST', 'ADD_CARD'].includes(node.action)
            && (!Number.isSafeInteger(node.count) || node.count < 1 || node.count > 100)) {
            throw new Error('卡牌张数须为 1–100');
        }
        if (node.action === 'ADD_CARD' && (!Number.isSafeInteger(node.cardId) || node.cardId < 1
            || !['DRAW', 'DISCARD', 'HAND'].includes(node.pile))) {
            throw new Error('卡牌 ID 或牌堆无效');
        }
        if (node.action === 'EFFECTS' && (!Array.isArray(node.effects) || !node.effects.length)) {
            throw new Error('复合效果至少需要一项');
        }
        return;
    }
    if (!labels[node.type] || !node.children?.length) {
        throw new Error('分支节点至少需要一条连接');
    }
    if (node.type === 'CONDITION' && (node.children.length !== 1 || !fields[node.field]
        || !['<', '<=', '==', '!=', '>=', '>'].includes(node.operator)
        || (node.field === 'LAST_ACTION' ? !actions[node.actionValue] || !['==', '!='].includes(node.operator)
            : !Number.isFinite(node.value))
        || (node.field === 'TURN_MOD' && (!Number.isSafeInteger(node.modulus) || node.modulus < 1)))) {
        throw new Error('条件配置不完整');
    }
    if (node.type === 'RANDOM' && node.children.some(child => {
        return !Number.isSafeInteger(child.weight ?? 1)
            || (child.weight ?? 1) < 1 || (child.weight ?? 1) > 1000;
    })) {
        throw new Error('随机权重须为 1–1000');
    }
    node.children.forEach(child => {
        return validateNode(child, depth + 1);
    });
}
/** @returns {Promise<void>|void} */
function loadTables() {
    if (dirty && !confirm('未保存的修改将丢失，继续重新读取？')) {
        return;
    }
    return (async () => {
        const response = await fetch('/api/enemies', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error);
        }
        buffRows = data.buffs;
        effectRows = data.effects;
        BattleEffectTypeEnum = Object.fromEntries(effectRows.map(row => [row.type, row.id]));
        buffs = Object.fromEntries(buffRows.filter(buff => {
            return buff.category === 'BUFF';
        }).map(buff => {
            return [buff.id, buff.name];
        }));
        debuffs = Object.fromEntries(buffRows.filter(buff => {
            return buff.category === 'DEBUFF';
        }).map(buff => {
            return [buff.id, buff.name];
        }));
        enemies = data.enemies;
        revision = data.revision;
        looseByEnemy.clear();
        enemies.forEach(prepareEnemy);
        selectedEnemy = enemies.some(enemy => {
            return enemy.id === selectedEnemy;
        }) ? selectedEnemy : enemies[0]?.id || 0;
        selectedNodeId = getCurrentEnemy()?.behavior?.editorId || '';
        dirty = false;
        getElementById('save').textContent = '保存到 Excel';
        getElementById('previewLastAction').innerHTML = '<option value="">无</option>' + renderOptions(actions, '');
        renderEditor();
        previewIntent();
        showNotice('已从 Excel 读取敌人配置');
        getElementById('loadStatus').textContent = `已读取 ${enemies.length} 个敌人 · 5_Enemy.xlsx · 20_BattleBuff.xlsx`;
    })().catch(error => {
        showNotice(`读取失败：${error.message}。请在 enemyBehaviorEditor 文件夹运行 node enemyBehaviorEditorServer.cjs，再打开 http://127.0.0.1:3211/`, true);
        getElementById('loadStatus').textContent = '未连接 Excel 服务';
    });
}
/** @returns {Promise<void>|void} */
function saveExcel() {
    return (async () => {
        const ids = new Set();
        for (const enemy of enemies) {
            if (!Number.isSafeInteger(enemy.id) || enemy.id < 50001 || enemy.id > 59999 || ids.has(enemy.id)
                || !enemy.name?.trim() || !Number.isSafeInteger(enemy.originHp) || enemy.originHp < 1) {
                throw new Error(`${enemy.name || enemy.id} 的 ID、名称或生命无效`);
            }
            if (looseByEnemy.get(enemy.id)?.length) {
                throw new Error(`${enemy.name} 还有未连接节点，请连接或删除后保存`);
            }
            ids.add(enemy.id);
            validateNode(enemy.behavior);
        }
        const response = await fetch('/api/enemies', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision, enemies })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error);
        }
        revision = data.revision;
        dirty = false;
        getElementById('save').textContent = '保存到 Excel';
        showNotice('已保存 5_Enemy.xlsx，并创建 .editor-backup 备份');
    })().catch(error => {
        showNotice(`保存失败：${error.message}`, true);
    });
}
// 等待JSON校验完成后更新编辑状态，并向界面报告错误。
/**
 * @returns {Promise<void>}
 */
async function editNode(field, raw) {
    const node = getNodeById(selectedNodeId);
    if (!node) {
        return;
    }
    if (field === 'type') {
        const children = node.children || [];
        const weight = node.weight;
        const replacement = makeNode(raw, node.editorX, node.editorY);
        Object.keys(node).forEach(key => {
            return delete node[key];
        });
        Object.assign(node, replacement);
        node.editorId = selectedNodeId;
        if (weight) {
            node.weight = weight;
        }
        if (raw !== 'ACTION') {
            node.children = raw === 'CONDITION' ? children.slice(0, 1) : children;
        }
        const detached = raw === 'ACTION' ? children : raw === 'CONDITION' ? children.slice(1) : [];
        getLooseNodes().push(...detached);
    }
    else if (field === 'action') {
        node.action = raw;
        delete node.amount;
        delete node.hits;
        delete node.status;
        delete node.stacks;
        delete node.duration;
        delete node.target;
        delete node.cardId;
        delete node.pile;
        delete node.count;
        delete node.effects;
        if (raw === 'ATTACK') {
            node.amount = 5;
            node.hits = 1;
        }
        else if (['DEFEND', 'HEAL', 'LOSE_HP', 'REMOVE_BLOCK'].includes(raw)) {
            node.amount = 5;
            if (['LOSE_HP', 'REMOVE_BLOCK'].includes(raw)) {
                node.target = 'PLAYER';
            }
        }
        else if (raw === 'BUFF' || raw === 'DEBUFF') {
            const renderOptions = buffRows.filter(buff => {
                return buff.category === (raw === 'DEBUFF' ? 'DEBUFF' : 'BUFF');
            });
            if (!renderOptions.length) {
                throw new Error('Buff表没有该分类的状态');
            }
            node.status = renderOptions[0].id;
            node.duration = 'DEFAULT';
            node.stacks = 1;
        }
        else if (raw === 'CLEANSE') {
            node.target = 'ENEMY';
        }
        else if (['DISCARD', 'EXHAUST', 'ADD_CARD'].includes(raw)) {
            node.count = 1;
            if (raw === 'ADD_CARD') {
                node.cardId = 0;
                node.pile = 'DISCARD';
            }
        }
        else if (raw === 'EFFECTS') {
            const effect = effectRows.find(row => row.id === BattleEffectTypeEnum.DAMAGE);
            node.effects = [{ type: effect.id, target: 'ENEMY', params: structuredClone(effect.defaultParams), children: [], elseEffects: [] }];
        }
    }
    else if (field === 'field') {
        node.field = raw;
        node.operator = raw === 'LAST_ACTION' ? '==' : node.operator || '==';
        node.actionValue = raw === 'LAST_ACTION' ? 'ATTACK' : undefined;
        node.modulus = raw === 'TURN_MOD' ? 2 : undefined;
        node.value = raw === 'TURN_MOD' ? 0 : 1;
    }
    else if (field === 'status') {
        node.status = Number(raw);
    }
    else if (field === 'effects') {
        const valid = await (async () => {
            const effects = JSON.parse(raw);
            if (!Array.isArray(effects)) {
                throw new Error('效果必须是数组');
            }
            node.effects = effects.map(prepareEffectNode);
            return true;
        })().catch(error => {
            showNotice(`效果 JSON 格式错误：${error.message}`, true);
            return false;
        });
        if (!valid) {
            return;
        }
    }
    else {
        node[field] = ['amount', 'hits', 'stacks', 'weight', 'value', 'modulus', 'cardId', 'count'].includes(field) ? Number(raw) : raw;
    }
    markChanges();
    renderGraph();
    renderInspector();
    previewIntent();
}
/**
 * @returns {void}
 */
function addEnemy() {
    const id = Math.max(50000, ...enemies.map(enemy => {
        return enemy.id;
    })) + 1;
    if (id > 59999) {
        showNotice('敌人 ID 已超出范围', true);
        return;
    }
    const enemy = { id, name: '新敌人', title: '', info: '', originHp: 30, behavior: makeNode('ACTION') };
    enemies.push(enemy);
    looseByEnemy.set(id, []);
    selectedEnemy = id;
    selectedNodeId = enemy.behavior.editorId;
    markChanges();
    renderEditor();
    previewIntent();
}
/**
 * @returns {{x:number,y:number}}
 */
function pointOnStage(event) {
    const rect = getElementById('graphStage').getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
/**
 * @returns {void}
 */
function startPointer(event) {
    const output = event.target.closest('[data-output]');
    if (output) {
        const source = getNodeById(output.dataset.output);
        if (source?.type === 'ACTION') {
            showNotice('行动节点不能连接子节点', true);
            return;
        }
        pointerState = { kind: 'connect', sourceId: output.dataset.output };
        event.preventDefault();
        return;
    }
    const drag = event.target.closest('[data-drag],[data-node-id]');
    if (drag) {
        const node = getNodeById(drag.dataset.drag || drag.dataset.nodeId);
        pointerState = { kind: 'move', node, startX: event.clientX, startY: event.clientY,
            nodeX: node.editorX, nodeY: node.editorY, moved: false };
        selectedNodeId = node.editorId;
        renderInspector();
        event.preventDefault();
        return;
    }
    if (event.target === getElementById('graphStage') || event.target === getElementById('graphLinks')) {
        const viewport = getElementById('graphViewport');
        pointerState = { kind: 'pan', startX: event.clientX, startY: event.clientY,
            scrollX: viewport.scrollLeft, scrollY: viewport.scrollTop };
    }
}
/**
 * @returns {void}
 */
function movePointer(event) {
    if (!pointerState) {
        return;
    }
    if (pointerState.kind === 'palette') {
        const ghost = getElementById('paletteGhost');
        ghost.style.left = `${event.clientX + 14}px`;
        ghost.style.top = `${event.clientY + 14}px`;
        pointerState.moved = pointerState.moved || Math.abs(event.clientX - pointerState.startX) > 5
            || Math.abs(event.clientY - pointerState.startY) > 5;
        const rect = getElementById('graphViewport').getBoundingClientRect();
        getElementById('graphViewport').classList.toggle('drop-target', event.clientX >= rect.left && event.clientX <= rect.right
            && event.clientY >= rect.top && event.clientY <= rect.bottom);
    }
    else if (pointerState.kind === 'move') {
        const node = pointerState.node;
        node.editorX = Math.max(8, Math.round(pointerState.nodeX + event.clientX - pointerState.startX));
        node.editorY = Math.max(8, Math.round(pointerState.nodeY + event.clientY - pointerState.startY));
        pointerState.moved = pointerState.moved || Math.abs(event.clientX - pointerState.startX) > 3
            || Math.abs(event.clientY - pointerState.startY) > 3;
        const element = getElementById('graphNodes').querySelector(`[data-node-id="${node.editorId}"]`);
        element.style.left = `${node.editorX}px`;
        element.style.top = `${node.editorY}px`;
        renderEdges();
    }
    else if (pointerState.kind === 'connect') {
        const source = getNodeById(pointerState.sourceId);
        const point = pointOnStage(event);
        getElementById('draftEdge').setAttribute('d', createGraphPath(source.editorX + nodeWidth, source.editorY + nodeHeight / 2, point.x, point.y));
    }
    else {
        const viewport = getElementById('graphViewport');
        viewport.scrollLeft = pointerState.scrollX - (event.clientX - pointerState.startX);
        viewport.scrollTop = pointerState.scrollY - (event.clientY - pointerState.startY);
    }
}
/**
 * @returns {void}
 */
function endPointer(event) {
    if (!pointerState) {
        return;
    }
    const active = pointerState;
    pointerState = null;
    if (active.kind === 'palette') {
        getElementById('paletteGhost').hidden = true;
        getElementById('graphViewport').classList.remove('drop-target');
        if (active.moved) {
            suppressPaletteClick = true;
            setTimeout(() => {
                suppressPaletteClick = false;
            }, 0);
            const rect = getElementById('graphViewport').getBoundingClientRect();
            if (event.clientX >= rect.left && event.clientX <= rect.right
                && event.clientY >= rect.top && event.clientY <= rect.bottom) {
                const point = pointOnStage(event);
                addNode(active.type, point.x - 30, point.y - 30);
            }
        }
    }
    else if (active.kind === 'connect') {
        const input = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-input]');
        if (input) {
            connectNodes(active.sourceId, input.dataset.input);
        }
        else {
            getElementById('draftEdge').setAttribute('d', '');
        }
    }
    else if (active.kind === 'move') {
        if (active.moved) {
            markChanges();
            renderGraph();
        }
        else {
            renderGraph();
        }
    }
}
document.addEventListener('click', event => {
    const enemy = event.target.closest('[data-enemy]');
    if (enemy) {
        selectedEnemy = Number(enemy.dataset.enemy);
        selectedNodeId = getCurrentEnemy()?.behavior?.editorId || '';
        renderEditor();
        previewIntent();
        return;
    }
    const palette = event.target.closest('[data-palette]');
    if (palette) {
        if (suppressPaletteClick) {
            suppressPaletteClick = false;
            return;
        }
        const viewport = getElementById('graphViewport');
        addNode(palette.dataset.palette, viewport.scrollLeft + 100, viewport.scrollTop + 90);
        return;
    }
    const command = event.target.closest('[data-node-action]');
    if (command) {
        const id = selectedNodeId;
        if (command.dataset.nodeAction === 'disconnect') {
            disconnectNode(id);
        }
        else if (command.dataset.nodeAction === 'delete') {
            deleteNode(id);
        }
        else if (command.dataset.nodeAction === 'root') {
            setRoot(id);
        }
        else {
            moveSibling(id, command.dataset.nodeAction === 'up' ? -1 : 1);
        }
        return;
    }
    const node = event.target.closest('[data-node-id]');
    if (node) {
        selectedNodeId = node.dataset.nodeId;
        renderGraph();
        renderInspector();
    }
});
getElementById('graphStage').addEventListener('pointerdown', startPointer);
getElementById('graphPalette').addEventListener('pointerdown', event => {
    const item = event.target.closest('[data-palette]');
    if (!item || !getCurrentEnemy()) {
        return;
    }
    pointerState = { kind: 'palette', type: item.dataset.palette, startX: event.clientX,
        startY: event.clientY, moved: false };
    const ghost = getElementById('paletteGhost');
    ghost.textContent = item.textContent;
    ghost.hidden = false;
    ghost.style.left = `${event.clientX + 14}px`;
    ghost.style.top = `${event.clientY + 14}px`;
    event.preventDefault();
});
window.addEventListener('pointermove', movePointer);
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', event => {
    if (pointerState?.kind === 'palette') {
        getElementById('paletteGhost').hidden = true;
        getElementById('graphViewport').classList.remove('drop-target');
    }
    pointerState = null;
});
getElementById('enemyFields').addEventListener('change', event => {
    const key = event.target.dataset.enemyField;
    if (!key) {
        return;
    }
    const enemy = getCurrentEnemy();
    const previousId = enemy.id;
    enemy[key] = ['id', 'originHp'].includes(key) ? Number(event.target.value) : event.target.value;
    if (key === 'id') {
        looseByEnemy.set(enemy.id, looseByEnemy.get(previousId) || []);
        looseByEnemy.delete(previousId);
        selectedEnemy = enemy.id;
    }
    markChanges();
    renderEditor();
});
getElementById('inspectorBody').addEventListener('change', event => {
    if (event.target.dataset.field) {
        editNode(event.target.dataset.field, event.target.value);
    }
});
getElementById('search').addEventListener('input', renderEnemies);
getElementById('reload').onclick = loadTables;
getElementById('save').onclick = saveExcel;
getElementById('addEnemy').onclick = addEnemy;
getElementById('addRoot').onclick = arrangeNodes;
getElementById('preview').onclick = previewIntent;
getElementById('applyMechanics').onclick = async () => {
    return (async () => {
        const value = JSON.parse(getElementById('mechanicsJson').value);
        if (!value || !Array.isArray(value.initialStatuses) || !Array.isArray(value.phases) || !Array.isArray(value.triggers)) {
            throw new Error('必须包含 initialStatuses、phases 和 triggers 数组');
        }
        getCurrentEnemy().mechanics = value;
        markChanges();
        renderEditor();
        previewIntent();
        showNotice('机制已应用，保存时会校验状态、阶段和行动；阶段树可在此 JSON 中编辑。');
    })().catch(error => {
        showNotice(`机制 JSON 无效：${error.message}`, true);
    });
};
getElementById('copyEnemy').onclick = () => {
    const enemy = getCurrentEnemy();
    if (!enemy) {
        return;
    }
    const id = Math.max(50000, ...enemies.map(item => {
        return item.id;
    })) + 1;
    if (id > 59999) {
        showNotice('敌人 ID 已超出范围', true);
        return;
    }
    const copy = JSON.parse(JSON.stringify(enemy));
    copy.id = id;
    copy.name += '（复制）';
    visitTree(copy.behavior, node => {
        delete node.editorId;
    });
    enemies.push(copy);
    prepareEnemy(copy);
    selectedEnemy = id;
    selectedNodeId = copy.behavior?.editorId || '';
    markChanges();
    renderEditor();
};
getElementById('deleteEnemy').onclick = () => {
    if (enemies.length <= 1 || !getCurrentEnemy() || !confirm(`删除 ${getCurrentEnemy().name}？`)) {
        return;
    }
    looseByEnemy.delete(selectedEnemy);
    enemies = enemies.filter(enemy => {
        return enemy.id !== selectedEnemy;
    });
    selectedEnemy = enemies[0].id;
    selectedNodeId = getCurrentEnemy()?.behavior?.editorId || '';
    markChanges();
    renderEditor();
};
window.addEventListener('beforeunload', event => {
    if (dirty) {
        event.preventDefault();
        event.returnValue = '';
    }
});
loadTables();

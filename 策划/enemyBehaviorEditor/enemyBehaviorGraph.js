const labels = { SELECTOR: '优先选择', RANDOM: '随机选择', CYCLE: '回合循环', SEQUENCE: '连续行动', CONDITION: '条件判断', ACTION: '执行行动' };
const actions = { ATTACK: '攻击', DEFEND: '防御', BUFF: '强化', DEBUFF: '削弱', HEAL: '治疗', LOSE_HP: '失去生命', REMOVE_BLOCK: '移除格挡', CLEANSE: '净化', DISCARD: '弃牌', EXHAUST: '消耗手牌', ADD_CARD: '塞入卡牌', EFFECTS: '复合效果', WAIT: '等待' };
const fields = { TURN: '当前回合', TURN_MOD: '回合取余', SELF_HP_PERCENT: '敌人生命 %', PLAYER_HP_PERCENT: '玩家生命 %', SELF_BLOCK: '敌人格挡', PLAYER_BLOCK: '玩家格挡', LAST_ACTION: '上回合行动', REPEAT_COUNT: '连续使用次数' };
const buffs = { STRENGTH: '力量', DEXTERITY: '敏捷', ARTIFACT: '人工制品', INTANGIBLE: '无实体', THORNS: '荆棘', REGENERATION: '再生', METALLICIZE: '金属化', BARRICADE: '壁垒' };
const debuffs = { WEAK: '虚弱', VULNERABLE: '易伤', FRAIL: '脆弱', POISON: '中毒' };
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
const byId = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function notify(message, error = false) {
    byId('notice').textContent = message;
    byId('notice').className = error ? 'error' : 'ok';
}

function changed() {
    dirty = true;
    byId('save').textContent = '保存到 Excel *';
}

function currentEnemy() {
    return enemies.find(enemy => enemy.id === selectedEnemy);
}

function looseNodes() {
    return looseByEnemy.get(selectedEnemy) || [];
}

function visitTree(node, callback, parent = null) {
    if (!node) {
        return;
    }
    callback(node, parent);
    (node.children || []).forEach(child => visitTree(child, callback, node));
}

function allNodes() {
    const nodes = [];
    visitTree(currentEnemy()?.behavior, node => nodes.push(node));
    looseNodes().forEach(node => visitTree(node, child => nodes.push(child)));
    return nodes;
}

function nodeForId(id) {
    return allNodes().find(node => node.editorId === id);
}

function parentForId(id) {
    let found = null;
    visitTree(currentEnemy()?.behavior, (node, parent) => {
        if (node.editorId === id) {
            found = parent;
        }
    });
    looseNodes().forEach(root => visitTree(root, (node, parent) => {
        if (node.editorId === id) {
            found = parent;
        }
    }));
    return found;
}

function isLooseRoot(id) {
    return looseNodes().some(node => node.editorId === id);
}

function containsNode(root, id) {
    let found = false;
    visitTree(root, node => {
        if (node.editorId === id) {
            found = true;
        }
    });
    return found;
}

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
    (root.children || []).forEach(child => assignEditorData(child, depth + 1, row, used));
}

function prepareEnemy(enemy) {
    assignEditorData(enemy.behavior);
    looseByEnemy.set(enemy.id, []);
}

function makeNode(type, x = 90, y = 90) {
    const node = { type, editorId: `node${nextNodeId++}`, editorX: Math.max(12, Math.round(x)), editorY: Math.max(12, Math.round(y)) };
    if (type === 'ACTION') {
        Object.assign(node, { action: 'ATTACK', amount: 5, hits: 1 });
    } else if (type === 'CONDITION') {
        Object.assign(node, { field: 'TURN', operator: '<=', value: 1, children: [] });
    } else {
        node.children = [];
    }
    return node;
}

function addNode(type, x, y) {
    const enemy = currentEnemy();
    if (!enemy || !labels[type]) {
        return;
    }
    const node = makeNode(type, x, y);
    if (!enemy.behavior) {
        enemy.behavior = node;
    } else {
        looseNodes().push(node);
    }
    selectedNodeId = node.editorId;
    changed();
    renderGraph();
    renderInspector();
    preview();
}

function detachNode(node) {
    const parent = parentForId(node.editorId);
    if (parent) {
        parent.children = parent.children.filter(child => child !== node);
    } else {
        const index = looseNodes().indexOf(node);
        if (index >= 0) {
            looseNodes().splice(index, 1);
        }
    }
}

function connectNodes(sourceId, targetId) {
    const source = nodeForId(sourceId);
    const target = nodeForId(targetId);
    const enemy = currentEnemy();
    if (!source || !target || !enemy || source === target) {
        return false;
    }
    if (source.type === 'ACTION') {
        notify('行动节点不能连接子节点', true);
        return false;
    }
    if (enemy.behavior === target) {
        notify('根节点不能作为其他节点的子节点', true);
        return false;
    }
    if (containsNode(target, sourceId)) {
        notify('连接会形成循环', true);
        return false;
    }
    if ((source.children || []).includes(target)) {
        return false;
    }
    if (source.type === 'CONDITION' && source.children.length) {
        notify('条件节点只能连接一个子节点', true);
        return false;
    }
    detachNode(target);
    source.children.push(target);
    selectedNodeId = targetId;
    changed();
    renderGraph();
    renderInspector();
    preview();
    notify('已连接节点');
    return true;
}

function disconnectNode(id) {
    const node = nodeForId(id);
    const parent = parentForId(id);
    if (!node || !parent) {
        return;
    }
    detachNode(node);
    looseNodes().push(node);
    changed();
    renderGraph();
    renderInspector();
    preview();
}

function deleteNode(id) {
    const node = nodeForId(id);
    const enemy = currentEnemy();
    if (!node || !enemy) {
        return;
    }
    if (enemy.behavior === node) {
        if (!confirm('删除根节点及其全部子节点？')) {
            return;
        }
        enemy.behavior = null;
    } else {
        detachNode(node);
    }
    selectedNodeId = enemy.behavior?.editorId || '';
    changed();
    renderGraph();
    renderInspector();
    preview();
}

function setRoot(id) {
    const node = nodeForId(id);
    const enemy = currentEnemy();
    if (!node || !enemy || enemy.behavior === node) {
        return;
    }
    detachNode(node);
    if (enemy.behavior) {
        looseNodes().push(enemy.behavior);
    }
    enemy.behavior = node;
    changed();
    renderGraph();
    renderInspector();
    preview();
}

function moveSibling(id, direction) {
    const node = nodeForId(id);
    const parent = parentForId(id);
    if (!node || !parent) {
        return;
    }
    const index = parent.children.indexOf(node);
    const next = index + direction;
    if (next < 0 || next >= parent.children.length) {
        return;
    }
    [parent.children[index], parent.children[next]] = [parent.children[next], parent.children[index]];
    changed();
    renderGraph();
    renderInspector();
    preview();
}

function autoLayout() {
    const enemy = currentEnemy();
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
    looseNodes().forEach(root => {
        visitTree(root, (node, parent) => {
            node.editorX = parent ? parent.editorX + 300 : 70;
            node.editorY = 90 + row.value * 155;
            row.value++;
        });
    });
    changed();
    renderGraph();
}

function options(map, selected) {
    return Object.entries(map).map(([key, name]) => `<option value="${key}" ${key === selected ? 'selected' : ''}>${name}</option>`).join('');
}

function renderEnemies() {
    const query = byId('search').value.trim().toLowerCase();
    const visible = enemies.filter(enemy => `${enemy.id} ${enemy.name} ${enemy.title || ''}`.toLowerCase().includes(query));
    byId('enemyList').innerHTML = visible.map(enemy => `<div class="enemy ${enemy.id === selectedEnemy ? 'selected' : ''}" data-enemy="${enemy.id}"><strong>${escapeHtml(enemy.name)}</strong><small>${enemy.id} · ${enemy.originHp} HP</small></div>`).join('');
    byId('count').textContent = `${visible.length} 个敌人`;
}

function summary(node) {
    if (node.type === 'ACTION') {
        const name = node.moveName?.trim() || actions[node.action] || node.action;
        if (node.action === 'ATTACK') {
            return `${name} ${node.amount ?? 0} × ${node.hits ?? 1}`;
        }
        if (['DEFEND', 'HEAL', 'LOSE_HP', 'REMOVE_BLOCK'].includes(node.action)) {
            return `${name} ${node.amount ?? 0}`;
        }
        if (['BUFF', 'DEBUFF'].includes(node.action)) {
            return `${name} ${node.status || ''} ${node.stacks ?? 0}`;
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

function graphPath(fromX, fromY, toX, toY) {
    const bend = Math.max(70, Math.abs(toX - fromX) * 0.45);
    return `M ${fromX} ${fromY} C ${fromX + bend} ${fromY}, ${toX - bend} ${toY}, ${toX} ${toY}`;
}

function renderEdges() {
    const stage = byId('graphStage');
    const svg = byId('graphLinks');
    if (!stage || !svg) {
        return;
    }
    const paths = [];
    const appendEdges = node => {
        (node.children || []).forEach((child, index) => {
            const path = graphPath(node.editorX + nodeWidth, node.editorY + nodeHeight / 2,
                child.editorX, child.editorY + nodeHeight / 2);
            paths.push(`<path class="graph-edge" d="${path}"></path><text class="graph-edge-label" x="${(node.editorX + nodeWidth + child.editorX) / 2}" y="${(node.editorY + child.editorY) / 2 + nodeHeight / 2 - 9}">${index + 1}</text>`);
        });
    };
    visitTree(currentEnemy()?.behavior, appendEdges);
    looseNodes().forEach(node => visitTree(node, appendEdges));
    svg.innerHTML = paths.join('') + '<path id="draftEdge" class="graph-edge draft" d=""></path>';
}

function renderGraph() {
    const enemy = currentEnemy();
    const nodes = allNodes();
    const stage = byId('graphStage');
    const maxX = Math.max(1000, ...nodes.map(node => node.editorX + nodeWidth + 90));
    const maxY = Math.max(620, ...nodes.map(node => node.editorY + nodeHeight + 90));
    stage.style.width = `${maxX}px`;
    stage.style.height = `${maxY}px`;
    byId('graphNodes').innerHTML = nodes.map(node => {
        const parent = parentForId(node.editorId);
        const order = parent ? parent.children.indexOf(node) + 1 : 0;
        const root = enemy?.behavior === node;
        const loose = !root && !parent && isLooseRoot(node.editorId);
        const className = `graph-node ${node.type.toLowerCase()} ${selectedNodeId === node.editorId ? 'selected' : ''} ${loose ? 'loose' : ''}`;
        return `<div class="${className}" data-node-id="${node.editorId}" style="left:${node.editorX}px;top:${node.editorY}px">
            <span class="graph-port input" data-input="${node.editorId}" title="拖入连接"></span>
            <div class="graph-node-head" data-drag="${node.editorId}"><span class="graph-kind">${labels[node.type] || node.type}</span><span class="graph-tag">${root ? '根节点' : loose ? '未连接' : `第 ${order} 路`}</span></div>
            <div class="graph-node-summary">${escapeHtml(summary(node))}</div>
            <div class="graph-node-foot">${node.type === 'ACTION' ? escapeHtml(node.action || '') : `${node.children?.length || 0} 条输出`}</div>
            <span class="graph-port output" data-output="${node.editorId}" title="拖出连线"></span>
        </div>`;
    }).join('');
    renderEdges();
    byId('graphEmpty').hidden = !!nodes.length;
    byId('addRoot').textContent = enemy?.behavior ? '自动排列' : '创建根节点';
    byId('graphStatus').textContent = `${nodes.length} 个节点 · ${looseNodes().length} 个未连接`;
}

function renderInspector() {
    const node = nodeForId(selectedNodeId);
    if (!node) {
        byId('inspectorBody').innerHTML = '<p class="hint">选择画布节点，再编辑参数。拖动输出圆点到另一个节点的输入圆点即可建立连接。</p>';
        return;
    }
    const parent = parentForId(node.editorId);
    let html = `<div class="field"><label>节点类型</label><select data-field="type">${options(labels, node.type)}</select></div>`;
    if (parent?.type === 'RANDOM') {
        html += `<div class="field"><label>随机权重（1–1000）</label><input data-field="weight" type="number" min="1" max="1000" value="${node.weight ?? 1}"></div>`;
    }
    if (node.type === 'ACTION') {
        html += `<div class="field"><label>行动类型</label><select data-field="action">${options(actions, node.action)}</select></div>`;
        html += `<div class="field"><label>招式名称（意图显示）</label><input data-field="moveName" type="text" maxlength="50" value="${escapeHtml(node.moveName || '')}" placeholder="如：毒刺、蓄力"></div>`;
        if (['ATTACK', 'DEFEND', 'HEAL', 'LOSE_HP', 'REMOVE_BLOCK'].includes(node.action)) {
            html += `<div class="field"><label>${node.action === 'ATTACK' ? '每段伤害' : '数值'}</label><input data-field="amount" type="number" min="0" max="9999" value="${node.amount ?? 0}"></div>`;
        }
        if (node.action === 'ATTACK') {
            html += `<div class="field"><label>攻击次数（1–100）</label><input data-field="hits" type="number" min="1" max="100" value="${node.hits ?? 1}"></div>`;
        }
        if (['BUFF', 'DEBUFF'].includes(node.action)) {
            html += `<div class="field"><label>状态</label><select data-field="status">${options(node.action === 'BUFF' ? buffs : debuffs, node.status)}</select></div><div class="field"><label>层数</label><input data-field="stacks" type="number" min="1" max="999" value="${node.stacks ?? 1}"></div>`;
        }
        if (['LOSE_HP', 'REMOVE_BLOCK', 'CLEANSE'].includes(node.action)) {
            html += `<div class="field"><label>目标</label><select data-field="target">${options({ PLAYER: '玩家', ENEMY: '敌人' }, node.target || (node.action === 'CLEANSE' ? 'ENEMY' : 'PLAYER'))}</select></div>`;
        }
        if (['DISCARD', 'EXHAUST', 'ADD_CARD'].includes(node.action)) {
            html += `<div class="field"><label>张数（1–100）</label><input data-field="count" type="number" min="1" max="100" value="${node.count ?? 1}"></div>`;
        }
        if (node.action === 'ADD_CARD') {
            html += `<div class="field"><label>卡牌 ID</label><input data-field="cardId" type="number" min="1" value="${node.cardId ?? 0}"></div><div class="field"><label>放入牌堆</label><select data-field="pile">${options({ DRAW: '抽牌堆', DISCARD: '弃牌堆', HAND: '手牌' }, node.pile || 'DISCARD')}</select></div>`;
        }
        if (node.action === 'EFFECTS') {
            html += `<div class="field"><label>效果 JSON 数组</label><textarea data-field="effects" spellcheck="false">${escapeHtml(JSON.stringify(node.effects || [], null, 2))}</textarea><p class="hint">沿用战斗效果格式。目标 ENEMY 指玩家，SELF 指敌人。可组合伤害、护甲、状态、失去生命、变量及触发效果。</p></div>`;
        }
    }
    if (node.type === 'CONDITION') {
        html += `<div class="field"><label>判断字段</label><select data-field="field">${options(fields, node.field)}</select></div><div class="field"><label>比较符</label><select data-field="operator">${options({ '<': '小于', '<=': '小于等于', '==': '等于', '!=': '不等于', '>=': '大于等于', '>': '大于' }, node.operator)}</select></div>`;
        if (node.field === 'LAST_ACTION') {
            html += `<div class="field"><label>行动类型</label><select data-field="actionValue">${options(actions, node.actionValue || 'ATTACK')}</select></div>`;
        } else {
            if (node.field === 'TURN_MOD') {
                html += `<div class="field"><label>取余基数</label><input data-field="modulus" type="number" min="1" max="1000" value="${node.modulus ?? 2}"></div>`;
            }
            html += `<div class="field"><label>比较数值</label><input data-field="value" type="number" value="${node.value ?? 0}"></div>`;
        }
    }
    html += '<div class="inspector-actions">';
    if (parent) {
        html += '<button class="btn" data-node-action="up">上移</button><button class="btn" data-node-action="down">下移</button><button class="btn" data-node-action="disconnect">断开连接</button>';
    } else if (isLooseRoot(node.editorId)) {
        html += '<button class="btn" data-node-action="root">设为根节点</button>';
    }
    html += '<button class="btn danger" data-node-action="delete">删除节点</button></div>';
    byId('inspectorBody').innerHTML = html;
}

function render() {
    const enemy = currentEnemy();
    renderEnemies();
    byId('heading').textContent = enemy ? `${enemy.name} · ${enemy.id}` : '选择敌人';
    byId('enemyFields').innerHTML = enemy ? [
        ['id', '敌人 ID', 'number'], ['name', '名称', 'text'], ['title', '称号', 'text'], ['originHp', '初始生命', 'number'], ['info', '描述', 'textarea']
    ].map(([key, label, type]) => `<div class="field ${key === 'info' ? 'wide' : ''}"><label>${label}</label>${type === 'textarea' ? `<textarea data-enemy-field="${key}">${escapeHtml(enemy[key] || '')}</textarea>` : `<input data-enemy-field="${key}" type="${type}" value="${escapeHtml(enemy[key] ?? '')}">`}</div>`).join('') : '<p class="hint">请先选择敌人。</p>';
    renderGraph();
    renderInspector();
}

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
        return selectActions(children[(state.TURN - 1) % children.length], state, depth + 1);
    }
    if (node.type === 'RANDOM') {
        const choices = children.map(child => ({ actions: selectActions(child, state, depth + 1), weight: child.weight ?? 1 }))
            .filter(choice => choice.actions.length && choice.weight > 0);
        let roll = Math.random() * choices.reduce((sum, choice) => sum + choice.weight, 0);
        for (const choice of choices) {
            roll -= choice.weight;
            if (roll < 0) {
                return choice.actions;
            }
        }
    }
    return [];
}

function preview() {
    const enemy = currentEnemy();
    if (!enemy) {
        byId('intent').textContent = '';
        return;
    }
    const state = {
        TURN: Number(byId('previewTurn').value), SELF_HP_PERCENT: Number(byId('previewEnemyHp').value),
        PLAYER_HP_PERCENT: Number(byId('previewPlayerHp').value), SELF_BLOCK: Number(byId('previewEnemyBlock').value),
        PLAYER_BLOCK: Number(byId('previewPlayerBlock').value), LAST_ACTION: byId('previewLastAction').value,
        REPEAT_COUNT: Number(byId('previewRepeatCount').value)
    };
    const selected = selectActions(enemy.behavior, state);
    byId('intent').textContent = selected.length ? selected.map(summary).join(' + ') : '等待（没有命中任何行动）';
}

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
    if (node.type === 'RANDOM' && node.children.some(child => !Number.isSafeInteger(child.weight ?? 1)
        || (child.weight ?? 1) < 1 || (child.weight ?? 1) > 1000)) {
        throw new Error('随机权重须为 1–1000');
    }
    node.children.forEach(child => validateNode(child, depth + 1));
}

async function load() {
    if (dirty && !confirm('未保存的修改将丢失，继续重新读取？')) {
        return;
    }
    try {
        const response = await fetch('/api/enemies', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error);
        }
        enemies = data.enemies;
        revision = data.revision;
        looseByEnemy.clear();
        enemies.forEach(prepareEnemy);
        selectedEnemy = enemies.some(enemy => enemy.id === selectedEnemy) ? selectedEnemy : enemies[0]?.id || 0;
        selectedNodeId = currentEnemy()?.behavior?.editorId || '';
        dirty = false;
        byId('save').textContent = '保存到 Excel';
        byId('previewLastAction').innerHTML = '<option value="">无</option>' + options(actions, '');
        render();
        preview();
        notify('已从 Excel 读取敌人配置');
        byId('loadStatus').textContent = `已读取 ${enemies.length} 个敌人 · 5_Enemy.xlsx`;
    } catch (error) {
        notify(`读取失败：${error.message}。请在 enemyBehaviorEditor 文件夹运行 node enemyBehaviorEditorServer.cjs，再打开 http://127.0.0.1:3211/`, true);
        byId('loadStatus').textContent = '未连接 Excel 服务';
    }
}

async function save() {
    try {
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
        byId('save').textContent = '保存到 Excel';
        notify('已保存 5_Enemy.xlsx，并创建 .editor-backup 备份');
    } catch (error) {
        notify(`保存失败：${error.message}`, true);
    }
}

function editNode(field, raw) {
    const node = nodeForId(selectedNodeId);
    if (!node) {
        return;
    }
    if (field === 'type') {
        const children = node.children || [];
        const weight = node.weight;
        const replacement = makeNode(raw, node.editorX, node.editorY);
        Object.keys(node).forEach(key => delete node[key]);
        Object.assign(node, replacement);
        node.editorId = selectedNodeId;
        if (weight) {
            node.weight = weight;
        }
        if (raw !== 'ACTION') {
            node.children = raw === 'CONDITION' ? children.slice(0, 1) : children;
        }
        const detached = raw === 'ACTION' ? children : raw === 'CONDITION' ? children.slice(1) : [];
        looseNodes().push(...detached);
    } else if (field === 'action') {
        node.action = raw;
        delete node.amount;
        delete node.hits;
        delete node.status;
        delete node.stacks;
        delete node.target;
        delete node.cardId;
        delete node.pile;
        delete node.count;
        delete node.effects;
        if (raw === 'ATTACK') {
            node.amount = 5;
            node.hits = 1;
        } else if (['DEFEND', 'HEAL', 'LOSE_HP', 'REMOVE_BLOCK'].includes(raw)) {
            node.amount = 5;
            if (['LOSE_HP', 'REMOVE_BLOCK'].includes(raw)) {
                node.target = 'PLAYER';
            }
        } else if (raw === 'BUFF' || raw === 'DEBUFF') {
            node.status = raw === 'BUFF' ? 'STRENGTH' : 'WEAK';
            node.stacks = 1;
        } else if (raw === 'CLEANSE') {
            node.target = 'ENEMY';
        } else if (['DISCARD', 'EXHAUST', 'ADD_CARD'].includes(raw)) {
            node.count = 1;
            if (raw === 'ADD_CARD') {
                node.cardId = 0;
                node.pile = 'DISCARD';
            }
        } else if (raw === 'EFFECTS') {
            node.effects = [{ type: 'DAMAGE', target: 'ENEMY', params: { amount: 5, hits: 1 } }];
        }
    } else if (field === 'field') {
        node.field = raw;
        node.operator = raw === 'LAST_ACTION' ? '==' : node.operator || '==';
        node.actionValue = raw === 'LAST_ACTION' ? 'ATTACK' : undefined;
        node.modulus = raw === 'TURN_MOD' ? 2 : undefined;
        node.value = raw === 'TURN_MOD' ? 0 : 1;
    } else if (field === 'effects') {
        try {
            node.effects = JSON.parse(raw);
        } catch (error) {
            notify(`效果 JSON 格式错误：${error.message}`, true);
            return;
        }
    } else {
        node[field] = ['amount', 'hits', 'stacks', 'weight', 'value', 'modulus', 'cardId', 'count'].includes(field) ? Number(raw) : raw;
    }
    changed();
    renderGraph();
    renderInspector();
    preview();
}

function addEnemy() {
    const id = Math.max(50000, ...enemies.map(enemy => enemy.id)) + 1;
    if (id > 59999) {
        notify('敌人 ID 已超出范围', true);
        return;
    }
    const enemy = { id, name: '新敌人', title: '', info: '', originHp: 30, behavior: makeNode('ACTION') };
    enemies.push(enemy);
    looseByEnemy.set(id, []);
    selectedEnemy = id;
    selectedNodeId = enemy.behavior.editorId;
    changed();
    render();
    preview();
}

function pointOnStage(event) {
    const rect = byId('graphStage').getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function startPointer(event) {
    const output = event.target.closest('[data-output]');
    if (output) {
        const source = nodeForId(output.dataset.output);
        if (source?.type === 'ACTION') {
            notify('行动节点不能连接子节点', true);
            return;
        }
        pointerState = { kind: 'connect', sourceId: output.dataset.output };
        event.preventDefault();
        return;
    }
    const drag = event.target.closest('[data-drag],[data-node-id]');
    if (drag) {
        const node = nodeForId(drag.dataset.drag || drag.dataset.nodeId);
        pointerState = { kind: 'move', node, startX: event.clientX, startY: event.clientY,
            nodeX: node.editorX, nodeY: node.editorY, moved: false };
        selectedNodeId = node.editorId;
        renderInspector();
        event.preventDefault();
        return;
    }
    if (event.target === byId('graphStage') || event.target === byId('graphLinks')) {
        const viewport = byId('graphViewport');
        pointerState = { kind: 'pan', startX: event.clientX, startY: event.clientY,
            scrollX: viewport.scrollLeft, scrollY: viewport.scrollTop };
    }
}

function movePointer(event) {
    if (!pointerState) {
        return;
    }
    if (pointerState.kind === 'palette') {
        const ghost = byId('paletteGhost');
        ghost.style.left = `${event.clientX + 14}px`;
        ghost.style.top = `${event.clientY + 14}px`;
        pointerState.moved = pointerState.moved || Math.abs(event.clientX - pointerState.startX) > 5
            || Math.abs(event.clientY - pointerState.startY) > 5;
        const rect = byId('graphViewport').getBoundingClientRect();
        byId('graphViewport').classList.toggle('drop-target', event.clientX >= rect.left && event.clientX <= rect.right
            && event.clientY >= rect.top && event.clientY <= rect.bottom);
    } else if (pointerState.kind === 'move') {
        const node = pointerState.node;
        node.editorX = Math.max(8, Math.round(pointerState.nodeX + event.clientX - pointerState.startX));
        node.editorY = Math.max(8, Math.round(pointerState.nodeY + event.clientY - pointerState.startY));
        pointerState.moved = pointerState.moved || Math.abs(event.clientX - pointerState.startX) > 3
            || Math.abs(event.clientY - pointerState.startY) > 3;
        const element = byId('graphNodes').querySelector(`[data-node-id="${node.editorId}"]`);
        element.style.left = `${node.editorX}px`;
        element.style.top = `${node.editorY}px`;
        renderEdges();
    } else if (pointerState.kind === 'connect') {
        const source = nodeForId(pointerState.sourceId);
        const point = pointOnStage(event);
        byId('draftEdge').setAttribute('d', graphPath(source.editorX + nodeWidth,
            source.editorY + nodeHeight / 2, point.x, point.y));
    } else {
        const viewport = byId('graphViewport');
        viewport.scrollLeft = pointerState.scrollX - (event.clientX - pointerState.startX);
        viewport.scrollTop = pointerState.scrollY - (event.clientY - pointerState.startY);
    }
}

function endPointer(event) {
    if (!pointerState) {
        return;
    }
    const active = pointerState;
    pointerState = null;
    if (active.kind === 'palette') {
        byId('paletteGhost').hidden = true;
        byId('graphViewport').classList.remove('drop-target');
        if (active.moved) {
            suppressPaletteClick = true;
            setTimeout(() => {
                suppressPaletteClick = false;
            }, 0);
            const rect = byId('graphViewport').getBoundingClientRect();
            if (event.clientX >= rect.left && event.clientX <= rect.right
                && event.clientY >= rect.top && event.clientY <= rect.bottom) {
                const point = pointOnStage(event);
                addNode(active.type, point.x - 30, point.y - 30);
            }
        }
    } else if (active.kind === 'connect') {
        const input = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-input]');
        if (input) {
            connectNodes(active.sourceId, input.dataset.input);
        } else {
            byId('draftEdge').setAttribute('d', '');
        }
    } else if (active.kind === 'move') {
        if (active.moved) {
            changed();
            renderGraph();
        } else {
            renderGraph();
        }
    }
}

document.addEventListener('click', event => {
    const enemy = event.target.closest('[data-enemy]');
    if (enemy) {
        selectedEnemy = Number(enemy.dataset.enemy);
        selectedNodeId = currentEnemy()?.behavior?.editorId || '';
        render();
        preview();
        return;
    }
    const palette = event.target.closest('[data-palette]');
    if (palette) {
        if (suppressPaletteClick) {
            suppressPaletteClick = false;
            return;
        }
        const viewport = byId('graphViewport');
        addNode(palette.dataset.palette, viewport.scrollLeft + 100, viewport.scrollTop + 90);
        return;
    }
    const command = event.target.closest('[data-node-action]');
    if (command) {
        const id = selectedNodeId;
        if (command.dataset.nodeAction === 'disconnect') {
            disconnectNode(id);
        } else if (command.dataset.nodeAction === 'delete') {
            deleteNode(id);
        } else if (command.dataset.nodeAction === 'root') {
            setRoot(id);
        } else {
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

byId('graphStage').addEventListener('pointerdown', startPointer);
byId('graphPalette').addEventListener('pointerdown', event => {
    const item = event.target.closest('[data-palette]');
    if (!item || !currentEnemy()) {
        return;
    }
    pointerState = { kind: 'palette', type: item.dataset.palette, startX: event.clientX,
        startY: event.clientY, moved: false };
    const ghost = byId('paletteGhost');
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
        byId('paletteGhost').hidden = true;
        byId('graphViewport').classList.remove('drop-target');
    }
    pointerState = null;
});
byId('enemyFields').addEventListener('change', event => {
    const key = event.target.dataset.enemyField;
    if (!key) {
        return;
    }
    const enemy = currentEnemy();
    const previousId = enemy.id;
    enemy[key] = ['id', 'originHp'].includes(key) ? Number(event.target.value) : event.target.value;
    if (key === 'id') {
        looseByEnemy.set(enemy.id, looseByEnemy.get(previousId) || []);
        looseByEnemy.delete(previousId);
        selectedEnemy = enemy.id;
    }
    changed();
    render();
});
byId('inspectorBody').addEventListener('change', event => {
    if (event.target.dataset.field) {
        editNode(event.target.dataset.field, event.target.value);
    }
});
byId('search').addEventListener('input', renderEnemies);
byId('reload').onclick = load;
byId('save').onclick = save;
byId('addEnemy').onclick = addEnemy;
byId('addRoot').onclick = autoLayout;
byId('preview').onclick = preview;
byId('copyEnemy').onclick = () => {
    const enemy = currentEnemy();
    if (!enemy) {
        return;
    }
    const id = Math.max(50000, ...enemies.map(item => item.id)) + 1;
    if (id > 59999) {
        notify('敌人 ID 已超出范围', true);
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
    changed();
    render();
};
byId('deleteEnemy').onclick = () => {
    if (enemies.length <= 1 || !currentEnemy() || !confirm(`删除 ${currentEnemy().name}？`)) {
        return;
    }
    looseByEnemy.delete(selectedEnemy);
    enemies = enemies.filter(enemy => enemy.id !== selectedEnemy);
    selectedEnemy = enemies[0].id;
    selectedNodeId = currentEnemy()?.behavior?.editorId || '';
    changed();
    render();
};
window.addEventListener('beforeunload', event => {
    if (dirty) {
        event.preventDefault();
        event.returnValue = '';
    }
});
load();

'use strict';
let data = { equipments: [], types: [], catalog: {}, revision: '', fields: [] };
let currentId = 0;
let dirty = false;
let pendingJson = false;
let saving = false;
const typeNames = { Component: '合成材料', Weapon: '武器', Armor: '护甲' };
const help = {
    id: ['编号（id）', '装备编号为190001～199999，新增和复制时自动分配。编号作为合成引用的主键，已有编号不可在界面中直接修改。'],
    type: ['装备类型（type）', 'Component：合成材料。\nWeapon：武器。\nArmor：护甲。\n这里只编辑装备类型，装备槽数量及装备生效逻辑由游戏运行时代码决定。'],
    price: ['价格（price）', '整数金币价格，最小为0。编辑器不会自动根据效果重新定价。'],
    effectDes: ['效果描述（effectDes）', '用于向玩家说明装备效果。它不会自动转换成 effect，修改描述后需要另外编辑效果节点，使文字和配置一致。'],
    des: ['装备描述（des）', '装备背景、故事或外观说明，与实际效果配置分开存储。'],
    combine: ['合成配方（combine）', '不可合成时保存 []。\n可合成时保存 [材料一编号,材料二编号]。\n两个材料可以相同，表示需要两件同种材料。\n不允许引用自己、引用已删除的装备，或形成循环合成。被其他配方使用的装备须先解除引用再删除。'],
    effect: ['装备效果（effect）', '效果是数组，按顺序执行，格式沿用卡牌和道具的 BattleEffect。\nSELF：持有装备的玩家。ENEMY：唯一敌人。\nSEQUENCE：顺序执行子效果。REPEAT：重复执行。IF：条件成立执行 children，否则执行 elseEffects。\nREGISTER_TRIGGER：注册事件，事件发生后执行 children；事件参数中可选战斗开始、回合开始、出牌、受伤等。\nSCHEDULE：延迟到指定时机执行。\n战斗开始时会读取 PlayerModel.equipmentIds，注册装备效果。使用 PlayerBll.addEquipment/removeEquipment 穿戴与卸下，生命上限同步计入冒险属性。装备获取与合成界面单独接入这些接口。'],
    json: ['完整效果 JSON', '支持完整嵌套效果数组，参数字段使用 camelCase，例如 damageKind、ignoreBlock。\n请先应用 JSON 再切换装备。保存时也会自动检查并应用编辑框中尚未应用的 JSON。\n没有效果时使用 []。'],
    condition: ['触发条件（condition）', '简单条件：{"lhs":"@self.hp","cmp":"<=","rhs":30}。\n组合条件：{"op":"AND","rules":[简单条件]}，op 也可为 OR。\n支持 ==、!=、>、>=、<、<=。\n留空表示无条件。IF 的条件决定执行 children 或 elseEffects。其他效果的条件决定是否执行该效果。'],
    expression: ['数值与表达式', '可以填写数值或表达式。\n例如：@self.hp、@self.maxHp、@target.block、@self.buff.STRENGTH。\n支持加减乘除和 min、max、floor、ceil、round、abs。\nSELF/TARGET 的取值由实际效果执行上下文确定。\n@self.turn：当前回合。@event.cardCount / attackCount：本回合出牌 / 攻击牌次数。@event.requiredDiceCount：卡牌配置需要的骰子数；diceCount：实际消耗数量。@event.spent：本次实际消耗能量；current / previous：变化后 / 前的能量。@event.amount：实际生命损失，damage：格挡前伤害。\n装备变量会按穿戴槽隔离，TURN 每回合重置、COMBAT 每场重置。']
};
const get = id => {
    return document.getElementById(id);
};
const escape = value => {
    return String(value ?? '').replace(/[&<>"']/g, character => {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
};
const clone = value => {
    return JSON.parse(JSON.stringify(value));
};
const current = () => {
    return data.equipments.find(record => record.id === currentId);
};
function status(message, error = false) {
    get('status').textContent = message;
    get('status').classList.toggle('error', error);
}
function changed() {
    dirty = true;
    status('存在未保存修改，请保存到表格或导出备份。');
}
function openHelp(title, text) {
    get('helpTitle').textContent = title;
    get('helpBody').textContent = text;
    get('helpDialog').showModal();
}
function optionsHtml(selected) {
    return Object.values(data.catalog).map(entry => {
        return `<option value="${entry.type}" ${entry.type === selected ? 'selected' : ''}>${escape(entry.label)}（${entry.type}）</option>`;
    }).join('');
}
function makeEffect(type) {
    const entry = data.catalog[type];
    const effect = { type, target: 'SELF', params: clone(entry.defaults) };
    if (entry.container) {
        effect.children = [];
    }
    if (type === 'IF') {
        effect.condition = { lhs: '@self.hp', cmp: '<=', rhs: 30 };
        effect.elseEffects = [];
    }
    return effect;
}
function atPath(path) {
    return path ? path.split('.').reduce((value, key) => value[key], current().effect) : current().effect;
}
function syncJson() {
    get('effectJson').value = JSON.stringify(current()?.effect || [], null, 2);
    pendingJson = false;
}
function applyJson() {
    try {
        const effects = JSON.parse(get('effectJson').value);
        validateEffects(effects);
        current().effect = effects;
        pendingJson = false;
        changed();
        renderEffects();
        return true;
    }
    catch (error) {
        status('效果 JSON 无效：' + error.message, true);
        return false;
    }
}
function settleJson() {
    return !pendingJson || applyJson();
}
function validateEffects(effects, depth = 0) {
    if (!Array.isArray(effects) || depth > 20) {
        throw new Error('效果必须为数组，最多嵌套20层');
    }
    for (const effect of effects) {
        if (!effect || !data.catalog[effect.type] || !['SELF', 'ENEMY'].includes(effect.target)
            || !effect.params || typeof effect.params !== 'object' || Array.isArray(effect.params)) {
            throw new Error('类型、目标或 params 无效');
        }
        for (const branch of ['children', 'elseEffects']) {
            if (Object.prototype.hasOwnProperty.call(effect, branch)) {
                validateEffects(effect[branch], depth + 1);
            }
        }
    }
}
function renderList() {
    const query = get('search').value.trim().toLowerCase();
    const filter = get('filterType').value;
    const records = data.equipments.filter(record => {
        return (!filter || record.type === filter)
            && `${record.id} ${record.name} ${record.des} ${record.effectDes}`.toLowerCase().includes(query);
    });
    get('count').textContent = `显示 ${records.length} / 共 ${data.equipments.length} 件装备${dirty ? ' · 未保存' : ''}`;
    get('equipmentList').innerHTML = records.map(record => {
        return `<button data-id="${record.id}" class="${record.id === currentId ? 'selected' : ''}">${escape(record.name)}<small>${record.id} · ${escape(typeNames[record.type] || record.type)} · ${record.price}金币</small></button>`;
    }).join('');
}
function renderRecipe() {
    const record = current();
    const recipe = record?.combine || [];
    get('canCombine').checked = recipe.length === 2;
    get('recipe').hidden = recipe.length !== 2;
    for (const [index, elementId] of [[0, 'material1'], [1, 'material2']]) {
        get(elementId).innerHTML = '<option value="0">请选择材料</option>' + data.equipments.filter(material => {
            return material.id !== currentId;
        }).map(material => {
            return `<option value="${material.id}" ${material.id === recipe[index] ? 'selected' : ''}>${escape(material.name)} · ${material.id} · ${escape(typeNames[material.type] || material.type)}</option>`;
        }).join('');
    }
    get('recipePreview').textContent = recipe.length ? recipe.map(id => {
        return data.equipments.find(material => material.id === id)?.name || '未选择材料';
    }).join(' + ') + ' → ' + record.name : '当前无合成配方（combine = []）';
    const references = data.equipments.filter(item => item.combine.includes(currentId));
    get('references').textContent = references.length ? '被以下配方使用：' + references.map(item => {
        return `${item.name}（${item.id}）`;
    }).join('、') : '当前未被其他合成配方引用。';
}
function renderNode(effect, path, depth) {
    const entry = data.catalog[effect.type];
    const parameters = entry.fields.map(field => {
        const value = effect.params[field.key] ?? entry.defaults[field.key] ?? '';
        const attributes = `data-path="${path}" data-param="${field.key}" data-kind="${field.kind}"`;
        let input = `<input ${attributes} value="${escape(typeof value === 'object' ? JSON.stringify(value) : value)}">`;
        if (field.kind === 'enum') {
            input = `<select ${attributes}>${field.options.map(option => {
                return `<option ${option === value ? 'selected' : ''}>${escape(option)}</option>`;
            }).join('')}</select>`;
        }
        else if (field.kind === 'bool') {
            input = `<input type="checkbox" ${attributes} ${value ? 'checked' : ''} style="width:auto">`;
        }
        return `<div><label>${escape(field.label)}（${field.key}）<button class="help-button" data-help="expression">!</button></label>${input}</div>`;
    }).join('');
    const branches = [];
    if (entry.container || effect.children) {
        branches.push(['children', effect.type === 'CHOOSE_ONE' || effect.type === 'RANDOM_CHOICE' ? '可选效果' : '子效果']);
    }
    if (effect.type === 'IF' || effect.elseEffects) {
        branches.push(['elseEffects', '条件不成立']);
    }
    const nested = branches.map(([key, label]) => {
        const branchPath = path + '.' + key;
        const children = effect[key] || [];
        return `<div class="branch"><h3>${label}（${key}）</h3>${children.map((child, index) => {
            return renderNode(child, branchPath + '.' + index, depth + 1);
        }).join('')}<div class="row"><select>${optionsHtml('BLOCK')}</select><button data-action="add" data-path="${branchPath}">＋ 添加${label}</button></div></div>`;
    }).join('');
    const condition = effect.condition ? JSON.stringify(effect.condition, null, 2) : '';
    return `<section class="effect"><div class="effect-header"><strong>${escape(entry.label)} <span class="pill">${effect.type}</span></strong><button class="help-button" data-help-entry="${effect.type}">!</button><button data-action="up" data-path="${path}">↑</button><button data-action="down" data-path="${path}">↓</button><button data-action="copy" data-path="${path}">复制</button><button class="danger" data-action="delete" data-path="${path}">删除</button></div><div class="params"><div><label>目标（target）<button class="help-button" data-help="effect">!</button></label><select data-path="${path}" data-target><option ${effect.target === 'SELF' ? 'selected' : ''}>SELF</option><option ${effect.target === 'ENEMY' ? 'selected' : ''}>ENEMY</option></select></div>${parameters}</div><details ${effect.type === 'IF' ? 'open' : ''}><summary>触发条件（condition）<button class="help-button" data-help="condition">!</button></summary><textarea data-path="${path}" data-condition spellcheck="false">${escape(condition)}</textarea></details>${nested}</section>`;
}
function renderEffects() {
    const record = current();
    get('effects').innerHTML = (record?.effect || []).map((effect, index) => {
        return renderNode(effect, String(index), 0);
    }).join('') || '<p class="muted">当前效果为空，点击添加效果开始配置。</p>';
    syncJson();
}
function render() {
    renderList();
    const record = current();
    get('editor').hidden = !record;
    get('empty').hidden = !!record;
    get('duplicate').disabled = !record;
    if (!record) {
        return;
    }
    for (const field of ['id', 'name', 'effectDes', 'des', 'price', 'type']) {
        get(field).value = record[field] ?? '';
    }
    get('sources').textContent = '配置源：策划/excel/19_Equipment.xlsx';
    renderRecipe();
    renderEffects();
}
// 等待服务器读取工作簿并返回最新版本，读取完成后再切换界面数据。
async function reload() {
    if (saving || (dirty && !confirm('重新读取会丢弃未保存修改，是否继续？'))) {
        return;
    }
    try {
        const response = await fetch('/api/equipments', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error);
        }
        data = result;
        currentId = data.equipments.some(record => record.id === currentId) ? currentId : data.equipments[0]?.id || 0;
        dirty = false;
        pendingJson = false;
        const choices = data.types.map(type => {
            return `<option value="${type}">${typeNames[type]}（${type}）</option>`;
        }).join('');
        get('type').innerHTML = choices;
        get('filterType').innerHTML = '<option value="">全部类型</option>' + choices;
        get('effectType').innerHTML = optionsHtml('REGISTER_TRIGGER');
        render();
        status(`已读取 ${data.equipments.length} 件装备。现有描述、价格和配方已保留。`);
    }
    catch (error) {
        status('读取失败：' + error.message, true);
    }
}
function nextId() {
    const ids = new Set(data.equipments.map(record => record.id));
    let id = 190001;
    while (ids.has(id) && id <= 199999) {
        id += 1;
    }
    if (id > 199999) {
        throw new Error('装备编号已用完');
    }
    return id;
}
get('search').oninput = renderList;
get('filterType').onchange = renderList;
get('equipmentList').onclick = event => {
    const button = event.target.closest('[data-id]');
    if (button && settleJson()) {
        currentId = Number(button.dataset.id);
        render();
    }
};
for (const field of ['name', 'des', 'effectDes', 'price', 'type']) {
    get(field).oninput = () => {
        if (!current()) {
            return;
        }
        current()[field] = field === 'price' ? Number(get(field).value) : get(field).value;
        changed();
        renderList();
        if (field === 'name') {
            renderRecipe();
        }
    };
}
get('add').onclick = () => {
    if (!settleJson()) {
        return;
    }
    try {
        const record = { id: nextId(), name: '新装备', effectDes: '', des: '', effect: [],
            type: 'Component', price: 50, combine: [] };
        data.equipments.push(record);
        currentId = record.id;
        changed();
        render();
    }
    catch (error) {
        status(error.message, true);
    }
};
get('duplicate').onclick = () => {
    if (!current() || !settleJson()) {
        return;
    }
    try {
        const record = clone(current());
        record.id = nextId();
        record.name += '（副本）';
        data.equipments.push(record);
        currentId = record.id;
        changed();
        render();
    }
    catch (error) {
        status(error.message, true);
    }
};
get('remove').onclick = () => {
    if (!current() || !settleJson()) {
        return;
    }
    const references = data.equipments.filter(record => record.combine.includes(currentId));
    if (references.length) {
        status('不能删除：以下装备仍使用它作为材料：' + references.map(record => record.name).join('、'), true);
        return;
    }
    if (confirm(`删除 ${current().name}（${currentId}）？保存后写回表格。`)) {
        data.equipments = data.equipments.filter(record => record.id !== currentId);
        currentId = data.equipments[0]?.id || 0;
        changed();
        render();
    }
};
get('canCombine').onchange = () => {
    current().combine = get('canCombine').checked ? [0, 0] : [];
    changed();
    renderRecipe();
};
for (const [index, id] of [[0, 'material1'], [1, 'material2']]) {
    get(id).onchange = () => {
        current().combine[index] = Number(get(id).value);
        changed();
        renderRecipe();
    };
}
get('addEffect').onclick = () => {
    if (current() && settleJson()) {
        current().effect.push(makeEffect(get('effectType').value));
        changed();
        renderEffects();
    }
};
get('effects').onchange = event => {
    const element = event.target;
    if (!element.dataset.path || !settleJson()) {
        return;
    }
    const effect = atPath(element.dataset.path);
    try {
        if (element.hasAttribute('data-target')) {
            effect.target = element.value;
        }
        else if (element.hasAttribute('data-condition')) {
            if (element.value.trim()) {
                effect.condition = JSON.parse(element.value);
            }
            else {
                delete effect.condition;
            }
        }
        else if (element.dataset.param) {
            let value = element.value;
            if (element.dataset.kind === 'json') {
                value = JSON.parse(value);
            }
            else if (element.dataset.kind === 'bool') {
                value = element.checked;
            }
            else if (['expr', 'number'].includes(element.dataset.kind) && value.trim() && Number.isFinite(Number(value))) {
                value = Number(value);
            }
            effect.params[element.dataset.param] = value;
        }
        delete element.dataset.invalid;
        changed();
        syncJson();
    }
    catch (error) {
        element.dataset.invalid = 'true';
        status('参数或条件 JSON 无效：' + error.message, true);
    }
};
get('effects').onclick = event => {
    const button = event.target.closest('[data-action]');
    if (!button || !settleJson()) {
        return;
    }
    const path = button.dataset.path;
    if (button.dataset.action === 'add') {
        const segments = path.split('.');
        const key = segments.pop();
        const parent = atPath(segments.join('.'));
        parent[key] = parent[key] || [];
        parent[key].push(makeEffect(button.parentElement.querySelector('select').value));
    }
    else {
        const segments = path.split('.');
        const index = Number(segments.pop());
        const list = atPath(segments.join('.'));
        if (button.dataset.action === 'delete') {
            list.splice(index, 1);
        }
        else if (button.dataset.action === 'copy') {
            list.splice(index + 1, 0, clone(list[index]));
        }
        else {
            const next = index + (button.dataset.action === 'up' ? -1 : 1);
            if (next < 0 || next >= list.length) {
                return;
            }
            const moved = list.splice(index, 1)[0];
            list.splice(next, 0, moved);
        }
    }
    changed();
    renderEffects();
};
get('effectJson').oninput = () => {
    pendingJson = true;
    changed();
};
get('applyJson').onclick = applyJson;
get('reload').onclick = reload;
// 等待保存及配置生成返回，期间禁用编辑，防止把尚未发送的修改标记为已保存。
get('save').onclick = async () => {
    if (saving || !settleJson()) {
        return;
    }
    if (get('effects').querySelector('[data-invalid="true"]')) {
        status('请先修正无效的效果参数或条件 JSON。', true);
        return;
    }
    saving = true;
    get('save').disabled = true;
    get('reload').disabled = true;
    document.querySelector('main').inert = true;
    status('正在保存表格并生成客户端配置…');
    try {
        const response = await fetch('/api/equipments', { method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ revision: data.revision, equipments: data.equipments }) });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error);
        }
        data.revision = result.revision;
        dirty = false;
        renderList();
        status(result.warning || '表格已保存，客户端 JSON 和配置类已生成。', !!result.warning);
    }
    catch (error) {
        status('保存失败：' + error.message, true);
    }
    finally {
        saving = false;
        get('save').disabled = false;
        get('reload').disabled = false;
        document.querySelector('main').inert = false;
    }
};
get('export').onclick = () => {
    if (!settleJson()) {
        return;
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify({ equipments: data.equipments }, null, 2)],
        { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Equipment-backup.json';
    link.click();
    URL.revokeObjectURL(url);
    status('已导出当前装备 JSON 备份；表格未改动。');
};
document.addEventListener('click', event => {
    const button = event.target.closest('[data-help], [data-help-entry]');
    if (!button) {
        return;
    }
    event.preventDefault();
    if (button.dataset.helpEntry) {
        const entry = data.catalog[button.dataset.helpEntry];
        const extra = entry.type === 'REGISTER_TRIGGER'
            ? '\n\nON_COMBAT_START：战斗开始。\nON_TURN_START / ON_TURN_END：回合开始 / 结束。\nON_CARD_PLAYED：打出任意卡牌。\nON_ATTACK_PLAYED / ON_SKILL_PLAYED / ON_POWER_PLAYED：打出对应类型卡牌。\nON_DAMAGE_DEALT：造成伤害。ON_DAMAGE_TAKEN：受到伤害。ON_HP_LOSS：生命减少。\nON_DISCARD / ON_EXHAUST：弃牌 / 消耗卡牌。\nON_ENEMY_DIED：敌人死亡。ON_COMBAT_END：战斗结束。' : '';
        openHelp(entry.label + '（' + entry.type + '）', entry.hint + extra);
    }
    else {
        const entry = help[button.dataset.help];
        openHelp(entry[0], entry[1]);
    }
});
get('closeHelp').onclick = () => {
    get('helpDialog').close();
};
window.addEventListener('beforeunload', event => {
    if (dirty) {
        event.preventDefault();
        event.returnValue = '';
    }
});
reload();

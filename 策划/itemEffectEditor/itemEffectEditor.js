'use strict';
let data = { items: [], enemies: [], effectTypes: [], revision: '' };
let drops = {};
let currentId = 0;
let dirty = false;
const get = id => {
    return document.getElementById(id);
};
const escape = value => {
    return String(value ?? '').replace(/[&<>"']/g, ch => {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]);
    });
};
const current = () => {
    return data.items.find(item => {
        return item.id === currentId;
    });
};
function status(message) {
    get('status').textContent = message;
}
function changed() {
    dirty = true;
    status('存在未保存修改，请保存到表格或导出备份');
}
async function reload() {
    if (dirty && !confirm('重新读取将丢弃未保存修改，是否继续？')) {
        return;
    }
    try {
        const response = await fetch('/api/items', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error);
        }
        data = result;
        drops = Object.fromEntries(data.enemies.map(enemy => {
            return [enemy.id, enemy.itemRewad || 0];
        }));
        currentId = data.items[0]?.id || 0;
        dirty = false;
        get('effectType').innerHTML = data.effectTypes.map(type => {
            return `<option value="${type}">${escape(catalog[type]?.label || type)} (${type})</option>`;
        }).join('');
        get('enemy').innerHTML = data.enemies.map(enemy => {
            return `<option value="${enemy.id}">${escape(enemy.name)} · ${enemy.id}</option>`;
        }).join('');
        render();
        status(`已读取 ${data.items.length} 件道具、${data.enemies.length} 个敌人`);
    }
    catch (error) {
        status(error.message);
    }
}
function renderList() {
    const query = get('search').value.toLowerCase();
    get('itemList').innerHTML = data.items.filter(item => {
        return `${item.id} ${item.name} ${item.des}`.toLowerCase().includes(query);
    })
        .map(item => {
        return `<button data-id="${item.id}" class="${item.id === currentId ? 'selected' : ''}">${escape(item.name)}<small>${item.id} · ${escape(item.type)}</small></button>`;
    }).join('');
}
function render() {
    renderList();
    const item = current();
    for (const field of ['id', 'name', 'des', 'target', 'type', 'price']) {
        get(field).value = item?.[field] ?? '';
        get(field).disabled = !item;
    }
    get('addEffect').disabled = !item;
    get('remove').disabled = !item;
    renderEffects();
    renderEnemy();
}
function renderEffects() {
    const item = current();
    get('effectJson').value = JSON.stringify(item?.effect || [], null, 2);
    get('effects').innerHTML = (item?.effect || []).map((effect, index) => {
        const entry = catalog[effect.type];
        const params = effect.params || {};
        const fields = (entry?.fields || []).map(field => {
            const value = params[field.key] ?? entry.defaults[field.key] ?? '';
            const valueText = typeof value === 'object' ? JSON.stringify(value) : value;
            const attributes = `data-index="${index}" data-param="${field.key}" data-kind="${field.kind}"`;
            let input = `<input ${attributes} value="${escape(valueText)}">`;
            if (field.kind === 'enum') {
                input = `<select ${attributes}>${field.options.map(option => {
                    return `<option ${option === value ? 'selected' : ''}>${escape(option)}</option>`;
                }).join('')}</select>`;
            }
            else if (field.kind === 'bool') {
                input = `<input type="checkbox" ${attributes} ${value ? 'checked' : ''}>`;
            }
            return `<div><label>${escape(field.label)}（${field.key}）</label>${input}</div>`;
        }).join('');
        return `<section class="effect"><div class="row"><strong>${index + 1}. ${escape(entry?.label || effect.type)}</strong><select data-index="${index}" data-target>${['SELF', 'ENEMY'].map(target => {
            return `<option ${target === effect.target ? 'selected' : ''}>${target}</option>`;
        }).join('')}</select><button data-action="up" data-index="${index}">↑</button><button data-action="down" data-index="${index}">↓</button><button data-action="delete" data-index="${index}">删除</button></div><details class="help"><summary>！${escape(effect.type)} 的作用</summary>${escape(entry?.hint || '参见效果 JSON')}</details><div class="params">${fields}</div>${effect.children || effect.condition ? '<p class="muted">此节点含子效果或条件，请在完整效果 JSON 中编辑；嵌套数据会保留。</p>' : ''}</section>`;
    }).join('') || '<p class="muted">暂无效果，点击“添加效果”。</p>';
}
function renderEnemy() {
    const enemy = data.enemies.find(entry => {
        return entry.id === Number(get('enemy').value);
    });
    get('drop').innerHTML = '<option value="0">无掉落</option>' + data.items.map(item => {
        return `<option value="${item.id}">${escape(item.name)} · ${item.id}</option>`;
    }).join('');
    get('drop').value = drops[enemy?.id] || 0;
    get('enemyInfo').textContent = enemy ? `${enemy.title || ''} · 生命 ${enemy.originHp}\n${enemy.info || ''}\n行为：${JSON.stringify(enemy.behavior)}` : '';
    get('sources').textContent = '当前道具掉落来源：' + (data.enemies.filter(entry => {
        return drops[entry.id] === currentId;
    }).map(entry => {
        return entry.name;
    }).join('、') || '尚未关联敌人');
}
get('reload').onclick = reload;
get('search').oninput = renderList;
get('itemList').onclick = event => {
    const button = event.target.closest('[data-id]');
    if (button) {
        currentId = Number(button.dataset.id);
        render();
    }
};
for (const field of ['id', 'name', 'des', 'target', 'type', 'price']) {
    get(field).onchange = () => {
        const item = current();
        if (!item) {
            return;
        }
        const value = ['id', 'price'].includes(field) ? Number(get(field).value) : get(field).value;
        if (field === 'id') {
            if (!Number.isInteger(value) || value < 170001 || value > 179999 || data.items.some(entry => {
                return entry !== item && entry.id === value;
            })) {
                status('编号无效或已存在');
                get(field).value = item.id;
                return;
            }
            for (const enemyId of Object.keys(drops)) {
                if (drops[enemyId] === item.id) {
                    drops[enemyId] = value;
                }
            }
            currentId = value;
        }
        item[field] = value;
        changed();
        renderList();
        renderEnemy();
    };
}
get('add').onclick = () => {
    currentId = Math.max(170000, ...data.items.map(item => {
        return item.id;
    })) + 1;
    data.items.push({ id: currentId, name: '新道具', des: '使用效果说明', target: 'SELF', type: 'SKILL', price: 50, effect: [] });
    changed();
    render();
};
get('remove').onclick = () => {
    if (Object.values(drops).includes(currentId)) {
        status('此道具被敌人引用，请先移除或修改掉落关联');
        return;
    }
    if (confirm('删除当前道具？保存后写回表格。')) {
        data.items = data.items.filter(item => {
            return item.id !== currentId;
        });
        currentId = data.items[0]?.id || 0;
        changed();
        render();
    }
};
get('addEffect').onclick = () => {
    const type = get('effectType').value;
    const entry = catalog[type];
    const effect = { id: crypto.randomUUID(), type, target: current().target, params: structuredClone(entry.defaults) };
    if (entry.container) {
        effect.children = [];
    }
    if (type === 'IF') {
        effect.condition = { op: 'AND', rules: [{ lhs: '@target.hp', cmp: '<=', rhs: 30 }] };
        effect.elseEffects = [];
    }
    current().effect.push(effect);
    changed();
    renderEffects();
};
get('effects').onchange = event => {
    const element = event.target;
    const effect = current().effect[Number(element.dataset.index)];
    if (!effect) {
        return;
    }
    try {
        if (element.hasAttribute('data-target')) {
            effect.target = element.value;
        }
        else if (element.dataset.param) {
            let value = element.value;
            if (element.dataset.kind === 'json') {
                value = JSON.parse(value);
            }
            else if (element.dataset.kind === 'bool') {
                value = element.checked;
            }
            else if (value.trim() && Number.isFinite(Number(value))) {
                value = Number(value);
            }
            effect.params[element.dataset.param] = value;
        }
        changed();
        get('effectJson').value = JSON.stringify(current().effect, null, 2);
    }
    catch (error) {
        status('参数 JSON 无效：' + error.message);
    }
};
get('effects').onclick = event => {
    const button = event.target.closest('[data-action]');
    if (!button) {
        return;
    }
    const index = Number(button.dataset.index);
    const effects = current().effect;
    if (button.dataset.action === 'delete') {
        effects.splice(index, 1);
    }
    else {
        const other = index + (button.dataset.action === 'up' ? -1 : 1);
        if (other >= 0 && other < effects.length) {
            [effects[index], effects[other]] = [effects[other], effects[index]];
        }
    }
    changed();
    renderEffects();
};
get('applyJson').onclick = () => {
    try {
        const effects = JSON.parse(get('effectJson').value);
        if (!Array.isArray(effects) || !current()) {
            throw new Error('请选择道具，效果必须是数组');
        }
        const validate = (nodes, depth = 0) => {
            if (!Array.isArray(nodes) || depth > 20 || nodes.length > 100) {
                throw new Error('效果必须是数组，最多嵌套 20 层');
            }
            for (const node of nodes) {
                if (!node || !data.effectTypes.includes(node.type) || !['SELF', 'ENEMY'].includes(node.target)
                    || !node.params || typeof node.params !== 'object' || Array.isArray(node.params)) {
                    throw new Error('效果类型、目标或 params 无效');
                }
                for (const branch of ['children', 'elseEffects']) {
                    if (node[branch]) {
                        validate(node[branch], depth + 1);
                    }
                }
            }
        };
        validate(effects);
        current().effect = effects;
        changed();
        renderEffects();
    }
    catch (error) {
        status(error.message);
    }
};
get('enemy').onchange = renderEnemy;
get('assign').onclick = () => {
    drops[get('enemy').value] = Number(get('drop').value);
    changed();
    renderEnemy();
};
get('save').onclick = async () => {
    get('save').disabled = true;
    try {
        const response = await fetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: data.revision, items: data.items, drops }) });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error);
        }
        data.revision = result.revision;
        dirty = false;
        status('已保存 17_Item.xlsx 和敌人掉落引用，旧表已备份；游戏配置需通过项目表格生成器同步。');
    }
    catch (error) {
        status(error.message);
    }
    finally {
        get('save').disabled = false;
    }
};
get('export').onclick = () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify({ items: data.items, drops }, null, 2)], { type: 'application/json' }));
    link.download = 'items-backup.json';
    link.click();
    URL.revokeObjectURL(link.href);
};
window.addEventListener('beforeunload', event => {
    if (dirty) {
        event.preventDefault();
        event.returnValue = '';
    }
});
reload();

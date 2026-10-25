const editorMode = 'BUFF';
let currentBuff = Number(new URLSearchParams(location.search).get('buff')) || null;
let revision = '', dirty = false, saving = false, editVersion = 0;
let selectedNode = null, outputTab = 'validate', catalogFilter = '全部', addContext = { parent: null, branch: 'effect' };
let db = { cards: [] };
const getCurrentCard = () => getCurrentBuffAdapter();
function renderEditor() { return renderBuffEditor(); }
function renderOutput() { return renderBuffOutput(); }
function renderSidebar() { return renderBuffSidebar(); }
function saveExcel() { return saveBuffExcel(); }
// 等待最新Excel数据读取完成后更新编辑器，失败时保留页面中的修改。
function reloadTables() {
    if (location.protocol === 'file:') {
        document.getElementById('connectionNotice').textContent = '请通过 start.cmd 启动服务，再访问 http://127.0.0.1:3212/';
        return;
    }
    if (dirty && !confirm('重新读取会丢弃尚未保存的修改，是否继续？')) { return; }
    return fetch('/api/tables', {cache: 'no-store'}).then(async response => {
        const data = await response.json();
        if (!response.ok) { throw new Error(data.error); }
        updateEffectCatalog(data.effects);
        updateBuffCatalog(data.buffs.map(normalizeBuff));
        buffEditorMetadata = {durations: data.buffDurations, rules: data.buffRuleNames};
        originalBuffs = cloneValue(buffRows);
        db.cards = data.cards;
        revision = data.revision; dirty = false; selectedNode = null;
        renderEditor();
        document.getElementById('saveStatus').textContent = '已读取最新 Excel';
        document.getElementById('connectionNotice').textContent = 'Buff编辑器独立运行；保存只写入20_BattleBuff.xlsx。';
    }).catch(error => showToast('读取失败：' + error.message));
}
let originalBuffs = [];

let buffEditorMetadata = { durations: ['DEFAULT', 'TURN', 'NEXT_TURN', 'COMBAT', 'UNTIL_ENEMY_END', 'ACTION'], rules: [] };


function normalizeBuff(row) {
    return { ...row, id: Number(row.id), effects: (row.effects || []).map(normalizeNode), rules: { ...row.rules },
        defaultDuration: row.defaultDuration || 'DEFAULT', dispellable: row.dispellable ?? true };
}


function getCurrentBuff() {
    return buffRows.find(buff => buff.id === currentBuff) || null;
}


// 效果树复用卡牌编辑器，修改直接写回当前Buff的effects数组。
function getCurrentBuffAdapter() {
    const buff = getCurrentBuff();
    if (!buff) {
        return null;
    }
    return { id: String(buff.id), name: buff.name, type: 'BUFF', target: 'SELF',
        get effect() {
            return buff.effects;
        },
        set effect(value) {
            buff.effects = value;
        } };
}


function renderBuffSidebar() {
    const query = document.getElementById('cardSearch').value.toLowerCase();
    const rows = buffRows.filter(buff => (buff.id + ' ' + buff.name + ' ' + buff.type).toLowerCase().includes(query));
    document.getElementById('countTag').textContent = rows.length + ' 种';
    document.getElementById('cardList').innerHTML = rows.map(buff => `<div class="card-item ${buff.id === currentBuff ? 'active' : ''}" data-buff="${buff.id}"><div class="ico">◈</div><div><strong>${escapeHtml(buff.name)}</strong><small>${buff.id} · ${escapeHtml(buff.category)}</small></div></div>`).join('');
}


function renderBuffEditor() {
    if (!getCurrentBuff()) {
        currentBuff = buffRows[0]?.id || null;
    }
    if (selectedNode && !findNode(selectedNode)) {
        selectedNode = null;
    }
    renderBuffSidebar();
    const buff = getCurrentBuff();
    document.getElementById('heading').textContent = buff?.name || '暂无 Buff';
    document.getElementById('breadcrumb').textContent = buff?.name || '新建 Buff';
    document.getElementById('subheading').textContent = buff ? `${buff.id} · ${buff.type}` : '点击新建 Buff';
    const field = (key, label, type = 'text', readonly = false) => `<div class="field"><label>${label}</label><input class="input" data-buff-field="${key}" type="${type}" value="${escapeAttribute(buff[key])}" ${readonly ? 'readonly' : ''}></div>`;
    const select = (key, label, options) => `<div class="field"><label>${label}</label><select class="select" data-buff-field="${key}">${selectHtml(options, buff[key])}</select></div>`;
    const existing = originalBuffs.some(row => row.id === buff?.id);
    document.getElementById('cardForm').innerHTML = buff ? `<div class="notice">效果在获得每层 Buff 时执行。持续效果请添加“注册事件监听”并配置子效果；持续规则在下方设置。保存后使用项目配表插件同步客户端。</div><div class="fields">${field('id', '编号（200001–209999）', 'number', true)}${field('type', '枚举', 'text', existing)}${field('name', '名称')}${select('category', '分类', ['BUFF', 'DEBUFF'])}${select('stackMode', '叠加方式', ['ADD', 'MAX', 'REPLACE'])}${field('maxStacks', '层数上限', 'number')}${select('defaultDuration', '默认持续时间（施加时DEFAULT采用此值）', buffEditorMetadata.durations)}<div class="field"><label><input type="checkbox" data-buff-field="decayAtTurnEnd" ${buff.decayAtTurnEnd ? 'checked' : ''}> 默认状态回合末衰减</label><label><input type="checkbox" data-buff-field="dispellable" ${buff.dispellable ? 'checked' : ''}> 可被驱散</label></div><div class="field span4"><label>说明</label><textarea class="textarea" data-buff-field="description">${escapeHtml(buff.description)}</textarea></div></div><h3>持续规则</h3>${Object.entries(buff.rules).map(([key, value]) => `<div class="buff-rule"><span>${escapeHtml(key)}</span><input class="input" type="number" min="0" step="any" data-buff-rule="${key}" value="${value}"><button class="btn danger" data-remove-buff-rule="${key}">删除</button></div>`).join('')}<div class="buff-rule"><select class="select" id="buffRuleChoice">${selectHtml(buffEditorMetadata.rules.filter(key => !Object.hasOwn(buff.rules, key)), '')}</select><button class="btn" id="addBuffRule">添加规则</button></div><p class="helper">规则数值按每层累计；0.25表示25%的额外倍率。已支持规则由战斗代码定义。</p>` : '<div class="empty">新建或选择一个 Buff。</div>';
    renderTree();
    if (!buff?.effects.length) {
        document.getElementById('effectTree').innerHTML = '<div class="empty">此 Buff 暂无获得效果或监听。<button class="btn" data-add-parent="" data-add-branch="effect">＋ 添加效果 / 事件监听</button></div>';
    }
    renderInspector();
    renderBuffOutput();
}


function getBuffValidationMessages() {
    const messages = [], ids = new Set(), types = new Set();
    for (const buff of buffRows) {
        if (!Number.isInteger(buff.id) || buff.id < 200001 || buff.id > 209999 || ids.has(buff.id)
            || !/^[A-Z][A-Z0-9_]*$/.test(buff.type) || types.has(buff.type) || !buff.name.trim()
            || !Number.isSafeInteger(buff.maxStacks) || buff.maxStacks < 1) {
            messages.push(['error', `${buff.name}：编号、枚举、名称或层数无效`]);
        }
        ids.add(buff.id);
        types.add(buff.type);
        walkNodes(buff.effects, node => {
            if (!catalog[node.type] || node.trigger && node.trigger !== 'ON_PLAY') {
                messages.push(['error', `${buff.name}：使用事件监听配置持续触发，不使用卡牌触发时机`]);
            }
        });
        for (const [key, amount] of Object.entries(buff.rules)) {
            if (!buffEditorMetadata.rules.includes(key) || !Number.isFinite(amount) || amount < 0) {
                messages.push(['error', `${buff.name}：持续规则无效`]);
            }
        }
    }
    return messages;
}


function renderBuffOutput() {
    const buff = getCurrentBuff();
    document.querySelectorAll('[data-output]').forEach(button => button.classList.toggle('active', button.dataset.output === outputTab));
    const messages = getBuffValidationMessages();
    document.getElementById('outputPane').innerHTML = outputTab === 'json'
        ? `<pre class="pre">${escapeHtml(serializeJson(buff))}</pre>`
        : messages.length ? messages.map(([, text]) => `<p class="error">${escapeHtml(text)}</p>`).join('') : '<div class="ok">✓ Buff 结构校验通过。保存时还会检查卡牌、其他配置表和战斗代码引用。</div>';
}


// 等待服务端版本与引用校验通过后保存，保存失败保留当前编辑内容。
function saveBuffExcel() {
    if (!revision || saving) {
        return;
    }
    const errors = getBuffValidationMessages();
    if (errors.length) {
        showToast(errors[0][1]);
        return;
    }
    saving = true;
    const version = editVersion;
    const savedRows = cloneValue(buffRows);
    document.getElementById('saveExcelBtn').disabled = true;
    return fetch('/api/buffs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision, buffs: savedRows }) })
        .then(async response => {
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error);
            }
            revision = result.revision;
            dirty = editVersion !== version;
            originalBuffs = savedRows;
            updateBuffCatalog(buffRows);
            document.getElementById('saveStatus').textContent = dirty ? '有新增修改待保存' : 'Buff 已保存到 Excel';
            showToast('Buff 已保存；请同步生成客户端配置');
        }).catch(error => showToast('保存失败：' + error.message)).finally(() => {
            saving = false;
            document.getElementById('saveExcelBtn').disabled = false;
        });
}


function createBuff(copy = false) {
    const id = Math.max(200000, ...buffRows.map(buff => buff.id)) + 1;
    if (id > 209999) {
        showToast('Buff编号已用尽');
        return;
    }
    const source = copy && getCurrentBuff();
    const buff = normalizeBuff(source ? cloneValue(source) : { name: '新 Buff', category: 'BUFF', stackMode: 'ADD', maxStacks: 99, decayAtTurnEnd: false, defaultDuration: 'COMBAT', description: '', effects: [], rules: {} });
    buff.id = id;
    buff.type = 'CUSTOM_BUFF_' + id;
    buff.name += source ? ' 副本' : '';
    if (source) {
        walkNodes(buff.effects, node => {
            node.id = createNodeId();
        });
    }
    buffRows.push(buff);
    currentBuff = id;
    selectedNode = null;
    updateBuffCatalog(buffRows);
    scheduleSave();
    renderEditor();
}


function deleteBuff() {
    const buff = getCurrentBuff();
    if (buff) {
        let referenced = false;
        for (const entry of [...db.cards.map(card => card.effect), ...buffRows.filter(row => row.id !== buff.id).map(row => row.effects)]) {
            walkNodes(entry, node => {
                if (node.params.status === buff.id || node.params.stat === buff.id || node.params.filter?.status === buff.id) {
                    referenced = true;
                }
            });
        }
        if (referenced || Object.values(catalog).some(definition => definition.defaults.status === buff.id || definition.defaults.stat === buff.id)) {
            showToast('此Buff仍被卡牌、其他Buff或效果默认参数引用，请先迁移引用');
            return;
        }
    }
    if (!buff || !confirm(`删除“${buff.name}”？保存时将检查引用，仍被使用的Buff不能删除。`)) {
        return;
    }
    buffRows = buffRows.filter(row => row.id !== buff.id);
    updateBuffCatalog(buffRows);
    currentBuff = null;
    selectedNode = null;
    scheduleSave();
    renderEditor();
}

document.getElementById('addCardBtn').onclick = () => createBuff();

document.getElementById('copyCardBtn').onclick = () => createBuff(true);

document.getElementById('deleteCardBtn').onclick = deleteBuff;

document.getElementById('exportBtn').onclick = () => downloadFile('buffs.json', serializeJson({ buffs: buffRows }));

document.getElementById('importBtn').onclick = () => {
    document.getElementById('buffFileInput').click();
};

const buffFileInput = document.createElement('input');

buffFileInput.id = 'buffFileInput';

buffFileInput.type = 'file';

buffFileInput.accept = '.json';

buffFileInput.hidden = true;

document.body.appendChild(buffFileInput);

buffFileInput.onchange = event => {
    const file = event.target.files[0];
    if (file) {
        const previous = buffRows;
        file.text().then(text => {
            const parsed = JSON.parse(text);
            const proposed = (Array.isArray(parsed) ? parsed : parsed.buffs).map(normalizeBuff);
            updateBuffCatalog(proposed);
            currentBuff = null;
            selectedNode = null;
            scheduleSave();
            renderEditor();
        }).catch(error => {
            updateBuffCatalog(previous);
            showToast('导入失败：' + error.message);
        });
    }
    event.target.value = '';
};

document.addEventListener('click', event => {
    const target = event.target.closest('[data-buff],[data-edit-buff],[data-remove-buff-rule],#addBuffRule');
    if (!target) {
        return;
    }
    if (target.dataset.buff) {
        currentBuff = Number(target.dataset.buff);
        selectedNode = null;
        renderEditor();
    }
    else if (target.dataset.editBuff) {
        if (!dirty && !saving) {
            currentBuff = Number(target.dataset.editBuff);
        }
        renderEditor();
    }
    else {
        const buff = getCurrentBuff();
        if (target.dataset.removeBuffRule) {
            delete buff.rules[target.dataset.removeBuffRule];
        }
        else {
            const key = document.getElementById('buffRuleChoice').value;
            if (!key) {
                return;
            }
            buff.rules[key] = 1;
        }
        scheduleSave();
        renderEditor();
    }
});

document.getElementById('cardForm').addEventListener('change', event => {
    const target = event.target, buff = getCurrentBuff();
    if (editorMode !== 'BUFF' || !buff) {
        return;
    }
    if (target.dataset.buffRule) {
        buff.rules[target.dataset.buffRule] = Number(target.value);
    }
    else if (target.dataset.buffField && target.dataset.buffField !== 'id') {
        const key = target.dataset.buffField;
        if (key === 'type' && originalBuffs.some(row => row.id === buff.id)) {
            return;
        }
        buff[key] = target.type === 'checkbox' ? target.checked : key === 'maxStacks' ? Number(target.value) : target.value;
    }
    else {
        return;
    }
    scheduleSave();
    renderBuffOutput();
    if (target.dataset.buffField === 'name' || target.dataset.buffField === 'type') {
        document.getElementById('heading').textContent = buff.name;
        document.getElementById('breadcrumb').textContent = buff.name;
        document.getElementById('subheading').textContent = `${buff.id} · ${buff.type}`;
        renderBuffSidebar();
    }
});

document.getElementById('cardForm').addEventListener('input', event => {
    if (editorMode === 'BUFF' && (event.target.dataset.buffField || event.target.dataset.buffRule)) {
        scheduleSave();
    }
});

initializeEffectEditor();
renderEditor();

reloadTables();
document.getElementById('loadSamplesBtn').onclick = reloadTables;
document.getElementById('saveExcelBtn').onclick = saveExcel;
document.getElementById('guideBtn').onclick = () => document.getElementById('guideOverlay').classList.add('show');

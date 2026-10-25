
let CATEGORIES = ['全部'];

let BattleEffectTypeEnum = {};

/**
 * @returns {void}
 */
function updateEffectCatalog(rows) {
    BattleEffectTypeEnum = Object.fromEntries(rows.map(row => [row.type, row.id]));
    Object.keys(catalog).forEach(key => {
        delete catalog[key];
    });
    for (const row of rows) {
        if (row.cardEnabled) {
            catalog[row.id] = { type: row.id, label: row.name, hint: row.description, cat: row.category, defaults: row.defaultParams, fields: row.fields, container: row.container, target: row.defaultTarget };
        }
    }
    CATEGORIES = ['全部', ...new Set(Object.values(catalog).map(row => row.cat))];
}

const catalog = {};

let buffRows = [];

let BattleBuffTypeEnum = {};

/**
 * @returns {void}
 */
function updateBuffCatalog(rows) {
    buffRows = rows;
    BattleBuffTypeEnum = Object.fromEntries(rows.map(row => {
        return [row.type, row.id];
    }));
    const ids = rows.map(row => {
        return row.id;
    });
    for (const definition of Object.values(catalog)) {
        for (const field of definition.fields) {
            if (['status', 'stat', 'powerId'].includes(field.key)) {
                field.kind = 'enum';
                field.options = [...ids, ...(field.key === 'stat' ? ['HP', 'MAX_HP', 'BLOCK'] : definition.type === BattleEffectTypeEnum.REMOVE_STATUS ? ['ALL'] : [])];
            }
        }
        for (const key of ['status', 'stat', 'powerId']) {
            if (definition.fields.some(field => field.key === key)) {
                const choices = rows.filter(row => key === 'stat' ? row.category === 'BUFF' : true);
                if (!choices.length) {
                    throw new Error('Buff表没有可选状态');
                }
                if (!rows.some(row => {
                    return row.id === definition.defaults[key];
                }) && !['HP', 'MAX_HP', 'BLOCK', 'ALL'].includes(definition.defaults[key])) {
                    throw new Error('效果表的默认状态或属性不在Buff表中');
                }
            }
        }
    }
}

const icons = { '基础战斗': '⚔', '资源与数值': '✦', '卡牌与牌堆': '▣', '状态与能力': '◈', '流程与触发': '⑂', '特殊机制': '⌘' };

let uid = 0;

/**
 * @returns {string}
 */
const createNodeId = () => {
    return `e_${Date.now().toString(36)}_${(++uid).toString(36)}`;
};

/**
 * @template T
 * @param {T} x
 * @returns {T}
 */
const cloneValue = x => {
    return JSON.parse(JSON.stringify(x));
};

/**
 * @returns {BattleEffect}
 */
const createEffect = (type) => {
    const d = catalog[type];
    if (!d) {
        throw new Error('效果编号不在效果表的卡牌可用列表中：' + type);
    }
    const n = { id: createNodeId(), type: d.type, target: d.target, params: cloneValue(d.defaults), children: [], elseEffects: [] };
    if (d.container) {
        n.children = [];
    }
    if (d.container === 'if') {
        n.condition = { op: 'AND', rules: [{ lhs: '@target.hp', cmp: '<=', rhs: 30 }] };
        n.elseEffects = [];
    }
    return n;
};

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function normalizeJsonKeys(value) {
    if (Array.isArray(value)) {
        return value.map(normalizeJsonKeys);
    }
    if (!value || typeof value !== 'object') {
        return value;
    }
    const result = {};
    for (const [key, item] of Object.entries(value)) {
        const field = key.replace(/_([a-z])/g, (_, letter) => {
            return letter.toUpperCase();
        });
        result[field] = normalizeJsonKeys(item);
    }
    return result;
}

/**
 * @returns {BattleEffect}
 */
function normalizeNode(raw) {
    let n = normalizeJsonKeys(raw);
    if (!n || typeof n !== 'object' || Array.isArray(n)) {
        throw new Error('效果节点必须是JSON对象');
    }
    n.id = String(n.id || createNodeId());
    if (!n.type) {
        throw new Error('效果节点缺少type');
    }
    if (!Number.isSafeInteger(n.type) || !catalog[n.type]) {
        throw new Error('效果类型必须是效果表中的数值编号：' + n.type);
    }
    n.target = n.target || 'SELF';
    n.params = n.params && typeof n.params === 'object' && !Array.isArray(n.params) ? n.params : {};
    if (n.condition && !Array.isArray(n.condition.rules) && n.condition.lhs !== undefined) {
        n.condition = { op: 'AND', rules: [n.condition] };
    }
    for (let key of ['children', 'elseEffects']) {
        if (!Object.prototype.hasOwnProperty.call(n, key)) {
            n[key] = [];
        }
        if (!Array.isArray(n[key])) {
            throw new Error('效果分支必须是数组');
        }
        n[key] = n[key].map(normalizeNode);
    }
    return n;
}

/**
 * @returns {void}
 */
function markChanges() {
    scheduleSave();
}

/**
 * @returns {void}
 */
function scheduleSave() {
    dirty = true;
    editVersion++;
    document.getElementById('saveStatus').textContent = '待保存到 Excel';
}

/**
 * @returns {string}
 */
const escapeHtml = s => {
    return String(s ?? '').replace(/[&<>"']/g, x => {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]);
    });
};

const escapeAttribute = escapeHtml;

/**
 * @returns {string}
 */
const serializeJson = value => {
    return JSON.stringify(normalizeJsonKeys(value), null, 2);
};

/**
 * @returns {void}
 */
function showToast(msg) {
    let t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => {
        return t.classList.remove('show');
    }, 3000);
}

/**
 * @returns {void}
 */
function walkNodes(arr, fn) {
    for (let n of arr || []) {
        fn(n);
        if (Array.isArray(n.children)) {
            walkNodes(n.children, fn);
        }
        if (Array.isArray(n.elseEffects)) {
            walkNodes(n.elseEffects, fn);
        }
    }
}

/**
 * @returns {BattleEffect|null}
 */
function findNode(id, arr = getCurrentCard()?.effect) {
    let found = null;
    walkNodes(arr, n => {
        if (n.id === id) {
            found = n;
        }
    });
    return found;
}

/**
 * @returns {EffectLocation|null}
 */
function findNodeLocation(id, arr = getCurrentCard()?.effect, parent = null, branch = 'effect') {
    for (let i = 0; i < (arr || []).length; i++) {
        const n = arr[i];
        if (n.id === id) {
            return { node: n, arr, index: i, parent, branch };
        }
        for (const key of ['children', 'elseEffects']) {
            if (Array.isArray(n[key])) {
                const r = findNodeLocation(id, n[key], n, key);
                if (r) {
                    return r;
                }
            }
        }
    }
    return null;
}

/**
 * @returns {number|string}
 */
function parseScalar(s) {
    if (s === '') {
        return '';
    }
    if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s.trim())) {
        return Number(s);
    }
    return s;
}

const triggerHelp = {
    ON_PLAY: '打出这张卡时执行。',
    ON_DRAWN: '这张卡被抽入手牌时执行。',
    ON_DISCARDED: '这张卡被弃置时执行。',
    ON_EXHAUSTED: '这张卡被消耗时执行。',
    ON_TURN_END_IN_HAND: '回合结束时，这张卡仍在手牌中才执行。',
    ON_COMBAT_START: '战斗开始时执行。',
    ON_KILL_WITH_THIS_CARD: '这张卡击败敌人时执行。',
    ON_HIT_UNBLOCKED: '这张卡造成未被格挡的伤害时执行。',
    ON_RETAINED: '这张卡在回合结束后被保留时执行。',
    ON_TURN_END_IN_EXHAUST: '回合结束时，这张卡仍在消耗牌堆中才执行。'
};

const fieldHelp = {
    id: '卡牌在配置表中的唯一编号。修改编号会同步更新其他卡牌的升级引用。',
    name: '卡牌显示名称。',
    des: '卡牌在游戏中显示的描述文本。',
    DiceNeed: '打出卡牌所需的骰子 Icon。只能选择所属角色的骰子，可重复添加，最多 5 个。',
    level: '卡牌等级：1 最低，3 最高。',
    price: '卡牌价格，必须是非负整数。',
    role: '所属角色 ID，来自 Role 表。当前由左侧角色选择器决定。',
    target: '出牌或效果作用目标：SELF 是自己，ENEMY 是唯一的敌人。',
    type: '卡牌类型：ATTACK 攻击、SKILL 技能、POWER 能力、STATUS 状态、CURSE 诅咒。',
    upId: '升级后卡牌的 ID；留空表示没有升级目标。',
    flags: '卡牌的消耗、保留、虚无、固有和不可打出属性。',
    effect: '按顺序执行的效果节点数组，保存在 Card 表的 effect JSON 字段。',
    trigger: '根节点效果的触发时机。不同选项的含义如下。',
    condition: '只有满足条件时才执行效果。AND 表示全部满足，OR 表示满足任意一条。',
    damageKind: 'ATTACK 为普通攻击伤害；THORNS 为反伤；HP_LOSS 为直接失去生命；SPECIAL 为特殊伤害。',
    ignoreBlock: '启用后伤害忽略目标格挡。'
};

/**
 * @returns {string}
 */
function createHelpButton(field) {
    return '<button type="button" class="help-button" data-help="' + escapeAttribute(field) + '" aria-label="查看 ' + escapeAttribute(field) + ' 的说明" title="查看说明">!</button>';
}

/**
 * @returns {void}
 */
function showHelp(field, label, options) {
    const title = label || field;
    const details = fieldHelp[field] || '这个字段会写入 JSON 的 ' + field + ' 属性，由对应效果处理器读取。';
    const explanations = field === 'trigger' ? triggerHelp : null;
    const values = options || (explanations ? TRIGGER_EVENTS : []);
    const items = values.map(value => {
        const description = explanations?.[value] || '选项值：' + value;
        return '<li><code>' + escapeHtml(value) + '</code>：' + escapeHtml(description) + '</li>';
    }).join('');
    document.getElementById('helpTitle').textContent = title + '（' + field + '）';
    document.getElementById('helpBody').innerHTML = '<p>' + escapeHtml(details) + '</p>' + (items ? '<ul class="help-list">' + items + '</ul>' : '');
    document.getElementById('helpOverlay').classList.add('show');
}

/**
 * @returns {string}
 */
function describeEffect(n) {
    let d = catalog[n.type], p = n.params || {};
    if (n.type === BattleEffectTypeEnum.DRAW) {
        return `免费抽取 ${p.count ?? '?'} 张卡牌到手牌 · 手牌上限 10 张`;
    }
    if (n.type === BattleEffectTypeEnum.GAIN_ENERGY) {
        return `补充 ${p.amount ?? '?'} 点能量 · 不超过能量上限`;
    }
    let keys = d?.fields?.slice(0, 2).map(x => {
        return x.key;
    }) || Object.keys(p).slice(0, 2);
    let ps = keys.filter(k => {
        return p[k] !== undefined && typeof p[k] !== 'object';
    }).map(k => {
        return `${k}: ${String(p[k])}`;
    }).join(' · ');
    if (n.type === BattleEffectTypeEnum.IF) {
        ps = `${n.condition?.rules?.map(r => {
            return `${r.lhs} ${r.cmp} ${r.rhs}`;
        }).join(' ' + (n.condition?.op || 'AND') + ' ') || '未设置条件'}`;
    }
    return ps || d?.hint || '自定义参数';
}

/**
 * @returns {string}
 */
function renderNodes(arr, branch = 'effect', parent = null) {
    return (arr || []).map((n, i) => {
        let d = catalog[n.type];
        let container = d ? d.container : (n.children?.length ? 'children' : '');
        let indent = `<div class="effect ${selectedNode === n.id ? 'selected' : ''}" data-effect-node="${escapeAttribute(n.id)}"><div class="effect-row" data-select-node="${escapeAttribute(n.id)}"><span class="step-num">${i + 1}</span><div class="effect-icon">${icons[d?.cat] || '⌘'}</div><div style="min-width:0;flex:1"><div class="effect-title">${escapeHtml(d?.label || n.type)} <span class="badgel" style="margin-left:4px">${escapeHtml(n.target)}</span></div><div class="effect-desc">${n.trigger && n.trigger !== 'ON_PLAY' ? '[' + escapeHtml(n.trigger) + '] · ' : ''}${escapeHtml(describeEffect(n))}${n.condition && n.type !== BattleEffectTypeEnum.IF ? ' · ⚑ 有条件' : ''}</div></div><div class="effect-actions"><button class="round" title="上移" data-move="up" data-id="${escapeAttribute(n.id)}">↑</button><button class="round" title="下移" data-move="down" data-id="${escapeAttribute(n.id)}">↓</button><button class="round" title="复制" data-dup="${escapeAttribute(n.id)}">⧉</button><button class="round danger" title="删除" data-del="${escapeAttribute(n.id)}">×</button></div></div>`;
        if (container) {
            indent += `<div class="nested"><div class="nested-label"><span>${container === 'if' ? 'THEN · 条件成立' : '子效果 · ' + (n.children || []).length + ' 项'}</span><span class="muted">顺序执行</span></div><div class="nested-list">${renderNodes(n.children || [], 'children', n) || '<div class="helper">暂无子效果</div>'}<button class="add-inline" data-add-parent="${escapeAttribute(n.id)}" data-add-branch="children">＋ 在此添加子效果</button></div>`;
            if (container === 'if') {
                indent += `<div class="nested-label"><span>ELSE · 条件不成立</span></div><div class="nested-list">${renderNodes(n.elseEffects || [], 'elseEffects', n) || '<div class="helper">默认跳过</div>'}<button class="add-inline" data-add-parent="${escapeAttribute(n.id)}" data-add-branch="elseEffects">＋ 添加 ELSE 效果</button></div>`;
            }
            indent += '</div>';
        }
        return indent + '</div>';
    }).join('');
}

/**
 * @returns {void}
 */
function renderTree() {
    const c = getCurrentCard();
    document.getElementById('effectCount').textContent = (c?.effect?.length || 0) + ' 个步骤';
    document.getElementById('effectTree').innerHTML = c?.effect?.length ? renderNodes(c.effect) : '<div class="empty">当前卡牌没有效果。<br/>添加伤害、格挡、状态、条件或持续触发器。<br/><button class="btn primary" style="margin-top:13px" data-add-parent="" data-add-branch="effect">＋ 添加第一个效果</button></div>';
}

/**
 * @returns {string}
 */
function selectHtml(options, value) {
    return options.map(v => {
        return `<option value="${escapeAttribute(v)}" ${String(v) === String(value) ? 'selected' : ''}>${escapeHtml(buffRows.find(row => {
            return row.id === v;
        })?.name ?? v)}</option>`;
    }).join('');
}

/**
 * @returns {string}
 */
function renderParamField(field, p) {
    let v = p[field.key] ?? '', content = '';
    if (field.kind === 'enum') {
        content = `<select class="select" data-param="${escapeAttribute(field.key)}" data-kind="enum">${selectHtml(field.options || [], v)}${v && !field.options.includes(v) ? `<option selected value="${escapeAttribute(v)}">${escapeHtml(v)} (自定义)</option>` : ''}</select>`;
    }
    else if (field.kind === 'bool') {
        content = `<label class="check"><input type="checkbox" data-param="${escapeAttribute(field.key)}" data-kind="bool" ${v ? 'checked' : ''}/> 启用</label>`;
    }
    else if (field.kind === 'json') {
        content = `<textarea class="textarea mono" spellcheck="false" rows="3" data-param="${escapeAttribute(field.key)}" data-kind="json">${escapeHtml(serializeJson(v))}</textarea><span class="helper" data-json-error="${escapeAttribute(field.key)}">对象 / 数组均可，离开输入框时解析</span>`;
    }
    else {
        content = `<input class="input ${field.kind === 'expr' ? 'mono' : ''}" ${field.kind === 'number' ? 'type="number"' : ''} data-param="${escapeAttribute(field.key)}" data-kind="${escapeAttribute(field.kind)}" value="${escapeAttribute(v)}" placeholder="${field.kind === 'expr' ? '数字或表达式' : ''}" />`;
    }
    return `<div class="field"><label>${escapeHtml(field.label)}（${escapeHtml(field.key)}）${createHelpButton(field.key)}</label>${content}</div>`;
}

const TRIGGER_EVENTS = ['ON_PLAY', 'ON_DRAWN', 'ON_DISCARDED', 'ON_EXHAUSTED', 'ON_TURN_END_IN_HAND', 'ON_COMBAT_START', 'ON_KILL_WITH_THIS_CARD', 'ON_HIT_UNBLOCKED', 'ON_RETAINED', 'ON_TURN_END_IN_EXHAUST'];

const commonTargets = ['SELF', 'ENEMY'];

const cmpOps = ['==', '!=', '>', '>=', '<', '<='];

/**
 * @returns {string}
 */
function renderCondition(n) {
    let co = n.condition || { op: 'AND', rules: [] };
    let rules = Array.isArray(co.rules) ? co.rules : [];
    return `<div class="ins-group"><h3>触发条件（condition）${createHelpButton('condition')}</h3><div class="ins-stack"><div class="field"><label>条件组合</label><select class="select" id="condOp">${selectHtml(['AND', 'OR'], co.op || 'AND')}</select></div>${rules.map((r, i) => {
        return `<div class="cond-rule"><div class="cond-line"><input class="input mono" data-condition-field="lhs" data-rule="${i}" value="${escapeAttribute(r.lhs)}" placeholder="@target.buff.状态编号" /><select class="select" data-condition-field="cmp" data-rule="${i}">${selectHtml(cmpOps, r.cmp || '==')}</select><button class="round danger" data-remove-condition="${i}" title="删除条件">×</button></div><div class="cond-line"><span class="muted small">比较值</span><input class="input mono" data-condition-field="rhs" data-rule="${i}" value="${escapeAttribute(typeof r.rhs === 'object' ? JSON.stringify(r.rhs) : r.rhs)}" placeholder="数值、true 或公式" /></div></div>`;
    }).join('')}<button class="btn block" data-add-condition="1">＋ 添加条件</button><span class="helper">条件支持 AND / OR，复杂嵌套请用下方的节点 JSON 编辑。</span></div></div>`;
}

let advancedText = '';

/**
 * @returns {void}
 */
function renderInspector() {
    const n = selectedNode ? findNode(selectedNode) : null;
    const header = document.getElementById('insTitle'), sub = document.getElementById('insSub'), body = document.getElementById('inspectorBody'), badge = document.getElementById('insBadge');
    if (!n) {
        header.textContent = '效果属性';
        sub.textContent = '选择一个效果，或从效果库中添加。';
        badge.textContent = 'INSPECTOR';
        body.innerHTML = '<div class="empty">← 在中间添加或选择效果<br/>这里会出现动态参数表单。</div>';
        return;
    }
    const d = catalog[n.type];
    header.textContent = d?.label || n.type;
    badge.textContent = n.type;
    sub.textContent = d?.hint || '未知扩展类型：使用 JSON 编辑';
    let form = `<div class="ins-group"><h3>通用配置</h3><div class="ins-stack"><div class="field"><label>效果类型（type）${createHelpButton('type')}</label><input class="input mono" readonly value="${escapeAttribute(n.type)}"/></div><div class="field"><label>作用目标（target）${createHelpButton('target')}</label><select class="select" data-node-field="target">${selectHtml([BattleEffectTypeEnum.DRAW, BattleEffectTypeEnum.GAIN_ENERGY, BattleEffectTypeEnum.MOVE_CARD, BattleEffectTypeEnum.COPY_CARD, BattleEffectTypeEnum.PLAY_CARD, BattleEffectTypeEnum.TRANSFORM_CARD, BattleEffectTypeEnum.GENERATE_CARD, BattleEffectTypeEnum.GROW_CARD, BattleEffectTypeEnum.CARD_RULE, BattleEffectTypeEnum.GAIN_STARS, BattleEffectTypeEnum.FORGE, BattleEffectTypeEnum.SUMMON_BLADE, BattleEffectTypeEnum.END_TURN].includes(n.type) ? ['SELF'] : commonTargets, n.target || 'SELF')}</select></div>${editorMode === 'CARD' && !findNodeLocation(n.id)?.parent ? `<div class="field"><label>该卡效果触发时机（根节点）${createHelpButton('trigger')}</label><select class="select" data-node-field="trigger">${selectHtml(TRIGGER_EVENTS, n.trigger || 'ON_PLAY')}</select></div>` : ''}<div class="field"><label>备注（note）${createHelpButton('note')}</label><input class="input" data-node-field="note" value="${escapeAttribute(n.note || '')}" placeholder="可选" /></div></div></div>`;
    form += `<div class="ins-group"><h3>效果参数</h3><div class="ins-stack">${d?.fields?.length ? d.fields.map(x => {
        return renderParamField(x, n.params);
    }).join('') : '<div class="helper">此类型无需参数。如需扩展，可在下方编辑节点 JSON。</div>'}</div></div>`;
    form += renderCondition(n);
    if (n.type === BattleEffectTypeEnum.APPLY_STATUS) {
        const buff = buffRows.find(row => row.id === n.params.status);
        if (buff) {
            form += `<div class="ins-group"><h3>Buff 配置 · ${escapeHtml(buff.name)}</h3><button class="btn tiny" data-edit-buff="${buff.id}">编辑此 Buff</button><p class="helper">${escapeHtml(buff.description)}</p><p class="helper">${escapeHtml(buff.stackMode)} · 最多 ${buff.maxStacks} 层 · ${buff.decayAtTurnEnd ? '默认回合末衰减' : '不自动衰减'}</p>${buff.effects?.length ? `<details><summary>查看能力效果与监听</summary><pre class="pre">${escapeHtml(serializeJson(buff.effects))}</pre></details>` : ''}${Object.keys(buff.rules || {}).length ? `<p class="helper">持续规则</p><pre class="pre">${escapeHtml(serializeJson(buff.rules))}</pre>` : ''}</div>`;
        }
    }
    if (d?.container) {
        form += `<div class="notice">${d.container === 'if' ? 'THEN / ELSE' : 'children'} 是有序子效果数组，直接在中间流程树中添加。${n.type === BattleEffectTypeEnum.REGISTER_TRIGGER ? '触发器的监听生命周期由战斗引擎管理。' : ''}</div><div class="divider"></div>`;
    }
    form += `<div class="ins-group"><h3>高级 JSON（保留所有自定义字段）</h3><div class="ins-stack"><textarea class="textarea mono" spellcheck="false" id="advancedJSON" rows="11">${escapeHtml(serializeJson(n))}</textarea><div id="advanceError" class="helper">手动修改后点击应用；可实现嵌套条件和特殊结构。</div><button class="btn" id="applyNodeJson">应用节点 JSON</button></div></div><div class="split"><button class="btn" data-dup="${escapeAttribute(n.id)}">⧉ 复制步骤</button><button class="btn danger" data-del="${escapeAttribute(n.id)}">删除步骤</button></div>`;
    body.innerHTML = form;
    advancedText = serializeJson(n);
}

/**
 * @returns {void}
 */
function showCatalog(parent = null, branch = 'effect') {
    addContext = { parent, branch };
    catalogFilter = '全部';
    document.getElementById('catalogSearch').value = '';
    document.getElementById('catalogContext').textContent = parent ? `添加到 ${catalog[findNode(parent)?.type]?.label || '效果组'} / ${branch === 'elseEffects' ? 'ELSE' : 'children'}` : '在 effect 数组末尾添加步骤';
    renderCatalog();
    document.getElementById('catalogOverlay').classList.add('show');
    document.getElementById('catalogSearch').focus();
}

/**
 * @returns {void}
 */
function renderCatalog() {
    const q = document.getElementById('catalogSearch').value.trim().toLowerCase();
    document.getElementById('catalogCategories').innerHTML = CATEGORIES.map(x => {
        return `<button class="chip ${x === catalogFilter ? 'active' : ''}" data-cat="${escapeAttribute(x)}">${escapeHtml(x)}</button>`;
    }).join('');
    let matching = Object.values(catalog).filter(x => {
        return (getCurrentCard()?.type !== 'POWER' || x.type === BattleEffectTypeEnum.APPLY_STATUS)
            && (catalogFilter === '全部' || x.cat === catalogFilter) && (x.label + x.type + x.hint + x.cat).toLowerCase().includes(q);
    });
    document.getElementById('catalogGrid').innerHTML = matching.map(d => {
        return `<button class="catalog-option" data-create-type="${d.type}"><strong>${icons[d.cat]} ${escapeHtml(d.label)}</strong><small>${escapeHtml(d.hint)}</small><code>${d.type}</code></button>`;
    }).join('') || '<div class="helper">没有找到匹配效果，请检查效果表中的卡牌可用配置。</div>';
}

/**
 * @returns {void}
 */
function addEffect(type) {
    let c = getCurrentCard();
    if (!c) {
        return;
    }
    if (c.type === 'POWER' && type !== BattleEffectTypeEnum.APPLY_STATUS) {
        showToast('能力牌通过施加 Buff 生效，请将持续效果配置到 Buff 表中');
        return;
    }
    let arr = addContext.parent ? findNode(addContext.parent)?.[addContext.branch] : c.effect;
    if (!Array.isArray(arr)) {
        return showToast('目标节点不可添加子效果');
    }
    let n = createEffect(type);
    if (c.type === 'POWER') {
        n.params.duration = 'COMBAT';
        n.target = 'SELF';
    }
    arr.push(n);
    selectedNode = n.id;
    document.getElementById('catalogOverlay').classList.remove('show');
    scheduleSave();
    renderEditor();
    showToast('已添加 ' + (catalog[type]?.label || type));
}

/**
 * @returns {void}
 */
function moveNode(id, dir) {
    let r = findNodeLocation(id);
    if (!r) {
        return;
    }
    let to = r.index + (dir === 'up' ? -1 : 1);
    if (to < 0 || to >= r.arr.length) {
        return;
    }
    [r.arr[r.index], r.arr[to]] = [r.arr[to], r.arr[r.index]];
    scheduleSave();
    renderEditor();
}

/**
 * @returns {void}
 */
function reassignIds(n) {
    n.id = createNodeId();
    (n.children || []).forEach(reassignIds);
    (n.elseEffects || []).forEach(reassignIds);
}

/**
 * @returns {void}
 */
function duplicateNode(id) {
    let r = findNodeLocation(id);
    if (!r) {
        return;
    }
    let copy = cloneValue(r.node);
    reassignIds(copy);
    r.arr.splice(r.index + 1, 0, copy);
    selectedNode = copy.id;
    scheduleSave();
    renderEditor();
    showToast('已复制效果');
}

/**
 * @returns {void}
 */
function deleteNode(id) {
    let r = findNodeLocation(id);
    if (!r) {
        return;
    }
    if (r.node.children?.length || r.node.elseEffects?.length) {
        if (!confirm('该步骤包含子效果。确认删除整个子树？')) {
            return;
        }
    }
    r.arr.splice(r.index, 1);
    selectedNode = null;
    scheduleSave();
    renderEditor();
}

/**
 * @returns {void}
 */
function downloadFile(name, content, mime = 'application/json') {
    const b = new Blob([content], { type: mime + ';charset=utf-8' }), u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u;
    a.download = name;
    a.click();
    setTimeout(() => {
        return URL.revokeObjectURL(u);
    }, 2000);
}

/**
 * @returns {void}
 */
function closeOverlay() {
    document.querySelectorAll('.overlay').forEach(x => {
        return x.classList.remove('show');
    });
}

// 等待JSON校验完成后更新编辑状态，并向界面报告错误。
/**
 * @returns {Promise<void>}
 */
async function updateParam(el, commit = false) {
    let n = findNode(selectedNode);
    if (!n) {
        return;
    }
    let key = el.dataset.param, kind = el.dataset.kind, raw = kind === 'bool' ? el.checked : el.value;
    if (kind === 'json') {
        const valid = await (async () => {
            n.params[key] = JSON.parse(raw);
            let msg = document.querySelector(`[data-json-error="${key}"]`);
            if (msg) {
                msg.textContent = '✓ JSON 格式正确';
                msg.className = 'helper ok';
            }
            return true;
        })().catch(err => {
            let msg = document.querySelector(`[data-json-error="${key}"]`);
            if (msg) {
                msg.textContent = 'JSON 错误：' + err.message;
                msg.className = 'helper error';
            }
            return false;
        });
        if (!valid) {
            return;
        }
    }
    else if (kind === 'bool') {
        n.params[key] = raw;
    }
    else if (kind === 'number') {
        const value = Number(raw);
        if (!raw.trim() || !Number.isFinite(value)) {
            showToast('请输入有效数值');
            return;
        }
        n.params[key] = value;
    }
    else if (kind === 'expr') {
        n.params[key] = parseScalar(raw);
    }
    else {
        n.params[key] = ['status', 'stat', 'powerId'].includes(key) && /^\d+$/.test(raw) ? Number(raw) : raw;
    }
    scheduleSave();
    if (commit) {
        renderTree();
        renderOutput();
    }
}

/**
 * @returns {void}
 */
function updateConditionField(el) {
    let n = findNode(selectedNode);
    if (!n) {
        return;
    }
    let i = Number(el.dataset.rule), key = el.dataset.conditionField;
    if (!n.condition?.rules?.[i]) {
        return;
    }
    let val = el.value;
    if (key === 'rhs') {
        if (val.trim() === 'true') {
            val = true;
        }
        else if (val.trim() === 'false') {
            val = false;
        }
        else {
            val = parseScalar(val);
        }
    }
    n.condition.rules[i][key] = val;
    scheduleSave();
}

// 等待JSON校验完成后更新编辑状态，并向界面报告错误。
/**
 * @returns {Promise<void>}
 */
async function applyAdvanced() {
    let n = findNode(selectedNode), loc = findNodeLocation(selectedNode);
    if (!n || !loc) {
        return;
    }
    return (async () => {
        let candidate = JSON.parse(document.getElementById('advancedJSON').value);
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) || !candidate.type) {
            throw new Error('必须是带 type 的 JSON 对象');
        }
        let normalized = normalizeNode(candidate);
        normalized.id = n.id;
        let otherIds = new Set();
        walkNodes(getCurrentCard().effect, x => {
            if (x !== n) {
                otherIds.add(x.id);
            }
        });
        let newIds = new Set();
        walkNodes([normalized], x => {
            if (newIds.has(x.id) || otherIds.has(x.id)) {
                throw new Error('存在重复节点 ID：' + x.id);
            }
            newIds.add(x.id);
        });
        loc.arr[loc.index] = normalized;
        scheduleSave();
        renderEditor();
        showToast('已应用节点 JSON');
    })().catch(e => {
        let m = document.getElementById('advanceError');
        m.textContent = 'JSON 应用失败：' + e.message;
        m.className = 'helper error';
    });
}

/**
 * @returns {void}
 */
function handleClick(e) {
    const t = e.target.closest('[data-card],[data-select-node],[data-move],[data-dup],[data-del],[data-add-parent],[data-create-type],[data-cat],[data-close],[data-output]');
    if (!t) {
        return;
    }
    if (t.dataset.card !== undefined) {
        current = t.dataset.card;
        selectedNode = null;
        renderEditor();
    }
    else if (t.dataset.move) {
        e.stopPropagation();
        moveNode(t.dataset.id, t.dataset.move);
    }
    else if (t.dataset.dup) {
        e.stopPropagation();
        duplicateNode(t.dataset.dup);
    }
    else if (t.dataset.del) {
        e.stopPropagation();
        deleteNode(t.dataset.del);
    }
    else if (t.dataset.addParent !== undefined) {
        showCatalog(t.dataset.addParent || null, t.dataset.addBranch || 'effect');
    }
    else if (t.dataset.createType) {
        addEffect(Number(t.dataset.createType));
    }
    else if (t.dataset.cat) {
        catalogFilter = t.dataset.cat;
        renderCatalog();
    }
    else if (t.dataset.close) {
        document.getElementById(t.dataset.close)?.classList.remove('show');
    }
    else if (t.dataset.output) {
        outputTab = t.dataset.output;
        renderOutput();
    }
    else if (t.dataset.selectNode) {
        selectedNode = t.dataset.selectNode;
        renderTree();
        renderInspector();
    }
}
function initializeEffectEditor() {

document.addEventListener('click', handleClick);

document.getElementById('cardSearch').addEventListener('input', renderSidebar);

document.getElementById('catalogSearch').addEventListener('input', renderCatalog);

document.getElementById('catalogOverlay').addEventListener('click', e => {
    if (e.target.id === 'catalogOverlay') {
        closeOverlay();
    }
});

document.getElementById('guideOverlay').addEventListener('click', e => {
    if (e.target.id === 'guideOverlay') {
        closeOverlay();
    }
});

document.getElementById('helpOverlay').addEventListener('click', event => {
    if (event.target.id === 'helpOverlay') {
        closeOverlay();
    }
});

document.addEventListener('click', event => {
    const button = event.target.closest('[data-help]');
    if (!button) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    const field = button.dataset.help;
    const catalogField = Object.values(catalog).flatMap(item => {
        return item.fields;
    }).find(item => {
        return item.key === field;
    });
    const label = catalogField?.label || button.parentElement.textContent.replace('!', '').trim();
    showHelp(field, label, catalogField?.options);
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeOverlay();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveExcel();
    }
});

document.getElementById('inspectorBody').addEventListener('input', e => {
    if (e.target.dataset.param && e.target.dataset.kind !== 'json' && e.target.dataset.kind !== 'bool' && e.target.dataset.kind !== 'enum') {
        updateParam(e.target);
    }
    else if (e.target.dataset.nodeField) {
        let n = findNode(selectedNode);
        if (n) {
            n[e.target.dataset.nodeField] = e.target.value;
        }
        scheduleSave();
    }
    else if (e.target.dataset.conditionField) {
        updateConditionField(e.target);
    }
});

document.getElementById('inspectorBody').addEventListener('change', e => {
    if (e.target.dataset.param) {
        updateParam(e.target, true);
    }
    else if (e.target.dataset.nodeField) {
        let n = findNode(selectedNode);
        if (n) {
            n[e.target.dataset.nodeField] = e.target.value;
        }
        scheduleSave();
        renderTree();
        renderOutput();
    }
    else if (e.target.dataset.conditionField) {
        updateConditionField(e.target);
        renderTree();
        renderOutput();
    }
    else if (e.target.id === 'condOp') {
        let n = findNode(selectedNode);
        if (n) {
            if (!n.condition) {
                n.condition = { op: 'AND', rules: [] };
            }
            n.condition.op = e.target.value;
            scheduleSave();
            renderTree();
            renderOutput();
        }
    }
});

document.getElementById('inspectorBody').addEventListener('click', e => {
    const el = e.target.closest('[data-add-condition],[data-remove-condition],#applyNodeJson');
    if (!el) {
        return;
    }
    let n = findNode(selectedNode);
    if (!n) {
        return;
    }
    if (el.dataset.addCondition) {
        if (!n.condition) {
            n.condition = { op: 'AND', rules: [] };
        }
        if (!Array.isArray(n.condition.rules)) {
            n.condition.rules = [];
        }
        n.condition.rules.push({ lhs: '@target.buff.' + BattleBuffTypeEnum.POISON, cmp: '>=', rhs: 1 });
        scheduleSave();
        renderInspector();
        renderTree();
        renderOutput();
    }
    else if (el.dataset.removeCondition !== undefined) {
        n.condition?.rules?.splice(Number(el.dataset.removeCondition), 1);
        scheduleSave();
        renderInspector();
        renderTree();
        renderOutput();
    }
    else if (el.id === 'applyNodeJson') {
        applyAdvanced();
    }
});

document.getElementById('addRootEffect').onclick = () => {
    return showCatalog();
};

window.addEventListener('beforeunload', event => {
    if (dirty) {
        event.preventDefault();
        event.returnValue = '';
    }
});
}

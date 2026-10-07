// 道具效果参数定义，沿用卡牌效果的 JSON 结构。
const f = (key, label, kind = 'expr', options = null) => {
    return ({ key, label, kind, options });
};
const catalog = {};
function register(cat, rows) { for (const [type, label, hint, defaults, fields = [], container = ''] of rows) {
    catalog[type] = { type, label, hint, cat, defaults, fields, container };
} }
register('基础战斗', [
    ['DAMAGE', '造成伤害', '普通 / 穿透 / 生命损失 / 多段 / 动态伤害', { amount: 6, hits: 1, damageKind: 'ATTACK', ignoreBlock: false }, [f('amount', '单次基础伤害'), f('hits', '攻击次数'), f('damageKind', '伤害类型', 'enum', ['ATTACK', 'THORNS', 'HP_LOSS', 'SPECIAL']), f('ignoreBlock', '无视格挡', 'bool')]],
    ['BLOCK', '获得格挡', '可以使用动态表达式', { amount: 5 }, [f('amount', '格挡值')]],
    ['BLOCK_NEXT_TURN', '下回合格挡', '延迟获得格挡', { amount: 4 }, [f('amount', '格挡值')]],
    ['MULTIPLY_BLOCK', '改变当前格挡', '例如 Entrench 翻倍', { factor: 2 }, [f('factor', '倍率')]],
    ['REMOVE_BLOCK', '移除格挡', '消除目标所有或部分格挡', { amount: 'ALL' }, [f('amount', '数量 / ALL')]],
    ['PIERCE_BLOCK', '融化 / 消去格挡', '直接消除敌人格挡后执行其他效果', { amount: 'ALL' }, [f('amount', '数量 / ALL')]],
    ['HEAL', '回复生命', '可使用 @last_damage.total_hp_loss', { amount: 4 }, [f('amount', '回复量')]],
    ['LOSE_HP', '直接失去生命', '不同于攻击伤害', { amount: 2, canKill: false }, [f('amount', '失去生命'), f('canKill', '可以使玩家死亡', 'bool')]],
    ['KILL_IF', '满足条件直接击杀', '例如血量阈值斩杀', { threshold: 30 }, [f('threshold', '目标当前生命上限')]],
    ['DAMAGE_PER_CARD', '根据卡牌数量造成伤害', '例如攻击牌数量、打击牌数量', { base: 2, filter: { type: 'ATTACK', zone: 'HAND' } }, [f('base', '每张卡提供伤害'), f('filter', '筛选条件 JSON', 'json')]],
    ['SET_DAMAGE_SCALING', '修改永久 / 战斗内成长伤害', '例如 Rampage、仪式匕首', { amount: 5, scope: 'COMBAT', when: 'ON_HIT' }, [f('amount', '成长量'), f('scope', '持续范围', 'enum', ['ACTION', 'TURN', 'COMBAT', 'RUN']), f('when', '结算时机', 'enum', ['ON_PLAY', 'ON_HIT', 'ON_KILL'])]],
]);
register('资源与数值', [
    ['GAIN_GOLD', '获得金币', '可由击杀触发', { amount: 20 }, [f('amount', '金币数量')]],
    ['LOSE_GOLD', '失去金币', '直接减少金币', { amount: 20 }, [f('amount', '金币数量')]],
    ['GAIN_MAX_HP', '提高生命上限', '永久 / 战斗内配置', { amount: 3, scope: 'RUN' }, [f('amount', '生命上限增量'), f('scope', '持续范围', 'enum', ['COMBAT', 'RUN'])]],
    ['LOSE_MAX_HP', '降低生命上限', '生命上限惩罚', { amount: 3, scope: 'RUN' }, [f('amount', '生命上限减少量'), f('scope', '持续范围', 'enum', ['COMBAT', 'RUN'])]],
    ['MODIFY_STAT', '改变基础数值', '力量、敏捷等，支持持续时间', { stat: 'STRENGTH', amount: 2, duration: 'COMBAT' }, [f('stat', '属性', 'enum', ['STRENGTH', 'DEXTERITY', 'HP', 'MAX_HP']), f('amount', '变化量'), f('duration', '有效期', 'enum', ['ACTION', 'TURN', 'NEXT_TURN', 'COMBAT', 'RUN'])]],
    ['SET_STAT', '设置属性', '属性直接修改为指定值', { stat: 'STRENGTH', value: 0 }, [f('stat', '属性', 'enum', ['STRENGTH', 'DEXTERITY', 'BLOCK']), f('value', '目标值')]],
    ['DOUBLE_STAT', '属性翻倍', '例如 Limit Break', { stat: 'STRENGTH' }, [f('stat', '属性', 'enum', ['STRENGTH', 'DEXTERITY'])]],
    ['EXTRA_TURN', '额外回合', '特殊回合流程，追加一个行动回合', { phase: 'PLAYER' }, [f('phase', '额外回合归属', 'enum', ['PLAYER', 'ENEMY'])]],
]);
register('卡牌与牌堆', [
    ['DISCARD', '弃牌', '可由玩家选牌或随机', { count: 1, mode: 'SELECT' }, [f('count', '数量 / ALL'), f('mode', '选择方式', 'enum', ['SELECT', 'RANDOM', 'ALL', 'FILTER']), f('filter', '筛选 JSON', 'json')]],
    ['EXHAUST', '消耗卡牌', '可指定手牌 / 抽牌堆等', { count: 1, zone: 'HAND', mode: 'SELECT' }, [f('count', '数量 / ALL'), f('zone', '来源牌堆', 'enum', ['HAND', 'DRAW', 'DISCARD', 'EXHAUST', 'ANY']), f('mode', '选择方式', 'enum', ['SELECT', 'RANDOM', 'ALL', 'FILTER']), f('filter', '筛选 JSON', 'json')]],
    ['CREATE_CARD', '生成卡牌', '产生临时卡，指定目标牌堆', { cardId: 'shiv', count: 1, zone: 'HAND', temporary: true }, [f('cardId', '卡牌配置 ID', 'text'), f('count', '数量'), f('zone', '生成位置', 'enum', ['HAND', 'DRAW_TOP', 'DRAW_RANDOM', 'DISCARD', 'EXHAUST', 'MASTER_DECK']), f('temporary', '仅当前战斗', 'bool')]],
    ['CREATE_RANDOM_CARD', '生成随机卡牌', '按角色、等级等筛选', { count: 1, pool: 'ANY', zone: 'HAND', filter: {} }, [f('count', '数量'), f('pool', '卡池', 'text'), f('zone', '生成位置', 'enum', ['HAND', 'DRAW_TOP', 'DRAW_RANDOM', 'DISCARD']), f('filter', '卡池筛选 JSON', 'json')]],
    ['SELECT_CARD', '检索 / 选牌', '从牌堆选择卡进入目标区域', { count: 1, source: 'DRAW', destination: 'HAND', filter: {} }, [f('count', '选牌数量'), f('source', '来源', 'enum', ['HAND', 'DRAW', 'DISCARD', 'EXHAUST', 'MASTER_DECK', 'ANY']), f('destination', '目标区域', 'enum', ['HAND', 'DRAW_TOP', 'DRAW_BOTTOM', 'DISCARD', 'EXHAUST']), f('filter', '筛选 JSON', 'json')]],
    ['MOVE_CARDS', '卡牌移动', '批量跨牌堆移动 / 置顶', { count: 1, source: 'DISCARD', destination: 'DRAW_TOP', mode: 'SELECT', filter: {} }, [f('count', '数量 / ALL'), f('source', '来源', 'enum', ['HAND', 'DRAW', 'DISCARD', 'EXHAUST', 'MASTER_DECK']), f('destination', '目标', 'enum', ['HAND', 'DRAW_TOP', 'DRAW_BOTTOM', 'DRAW_RANDOM', 'DISCARD', 'EXHAUST']), f('mode', '模式', 'enum', ['SELECT', 'RANDOM', 'ALL', 'FILTER']), f('filter', '筛选 JSON', 'json')]],
    ['SHUFFLE', '洗牌', '重新洗牌或把弃牌堆洗入抽牌堆', { source: 'DISCARD', destination: 'DRAW' }, [f('source', '来源', 'enum', ['DRAW', 'DISCARD', 'HAND', 'EXHAUST']), f('destination', '目标', 'enum', ['DRAW', 'DISCARD'])]],
    ['UPGRADE_CARD', '升级卡牌', '当前战斗或整局永久升级', { count: 1, zone: 'HAND', mode: 'SELECT', scope: 'COMBAT' }, [f('count', '数量 / ALL'), f('zone', '来源', 'enum', ['HAND', 'DRAW', 'DISCARD', 'ALL_PILES', 'MASTER_DECK']), f('mode', '方式', 'enum', ['SELECT', 'RANDOM', 'ALL']), f('scope', '有效期', 'enum', ['COMBAT', 'RUN'])]],
    ['TRANSFORM_CARD', '转化卡牌', '重随机或转成指定卡牌', { count: 1, zone: 'MASTER_DECK', pool: 'RANDOM' }, [f('count', '数量'), f('zone', '来源', 'enum', ['HAND', 'DRAW', 'MASTER_DECK']), f('pool', '目标池或卡牌 ID', 'text')]],
    ['COPY_CARD', '复制卡牌', '复制后放入手牌、弃牌或抽牌', { source: 'SELECTED', count: 1, destination: 'HAND' }, [f('source', '复制对象', 'enum', ['SELECTED', 'PLAYED', 'TOP_DRAW', 'LAST_PLAYED', 'CAPTURED']), f('count', '复制数量'), f('destination', '位置', 'enum', ['HAND', 'DRAW_TOP', 'DRAW_RANDOM', 'DISCARD', 'MASTER_DECK'])]],
    ['PLAY_CARD', '自动打出卡牌', '从指定区域检索后打出', { source: 'DRAW_TOP', count: 1, exhaustAfter: false }, [f('source', '来源', 'enum', ['DRAW_TOP', 'DRAW_RANDOM', 'DISCARD_SELECT', 'HAND_SELECT', 'EXHAUST_SELECT']), f('count', '数量'), f('exhaustAfter', '打出后消耗', 'bool')]],
    ['REPLAY_CARD', '重复打出效果', '再次执行一张卡牌的效果', { times: 1, filter: { type: 'ATTACK' } }, [f('times', '追加结算次数'), f('filter', '作用对象 JSON', 'json')]],
    ['MODIFY_CARD_VALUE', '成长卡牌数值', '例如玻璃刀衰减、灼热攻击持续成长', { field: 'DAMAGE', delta: 2, scope: 'COMBAT', source: 'THIS_CARD' }, [f('field', '卡牌属性', 'enum', ['DAMAGE', 'BLOCK', 'MAGIC']), f('delta', '增量（负值减少）'), f('scope', '有效期', 'enum', ['TURN', 'COMBAT', 'RUN']), f('source', '卡牌对象', 'enum', ['THIS_CARD', 'SELECTED', 'PLAYED', 'ALL_MATCHING'])]],
    ['SET_CARD_FLAG', '设置卡牌属性', '保留 / 消耗 / 虚无 / 固有等', { flag: 'RETAIN', value: true, zone: 'HAND', mode: 'SELECT', duration: 'COMBAT' }, [f('flag', '属性', 'enum', ['RETAIN', 'EXHAUST', 'ETHEREAL', 'INNATE', 'UNPLAYABLE', 'AUTOPLAY']), f('value', '启用属性', 'bool'), f('zone', '来源', 'enum', ['HAND', 'DRAW', 'DISCARD', 'ALL_PILES']), f('mode', '选择方式', 'enum', ['SELECT', 'RANDOM', 'ALL']), f('duration', '有效期', 'enum', ['TURN', 'COMBAT', 'RUN'])]],
    ['DISCARD_HAND', '弃掉整手牌', '例如计算下注', { exceptFilter: {} }, [f('exceptFilter', '保留筛选 JSON', 'json')]],
    ['EXHAUST_HAND', '消耗整手牌', '例如恶魔之焰', { exceptFilter: {} }, [f('exceptFilter', '保留筛选 JSON', 'json')]],
    ['EXHAUST_THIS_CARD', '消耗这张卡', '例如虚无状态抽入手牌后立即消耗', {}, []],
    ['RETURN_CARD', '将卡牌返回手牌', '例如消耗堆回收 / 弹回', { from: 'DISCARD', count: 1, filter: {} }, [f('from', '来源', 'enum', ['DISCARD', 'EXHAUST', 'DRAW']), f('count', '数量'), f('filter', '筛选 JSON', 'json')]],
    ['REORDER_DRAW', '调整抽牌堆顺序', '调整抽牌堆顶部顺序', { count: 3 }, [f('count', '查看顶部数量')]],
]);
register('状态与能力', [
    ['APPLY_STATUS', '施加增益 / 减益', '力量、敏捷、虚弱、中毒、易伤、人工制品等', { status: 'WEAK', stacks: 2, duration: 'DEFAULT' }, [f('status', '状态 ID', 'text'), f('stacks', '层数'), f('duration', '持续时间', 'enum', ['DEFAULT', 'TURN', 'NEXT_TURN', 'COMBAT', 'RUN'])]],
    ['REMOVE_STATUS', '移除状态', '可移除全部或部分层数', { status: 'WEAK', stacks: 'ALL' }, [f('status', '状态 ID / ALL', 'text'), f('stacks', '移除层数 / ALL')]],
    ['MULTIPLY_STATUS', '按倍率修改状态层数', '例如 Catalyst 将中毒翻倍', { status: 'POISON', factor: 2 }, [f('status', '状态 ID', 'text'), f('factor', '倍率')]],
    ['TRANSFER_STATUS', '转移状态', '在自己与敌人之间转移状态', { status: 'POISON', amount: 'ALL', destination: 'ENEMY' }, [f('status', '状态 ID', 'text'), f('amount', '转移层数 / ALL'), f('destination', '目标', 'enum', ['SELF', 'ENEMY'])]],
    ['CLEANSE', '清除不利状态', '按规则清除减益', { filter: { kind: 'DEBUFF' } }, [f('filter', '状态筛选 JSON', 'json')]],
    ['SET_INTANGIBLE', '无实体', '减少战斗伤害的能力', { stacks: 1 }, [f('stacks', '层数')]],
    ['SET_INVINCIBLE', '伤害 / 生命损失上限', '特殊减伤机制', { cap: 15, duration: 'TURN' }, [f('cap', '上限值'), f('duration', '期限', 'enum', ['TURN', 'COMBAT'])]],
    ['APPLY_TEMP_STAT', '临时属性', '回合结束时恢复原值，例如 Piercing Wail', { stat: 'STRENGTH', amount: -6, restoreAt: 'END_TURN' }, [f('stat', '属性', 'enum', ['STRENGTH', 'DEXTERITY']), f('amount', '变化量'), f('restoreAt', '恢复时机', 'enum', ['END_TURN', 'START_NEXT_TURN'])]],
    ['REGISTER_POWER', '获得持续能力', '使用能力 ID 和参数，由战斗引擎实现', { powerId: 'METALLICIZE', stacks: 3, params: {} }, [f('powerId', '能力 ID', 'text'), f('stacks', '层数'), f('params', '额外参数 JSON', 'json')]],
    ['REMOVE_POWER', '移除持续能力', '根据能力 ID 解除', { powerId: 'METALLICIZE' }, [f('powerId', '能力 ID', 'text')]],
]);
register('流程与触发', [
    ['IF', '条件分支', '满足条件走 THEN，不满足走 ELSE', {}, [], 'if'],
    ['SEQUENCE', '效果组 / 顺序执行', '把多效果打包成一个步骤', {}, [], 'children'],
    ['REPEAT', '循环执行', '固定或动态次数的多段效果', { count: 2, maxIterations: 30 }, [f('count', '重复次数'), f('maxIterations', '安全上限', 'number')], 'children'],
    ['FOR_EACH', '遍历对象', '遍历牌堆中的卡牌，子效果引用 @item', { source: 'HAND', filter: {} }, [f('source', '遍历集合', 'enum', ['HAND', 'DRAW', 'DISCARD', 'EXHAUST', 'ALL_PILES', 'PLAYED_THIS_TURN']), f('filter', '筛选条件 JSON', 'json')], 'children'],
    ['REGISTER_TRIGGER', '注册能力 / 持续触发', '配置事件、监听过滤器、次数和持续范围', { event: 'ON_TURN_START', scope: 'COMBAT', limit: 0, filter: {} }, [f('event', '触发事件', 'enum', ['ON_COMBAT_START', 'ON_TURN_START', 'ON_TURN_END', 'ON_CARD_DRAWN', 'ON_CARD_PLAYED', 'ON_ATTACK_PLAYED', 'ON_SKILL_PLAYED', 'ON_POWER_PLAYED', 'ON_DISCARD', 'ON_EXHAUST', 'ON_SHUFFLE', 'ON_DAMAGE_DEALT', 'ON_DAMAGE_TAKEN', 'ON_HP_LOSS', 'ON_ENEMY_DIED', 'ON_CARD_CREATED', 'ON_COMBAT_END']), f('scope', '有效期', 'enum', ['TURN', 'NEXT_TURN', 'COMBAT', 'RUN']), f('limit', '最多触发次数（0=不限）', 'number'), f('filter', '事件过滤 JSON', 'json')], 'children'],
    ['SCHEDULE', '延迟执行', '下回合或在指定时机执行；可快照选定卡', { when: 'NEXT_TURN_START', times: 1, capture: {} }, [f('when', '执行时机', 'enum', ['NEXT_TURN_START', 'NEXT_TURN_END', 'TURN_END', 'COMBAT_END', 'AFTER_ENEMY_TURN']), f('times', '执行次数'), f('capture', '执行上下文快照 JSON', 'json')], 'children'],
    ['CHOOSE_ONE', '让玩家选择一项', '每个直接子节点代表一个可选效果；多个效果可用 SEQUENCE', { maxChoices: 1, showCount: 3 }, [f('maxChoices', '选择数量'), f('showCount', '展示选项数量')], 'children'],
    ['RANDOM_CHOICE', '从子效果中随机选取', '按数量从选项中选择，不重复可配置', { count: 1, unique: true }, [f('count', '选择数量'), f('unique', '不重复', 'bool')], 'children'],
    ['SET_VARIABLE', '设置临时变量', '例如记录本次伤害总量', { name: 'temp', value: 0, scope: 'ACTION' }, [f('name', '变量名', 'text'), f('value', '数值 / 表达式'), f('scope', '作用域', 'enum', ['ACTION', 'TURN', 'COMBAT'])]],
    ['MODIFY_VARIABLE', '修改临时变量', '变量加法或乘法', { name: 'temp', operator: 'ADD', value: 1 }, [f('name', '变量名', 'text'), f('operator', '操作', 'enum', ['ADD', 'MULTIPLY', 'SET', 'MIN', 'MAX']), f('value', '值 / 表达式')]],
    ['BREAK_LOOP', '终止当前循环', '需要循环处理器支持', {}, []],
]);
register('特殊机制', [
    ['GENERATE_REWARD', '生成战后奖励', '卡牌 / 金币 / 药水等', { reward: 'CARD', amount: 1, pool: 'ANY' }, [f('reward', '奖励', 'enum', ['CARD', 'GOLD', 'POTION', 'RELIC']), f('amount', '数量'), f('pool', '奖励池', 'text')]],
    ['GAIN_POTION', '获得药水', '生成药水；满槽时按照引擎规则处理', { potionId: 'RANDOM', count: 1 }, [f('potionId', '药水 ID / RANDOM', 'text'), f('count', '数量')]],
    ['GAIN_RELIC', '获得遗物', '战斗奖励或特殊卡牌提供遗物', { relicId: 'RANDOM' }, [f('relicId', '遗物 ID / RANDOM', 'text')]],
    ['REMOVE_CARD_FROM_DECK', '永久移除卡牌', '从主卡组移除目标卡', { count: 1, mode: 'SELECT' }, [f('count', '数量'), f('mode', '方式', 'enum', ['SELECT', 'RANDOM', 'ALL'])]],
    ['END_TURN', '结束当前回合', '结算并结束回合', { skipEndTriggers: false }, [f('skipEndTriggers', '跳过回合结束事件', 'bool')]],
    ['END_COMBAT', '直接结束战斗', '由引擎验证胜负条件', { result: 'VICTORY' }, [f('result', '结果', 'enum', ['VICTORY', 'DEFEAT'])]],
    ['MODIFY_COMBAT_RULE', '修改战斗规则', '格挡保留、伤害封顶等', { rule: 'BLOCK_PERSISTS', value: true, scope: 'COMBAT', filter: {} }, [f('rule', '规则 ID', 'text'), f('value', '值 JSON', 'json'), f('scope', '有效期', 'enum', ['TURN', 'COMBAT', 'RUN']), f('filter', '筛选 JSON', 'json')]],
    ['CUSTOM', '自定义脚本处理器', '极端特殊效果可由引擎注册 resolver', { handler: 'my_special_effect', args: {} }, [f('handler', '处理器名称', 'text'), f('args', '参数 JSON', 'json')]],
]);

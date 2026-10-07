'use strict';
// 装备效果目录，沿用 BattleEffect JSON，参数使用 camelCase。
module.exports = {
    "DAMAGE": {
        "type": "DAMAGE",
        "label": "造成伤害",
        "hint": "普通 / 穿透 / 生命损失 / 多段 / 动态伤害",
        "cat": "基础战斗",
        "defaults": {
            "amount": 6,
            "hits": 1,
            "damageKind": "ATTACK",
            "ignoreBlock": false
        },
        "fields": [
            {
                "key": "amount",
                "label": "单次基础伤害",
                "kind": "expr",
                "options": null
            },
            {
                "key": "hits",
                "label": "攻击次数",
                "kind": "expr",
                "options": null
            },
            {
                "key": "damageKind",
                "label": "伤害类型",
                "kind": "enum",
                "options": [
                    "ATTACK",
                    "THORNS",
                    "HP_LOSS",
                    "SPECIAL"
                ]
            },
            {
                "key": "ignoreBlock",
                "label": "无视格挡",
                "kind": "bool",
                "options": null
            }
        ],
        "container": ""
    },
    "BLOCK": {
        "type": "BLOCK",
        "label": "获得格挡",
        "hint": "可以使用动态表达式",
        "cat": "基础战斗",
        "defaults": {
            "amount": 5,
            "scale": true
        },
        "fields": [
            {
                "key": "amount",
                "label": "格挡值",
                "kind": "expr",
                "options": null
            },
            {
                "key": "scale",
                "label": "受敏捷 / 脆弱影响",
                "kind": "bool",
                "options": null
            }
        ],
        "container": ""
    },
    "HEAL": {
        "type": "HEAL",
        "label": "回复生命",
        "hint": "可使用 @last_damage.total_hp_loss",
        "cat": "基础战斗",
        "defaults": {
            "amount": 4
        },
        "fields": [
            {
                "key": "amount",
                "label": "回复量",
                "kind": "expr",
                "options": null
            }
        ],
        "container": ""
    },
    "LOSE_HP": {
        "type": "LOSE_HP",
        "label": "直接失去生命",
        "hint": "不同于攻击伤害",
        "cat": "基础战斗",
        "defaults": {
            "amount": 2,
            "canKill": false
        },
        "fields": [
            {
                "key": "amount",
                "label": "失去生命",
                "kind": "expr",
                "options": null
            },
            {
                "key": "canKill",
                "label": "可以使玩家死亡",
                "kind": "bool",
                "options": null
            }
        ],
        "container": ""
    },
    "KILL_IF": {
        "type": "KILL_IF",
        "label": "满足条件直接击杀",
        "hint": "例如血量阈值斩杀",
        "cat": "基础战斗",
        "defaults": {
            "threshold": 30
        },
        "fields": [
            {
                "key": "threshold",
                "label": "目标当前生命上限",
                "kind": "expr",
                "options": null
            }
        ],
        "container": ""
    },
    "MULTIPLY_BLOCK": {
        "type": "MULTIPLY_BLOCK",
        "label": "改变当前格挡",
        "hint": "例如 Entrench 翻倍",
        "cat": "基础战斗",
        "defaults": {
            "factor": 2
        },
        "fields": [
            {
                "key": "factor",
                "label": "倍率",
                "kind": "expr",
                "options": null
            }
        ],
        "container": ""
    },
    "REMOVE_BLOCK": {
        "type": "REMOVE_BLOCK",
        "label": "移除格挡",
        "hint": "消除目标所有或部分格挡",
        "cat": "基础战斗",
        "defaults": {
            "amount": "ALL"
        },
        "fields": [
            {
                "key": "amount",
                "label": "数量 / ALL",
                "kind": "expr",
                "options": null
            }
        ],
        "container": ""
    },
    "PIERCE_BLOCK": {
        "type": "PIERCE_BLOCK",
        "label": "融化 / 消去格挡",
        "hint": "直接消除敌人格挡后执行其他效果",
        "cat": "基础战斗",
        "defaults": {
            "amount": "ALL"
        },
        "fields": [
            {
                "key": "amount",
                "label": "数量 / ALL",
                "kind": "expr",
                "options": null
            }
        ],
        "container": ""
    },
    "BLOCK_NEXT_TURN": {
        "type": "BLOCK_NEXT_TURN",
        "label": "下回合格挡",
        "hint": "延迟获得格挡",
        "cat": "基础战斗",
        "defaults": {
            "amount": 4
        },
        "fields": [
            {
                "key": "amount",
                "label": "格挡值",
                "kind": "expr",
                "options": null
            }
        ],
        "container": ""
    },
    "APPLY_STATUS": {
        "type": "APPLY_STATUS",
        "label": "施加增益 / 减益",
        "hint": "力量、敏捷、虚弱、中毒、易伤、人工制品等",
        "cat": "状态与能力",
        "defaults": {
            "status": "WEAK",
            "stacks": 2,
            "duration": "DEFAULT"
        },
        "fields": [
            {
                "key": "status",
                "label": "状态 ID",
                "kind": "text",
                "options": null
            },
            {
                "key": "stacks",
                "label": "层数",
                "kind": "expr",
                "options": null
            },
            {
                "key": "duration",
                "label": "持续时间",
                "kind": "enum",
                "options": [
                    "DEFAULT",
                    "TURN",
                    "NEXT_TURN",
                    "COMBAT",
                    "RUN"
                ]
            }
        ],
        "container": ""
    },
    "REMOVE_STATUS": {
        "type": "REMOVE_STATUS",
        "label": "移除状态",
        "hint": "可移除全部或部分层数",
        "cat": "状态与能力",
        "defaults": {
            "status": "WEAK",
            "stacks": "ALL"
        },
        "fields": [
            {
                "key": "status",
                "label": "状态 ID / ALL",
                "kind": "text",
                "options": null
            },
            {
                "key": "stacks",
                "label": "移除层数 / ALL",
                "kind": "expr",
                "options": null
            }
        ],
        "container": ""
    },
    "MULTIPLY_STATUS": {
        "type": "MULTIPLY_STATUS",
        "label": "按倍率修改状态层数",
        "hint": "例如 Catalyst 将中毒翻倍",
        "cat": "状态与能力",
        "defaults": {
            "status": "POISON",
            "factor": 2
        },
        "fields": [
            {
                "key": "status",
                "label": "状态 ID",
                "kind": "text",
                "options": null
            },
            {
                "key": "factor",
                "label": "倍率",
                "kind": "expr",
                "options": null
            }
        ],
        "container": ""
    },
    "TRANSFER_STATUS": {
        "type": "TRANSFER_STATUS",
        "label": "转移状态",
        "hint": "在自己与敌人之间转移状态",
        "cat": "状态与能力",
        "defaults": {
            "status": "POISON",
            "amount": "ALL",
            "destination": "ENEMY"
        },
        "fields": [
            {
                "key": "status",
                "label": "状态 ID",
                "kind": "text",
                "options": null
            },
            {
                "key": "amount",
                "label": "转移层数 / ALL",
                "kind": "expr",
                "options": null
            },
            {
                "key": "destination",
                "label": "目标",
                "kind": "enum",
                "options": [
                    "SELF",
                    "ENEMY"
                ]
            }
        ],
        "container": ""
    },
    "CLEANSE": {
        "type": "CLEANSE",
        "label": "清除不利状态",
        "hint": "按规则清除减益",
        "cat": "状态与能力",
        "defaults": {
            "filter": {
                "kind": "DEBUFF"
            }
        },
        "fields": [
            {
                "key": "filter",
                "label": "状态筛选 JSON",
                "kind": "json",
                "options": null
            }
        ],
        "container": ""
    },
    "MODIFY_STAT": {
        "type": "MODIFY_STAT",
        "label": "改变基础数值",
        "hint": "力量、敏捷等，支持持续时间",
        "cat": "资源与数值",
        "defaults": {
            "stat": "STRENGTH",
            "amount": 2,
            "duration": "COMBAT"
        },
        "fields": [
            {
                "key": "stat",
                "label": "属性",
                "kind": "enum",
                "options": [
                    "STRENGTH",
                    "DEXTERITY",
                    "HP",
                    "MAX_HP"
                ]
            },
            {
                "key": "amount",
                "label": "变化量",
                "kind": "expr",
                "options": null
            },
            {
                "key": "duration",
                "label": "有效期",
                "kind": "enum",
                "options": [
                    "ACTION",
                    "TURN",
                    "NEXT_TURN",
                    "COMBAT",
                    "RUN"
                ]
            }
        ],
        "container": ""
    },
    "SET_STAT": {
        "type": "SET_STAT",
        "label": "设置属性",
        "hint": "属性直接修改为指定值",
        "cat": "资源与数值",
        "defaults": {
            "stat": "STRENGTH",
            "value": 0
        },
        "fields": [
            {
                "key": "stat",
                "label": "属性",
                "kind": "enum",
                "options": [
                    "STRENGTH",
                    "DEXTERITY",
                    "BLOCK"
                ]
            },
            {
                "key": "value",
                "label": "目标值",
                "kind": "expr",
                "options": null
            }
        ],
        "container": ""
    },
    "DOUBLE_STAT": {
        "type": "DOUBLE_STAT",
        "label": "属性翻倍",
        "hint": "例如 Limit Break",
        "cat": "资源与数值",
        "defaults": {
            "stat": "STRENGTH"
        },
        "fields": [
            {
                "key": "stat",
                "label": "属性",
                "kind": "enum",
                "options": [
                    "STRENGTH",
                    "DEXTERITY"
                ]
            }
        ],
        "container": ""
    },
    "SET_INTANGIBLE": {
        "type": "SET_INTANGIBLE",
        "label": "无实体",
        "hint": "减少战斗伤害的能力",
        "cat": "状态与能力",
        "defaults": {
            "stacks": 1
        },
        "fields": [
            {
                "key": "stacks",
                "label": "层数",
                "kind": "expr",
                "options": null
            }
        ],
        "container": ""
    },
    "IF": {
        "type": "IF",
        "label": "条件分支",
        "hint": "满足条件走 THEN，不满足走 ELSE",
        "cat": "流程与触发",
        "defaults": {},
        "fields": [],
        "container": "if"
    },
    "SEQUENCE": {
        "type": "SEQUENCE",
        "label": "效果组 / 顺序执行",
        "hint": "把多效果打包成一个步骤",
        "cat": "流程与触发",
        "defaults": {},
        "fields": [],
        "container": "children"
    },
    "REPEAT": {
        "type": "REPEAT",
        "label": "循环执行",
        "hint": "固定或动态次数的多段效果",
        "cat": "流程与触发",
        "defaults": {
            "count": 2,
            "maxIterations": 30
        },
        "fields": [
            {
                "key": "count",
                "label": "重复次数",
                "kind": "expr",
                "options": null
            },
            {
                "key": "maxIterations",
                "label": "安全上限",
                "kind": "number",
                "options": null
            }
        ],
        "container": "children"
    },
    "REGISTER_TRIGGER": {
        "type": "REGISTER_TRIGGER",
        "label": "注册能力 / 持续触发",
        "hint": "战斗初始化时注册监听，事件发生后执行 children。ON_HAND_READY：正常补手牌后；ON_BEFORE_CARD_PLAYED：出牌前；ON_BLOCK_CARD_PLAYED：打出的卡牌实际产生格挡后；ON_CARD_DAMAGE_DEALT：卡牌单次攻击后；ON_ENERGY_SPENT：补牌、抽牌、重投等实际扣除能量后。limit=0 表示不限次数，条件满足次数需用变量记录。",
        "cat": "流程与触发",
        "defaults": {
            "event": "ON_TURN_START",
            "scope": "COMBAT",
            "limit": 0,
            "filter": {}
        },
        "fields": [
            {
                "key": "event",
                "label": "触发事件",
                "kind": "enum",
                "options": [
                    "ON_COMBAT_START",
                    "ON_TURN_START",
                    "ON_TURN_END",
                    "ON_CARD_PLAYED",
                    "ON_ATTACK_PLAYED",
                    "ON_SKILL_PLAYED",
                    "ON_POWER_PLAYED",
                    "ON_DISCARD",
                    "ON_EXHAUST",
                    "ON_DAMAGE_DEALT",
                    "ON_DAMAGE_TAKEN",
                    "ON_HP_LOSS",
                    "ON_ENEMY_DIED",
                    "ON_COMBAT_END",
                    "ON_HAND_READY",
                    "ON_BEFORE_CARD_PLAYED",
                    "ON_BLOCK_CARD_PLAYED",
                    "ON_CARD_DAMAGE_DEALT",
                    "ON_ENERGY_CHANGED",
                    "ON_ENERGY_SPENT"
                ]
            },
            {
                "key": "scope",
                "label": "有效期",
                "kind": "enum",
                "options": [
                    "TURN",
                    "NEXT_TURN",
                    "COMBAT",
                    "RUN"
                ]
            },
            {
                "key": "limit",
                "label": "最多触发次数（0=不限）",
                "kind": "number",
                "options": null
            },
            {
                "key": "filter",
                "label": "事件过滤 JSON",
                "kind": "json",
                "options": null
            }
        ],
        "container": "children"
    },
    "SCHEDULE": {
        "type": "SCHEDULE",
        "label": "延迟执行",
        "hint": "下回合或在指定时机执行；可快照选定卡",
        "cat": "流程与触发",
        "defaults": {
            "when": "NEXT_TURN_START",
            "times": 1,
            "capture": {}
        },
        "fields": [
            {
                "key": "when",
                "label": "执行时机",
                "kind": "enum",
                "options": [
                    "NEXT_TURN_START",
                    "NEXT_TURN_END",
                    "TURN_END",
                    "COMBAT_END",
                    "AFTER_ENEMY_TURN"
                ]
            },
            {
                "key": "times",
                "label": "执行次数",
                "kind": "expr",
                "options": null
            },
            {
                "key": "capture",
                "label": "执行上下文快照 JSON",
                "kind": "json",
                "options": null
            }
        ],
        "container": "children"
    },
    "CHOOSE_ONE": {
        "type": "CHOOSE_ONE",
        "label": "让玩家选择一项",
        "hint": "每个直接子节点代表一个可选效果；多个效果可用 SEQUENCE",
        "cat": "流程与触发",
        "defaults": {
            "maxChoices": 1,
            "showCount": 3
        },
        "fields": [
            {
                "key": "maxChoices",
                "label": "选择数量",
                "kind": "expr",
                "options": null
            },
            {
                "key": "showCount",
                "label": "展示选项数量",
                "kind": "expr",
                "options": null
            }
        ],
        "container": "children"
    },
    "RANDOM_CHOICE": {
        "type": "RANDOM_CHOICE",
        "label": "从子效果中随机选取",
        "hint": "按数量从选项中选择，不重复可配置",
        "cat": "流程与触发",
        "defaults": {
            "count": 1,
            "unique": true
        },
        "fields": [
            {
                "key": "count",
                "label": "选择数量",
                "kind": "expr",
                "options": null
            },
            {
                "key": "unique",
                "label": "不重复",
                "kind": "bool",
                "options": null
            }
        ],
        "container": "children"
    },
    "DISCARD": {
        "type": "DISCARD",
        "label": "弃牌",
        "hint": "可由玩家选牌或随机",
        "cat": "卡牌与牌堆",
        "defaults": {
            "count": 1,
            "mode": "SELECT"
        },
        "fields": [
            {
                "key": "count",
                "label": "数量 / ALL",
                "kind": "expr",
                "options": null
            },
            {
                "key": "mode",
                "label": "选择方式",
                "kind": "enum",
                "options": [
                    "SELECT",
                    "RANDOM",
                    "ALL",
                    "FILTER"
                ]
            },
            {
                "key": "filter",
                "label": "筛选 JSON",
                "kind": "json",
                "options": null
            }
        ],
        "container": ""
    },
    "EXHAUST": {
        "type": "EXHAUST",
        "label": "消耗卡牌",
        "hint": "可指定手牌 / 抽牌堆等",
        "cat": "卡牌与牌堆",
        "defaults": {
            "count": 1,
            "zone": "HAND",
            "mode": "SELECT"
        },
        "fields": [
            {
                "key": "count",
                "label": "数量 / ALL",
                "kind": "expr",
                "options": null
            },
            {
                "key": "zone",
                "label": "来源牌堆",
                "kind": "enum",
                "options": [
                    "HAND",
                    "DRAW",
                    "DISCARD",
                    "EXHAUST",
                    "ANY"
                ]
            },
            {
                "key": "mode",
                "label": "选择方式",
                "kind": "enum",
                "options": [
                    "SELECT",
                    "RANDOM",
                    "ALL",
                    "FILTER"
                ]
            },
            {
                "key": "filter",
                "label": "筛选 JSON",
                "kind": "json",
                "options": null
            }
        ],
        "container": ""
    },
    "DISCARD_HAND": {
        "type": "DISCARD_HAND",
        "label": "弃掉整手牌",
        "hint": "例如计算下注",
        "cat": "卡牌与牌堆",
        "defaults": {
            "exceptFilter": {}
        },
        "fields": [
            {
                "key": "exceptFilter",
                "label": "保留筛选 JSON",
                "kind": "json",
                "options": null
            }
        ],
        "container": ""
    },
    "EXHAUST_HAND": {
        "type": "EXHAUST_HAND",
        "label": "消耗整手牌",
        "hint": "例如恶魔之焰",
        "cat": "卡牌与牌堆",
        "defaults": {
            "exceptFilter": {}
        },
        "fields": [
            {
                "key": "exceptFilter",
                "label": "保留筛选 JSON",
                "kind": "json",
                "options": null
            }
        ],
        "container": ""
    },
    "GAIN_GOLD": {
        "type": "GAIN_GOLD",
        "label": "获得金币",
        "hint": "可由击杀触发",
        "cat": "资源与数值",
        "defaults": {
            "amount": 20
        },
        "fields": [
            {
                "key": "amount",
                "label": "金币数量",
                "kind": "expr",
                "options": null
            }
        ],
        "container": ""
    },
    "LOSE_GOLD": {
        "type": "LOSE_GOLD",
        "label": "失去金币",
        "hint": "直接减少金币",
        "cat": "资源与数值",
        "defaults": {
            "amount": 20
        },
        "fields": [
            {
                "key": "amount",
                "label": "金币数量",
                "kind": "expr",
                "options": null
            }
        ],
        "container": ""
    },
    "SET_VARIABLE": {
        "type": "SET_VARIABLE",
        "label": "设置临时变量",
        "hint": "例如记录本次伤害总量",
        "cat": "流程与触发",
        "defaults": {
            "name": "temp",
            "value": 0,
            "scope": "ACTION"
        },
        "fields": [
            {
                "key": "name",
                "label": "变量名",
                "kind": "text",
                "options": null
            },
            {
                "key": "value",
                "label": "数值 / 表达式",
                "kind": "expr",
                "options": null
            },
            {
                "key": "scope",
                "label": "作用域",
                "kind": "enum",
                "options": [
                    "ACTION",
                    "TURN",
                    "COMBAT"
                ]
            }
        ],
        "container": ""
    },
    "MODIFY_VARIABLE": {
        "type": "MODIFY_VARIABLE",
        "label": "修改临时变量",
        "hint": "变量加法或乘法",
        "cat": "流程与触发",
        "defaults": {
            "name": "temp",
            "operator": "ADD",
            "value": 1,
            "scope": "ACTION"
        },
        "fields": [
            {
                "key": "name",
                "label": "变量名",
                "kind": "text",
                "options": null
            },
            {
                "key": "operator",
                "label": "操作",
                "kind": "enum",
                "options": [
                    "ADD",
                    "MULTIPLY",
                    "SET",
                    "MIN",
                    "MAX"
                ]
            },
            {
                "key": "value",
                "label": "值 / 表达式",
                "kind": "expr",
                "options": null
            },
            {
                "key": "scope",
                "label": "作用域",
                "kind": "enum",
                "options": [
                    "ACTION",
                    "TURN",
                    "COMBAT"
                ]
            }
        ],
        "container": ""
    },
    "MODIFY_CARD_VALUE": {
        "type": "MODIFY_CARD_VALUE",
        "label": "修改卡牌伤害 / 格挡",
        "hint": "只影响实际打出的卡牌，不影响道具、装备反击或持续触发。COMBAT 为本场每次效果加成；NEXT_CARD 为下一张攻击牌的首次攻击伤害或下一张实际获得格挡的卡牌首次格挡加成，消耗一次后清除。",
        "cat": "装备与资源",
        "defaults": {
            "kind": "DAMAGE",
            "amount": 2,
            "timing": "COMBAT"
        },
        "fields": [
            {
                "key": "kind",
                "label": "数值类型",
                "kind": "enum",
                "options": [
                    "DAMAGE",
                    "BLOCK"
                ]
            },
            {
                "key": "amount",
                "label": "增加量",
                "kind": "expr",
                "options": null
            },
            {
                "key": "timing",
                "label": "生效时机",
                "kind": "enum",
                "options": [
                    "COMBAT",
                    "NEXT_CARD"
                ]
            }
        ],
        "container": ""
    },
    "GAIN_ENERGY": {
        "type": "GAIN_ENERGY",
        "label": "获得能量",
        "hint": "直接增加玩家当前能量，受角色能量上限限制。超过上限的部分不会储存；不会伪装成 Buff。",
        "cat": "装备与资源",
        "defaults": {
            "amount": 1
        },
        "fields": [
            {
                "key": "amount",
                "label": "能量数量",
                "kind": "expr",
                "options": null
            }
        ],
        "container": ""
    },
    "DRAW": {
        "type": "DRAW",
        "label": "额外抽牌",
        "hint": "免费额外抽牌，允许本回合手牌超过正常5张。首回合额外抽牌用 ON_HAND_READY，保证在正常补足5张后生效。打牌仍按规则消耗1点能量自动补牌；装备额外抽牌不扣能量。",
        "cat": "装备与资源",
        "defaults": {
            "count": 1
        },
        "fields": [
            {
                "key": "count",
                "label": "抽牌数量",
                "kind": "expr",
                "options": null
            }
        ],
        "container": ""
    },
    "RETAIN_BLOCK": {
        "type": "RETAIN_BLOCK",
        "label": "增加格挡保留上限",
        "hint": "在自己的下回合开始清空格挡时，保留现有剩余格挡，最多保留配置数量；不会凭空增加格挡。多件装备的保留上限累加，已有 BARRICADE 时保留全部格挡。",
        "cat": "装备与资源",
        "defaults": {
            "amount": 6
        },
        "fields": [
            {
                "key": "amount",
                "label": "增加保留上限",
                "kind": "expr",
                "options": null
            }
        ],
        "container": ""
    },
    "FREE_DICE": {
        "type": "FREE_DICE",
        "label": "下一张卡牌免骰子",
        "hint": "下一张合法卡牌可无视骰子触发条件，不消耗骰子；不可打出的卡牌仍不能使用。打牌后的能量补牌费用保持不变。TURN 在回合结束后失效，COMBAT 本场有效。",
        "cat": "装备与资源",
        "defaults": {
            "count": 1,
            "scope": "TURN"
        },
        "fields": [
            {
                "key": "count",
                "label": "免骰子出牌次数",
                "kind": "expr",
                "options": null
            },
            {
                "key": "scope",
                "label": "有效期",
                "kind": "enum",
                "options": [
                    "TURN",
                    "COMBAT"
                ]
            }
        ],
        "container": ""
    }
};

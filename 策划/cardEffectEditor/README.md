# 卡牌效果编辑器

Buff 编辑器已独立到 `../buffEffect/`，启动 `../buffEffect/start.cmd` 后访问 <http://127.0.0.1:3212/>。本编辑器只编辑卡牌，状态下拉框保留 Buff 选择与预览，并可跳转到对应 Buff。

双击本目录的 `start.cmd`，保持启动窗口运行，然后在浏览器打开 <http://127.0.0.1:3210/>。

也可以在项目 `dice` 目录运行：

```powershell
node 策划/cardEffectEditor/cardEffectEditorServer.cjs
```

编辑器通过本地服务读取和保存 Excel，直接双击 `cardEffectEditor.html` 无法连接配置表。
服务端兼容本项目当前使用的 Node.js 10，页面请使用现代浏览器。
如果提示端口 3210 已被占用，先尝试打开上述地址。

读取的配置表位于 `策划/excel/`：`1_Role.xlsx`、`2_Card.xlsx`、`3_Dice.xlsx`、`20_BattleBuff.xlsx`、`21_BattleEffect.xlsx`。
点击“保存到 Excel”才会写回卡牌表，并保留 `.editor-backup` 备份；保存后需通过项目配表插件生成客户端配置。

Dice 表的 `role` 为角色 ID 数组，例如 `[10001,10002,10003]`。只有数组中的角色可以使用该骰子花色；空数组表示没有角色可用，不使用 `role=0` 约定。卡牌的 `role` 仍为单个角色 ID。骰子选项、出牌条件和减免骰子条件均按此授权数组校验。

“添加效果”中可选择“抽取卡牌到手牌”（DRAW，参数 count）和“补充能量”（GAIN_ENERGY，参数 amount），均只支持 SELF，数量支持非负整数或数值表达式。
效果抽牌免费，最多持有 10 张；抽牌堆不足时洗回弃牌堆，满手或无牌时停止。回合开始仍补足 5 张，出牌不自动补牌，手动抽牌每次消耗 1 点能量。
补充能量受当前能量上限限制，超出部分不储存。

战士正式卡表现为 80 张主卡及 1 张巨石衍生卡，价格统一暂定 50；武装等升级手牌牌暂不加入。初始牌组为打击×3、剑柄打击×2、防御×4、痛击×1。

效果库与 `21_BattleEffect.xlsx` 共用 37 个实际使用的效果。新增移动、复制、自动出牌、变化、随机生成、单张成长与卡牌规则；消耗效果可添加“每张被消耗牌”的子效果。条件可引用 `@battle.exhaustCount`、`@battle.exhaustedThisTurn`、`@battle.hpLossCount`、`@battle.hpLossThisTurn`、`@battle.handAttackCount`、`@battle.strikeCount`、`@battle.playerTurn`，当前消耗步骤的结果为 `@exhaustedCount` 和 `@exhaustedDamage`。

“特殊属性”可设置仅初始、特殊获取、仅衍生，以及按攻击次数减免指定花色的骰子。前三类不会进入普通商店、战斗奖励或随机生成池。卡牌触发时机可选“消耗堆回合末”（ON_TURN_END_IN_EXHAUST）。

腐化完整支持技能免骰并消耗；地狱狂徒支持抽到打击牌时免费自动打出；惊逃在回合末弃牌前打出手牌攻击；彼岸咆哮留在消耗堆逐回合结算伤害。暴走、痛殴的成长按单张实例保存，复制继承成长；生成牌的本回合首次免骰只绑定该实例。

能力牌（POWER）统一通过“施加增益 / 减益”添加 Buff，默认持续本场战斗。选择状态后，右侧展示对应 Buff 的说明、叠加方式、能力效果与持续规则；前后端均禁止能力牌直接注册监听或修改持续规则。

`20_BattleBuff.xlsx` 的 `effects` 为每获得一层能力时执行的效果数组，可包含即时效果、事件监听和延迟效果；`rules` 为持续规则对象，支持 `SKILL_FREE_EXHAUST`（技能免骰并消耗）、`FIRST_BLOCK_DOUBLE`（每层使首次卡牌格挡再翻倍）、`VULNERABLE_BONUS`（易伤额外伤害倍率，如 0.25）。普通状态使用 `[]` 和 `{}`。

能力以 Buff 实例持有监听，重复施加可叠加；移除部分层数、清除状态或到期时，对应监听和延迟效果一起失效，规则立即重新计算。移除能力不会撤回它此前已经获得的力量、格挡、生命等结算结果。能力牌结算后仍进入能力牌区，不参与弃牌洗回。

猎人和储君的能力统一配置为 `APPLY_STATUS`，持续效果在 Buff 表中维护。新增规则包括 `SHIV_DAMAGE`、`SHIV_RETAIN`、`FIRST_SHIV_DAMAGE`、`POISON_REPEATS`、`SLY_SKILLS`、`WEAK_ATTACK_DOUBLE`、`BLADE_REPEAT`、`BLADE_BLOCK` 和 `FREE_CARDS_PER_TURN`。

`flags.starCost` 为星星费用，免骰仍需支付星星；`GAIN_STARS` 获取星星。`ON_STARS_CHANGED` 的 `@event.units` 为实际变化的绝对数量，`ON_STARS_SPENT` 仅在实际支付后触发。星星在战斗中保留，开新战斗清零，资源栏显示当前数量。

`flags.sly` 表示奇巧：主动弃置时自动打出，回合末清理不触发。谋划专家赋予的奇巧保存在本张牌实例，不影响其他副本。自动出牌仍需支付星星，有递归深度保护；一次弃牌效果只处理开始时的牌各一次。

`GENERATE_CARD.cardId` 为0时生成当前角色的普通奖励牌，指定ID时生成对应衍生牌；`sly` 可为新卡添加奇巧。生成、复制与变化每创建一个实际实例触发 `ON_CARD_CREATED`；起始牌组、移动和敌人塞牌不触发。满手时停止生成。

`FORGE` 自动创建并强化本场唯一的君王之剑；已有剑时只强化原实例。`SUMMON_BLADE` 召回该实例，不产生副本。`flags.archetype` 使用 `SHIV` 或 `SOVEREIGN_BLADE`。衍生牌使用 `generated`，不进入普通卡池。

需要额外抽牌或操作基础手牌的回合开始能力使用 `ON_HAND_READY`；延迟额外抽牌使用 `NEXT_HAND_READY`。`END_TURN` 请求在当前出牌完整结算后结束回合，虚空形态每回合的免骰次数由出牌计数限制。效果库现有37种效果。

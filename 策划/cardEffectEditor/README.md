# 卡牌效果编辑器

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

“添加效果”中可选择“抽取卡牌到手牌”（DRAW，参数 count）和“补充能量”（GAIN_ENERGY，参数 amount），均只支持 SELF，数量支持非负整数或数值表达式。
效果抽牌免费，最多持有 10 张；抽牌堆不足时洗回弃牌堆，满手或无牌时停止。回合开始仍补足 5 张，出牌不自动补牌，手动抽牌每次消耗 1 点能量。
补充能量受当前能量上限限制，超出部分不储存。

战士正式卡表现为 80 张主卡及 1 张巨石衍生卡，价格统一暂定 50；武装等升级手牌牌暂不加入。初始牌组为打击×3、剑柄打击×2、防御×4、痛击×1。

效果库与 `21_BattleEffect.xlsx` 共用 33 个实际使用的效果。新增移动、复制、自动出牌、变化、随机生成、单张成长与卡牌规则；消耗效果可添加“每张被消耗牌”的子效果。条件可引用 `@battle.exhaustCount`、`@battle.exhaustedThisTurn`、`@battle.hpLossCount`、`@battle.hpLossThisTurn`、`@battle.handAttackCount`、`@battle.strikeCount`、`@battle.playerTurn`，当前消耗步骤的结果为 `@exhaustedCount` 和 `@exhaustedDamage`。

“特殊属性”可设置仅初始、特殊获取、仅衍生，以及按攻击次数减免指定花色的骰子。前三类不会进入普通商店、战斗奖励或随机生成池。卡牌触发时机可选“消耗堆回合末”（ON_TURN_END_IN_EXHAUST）。

腐化完整支持技能免骰并消耗；地狱狂徒支持抽到打击牌时免费自动打出；惊逃在回合末弃牌前打出手牌攻击；彼岸咆哮留在消耗堆逐回合结算伤害。暴走、痛殴的成长按单张实例保存，复制继承成长；生成牌的本回合首次免骰只绑定该实例。

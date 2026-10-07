# 敌人行为与特殊机制

在本目录运行 `node enemyBehaviorEditorServer.cjs`，打开 `http://127.0.0.1:3211`。
每次读取直接加载 `../excel/5_Enemy.xlsx`；保存修改 Excel 后，使用项目 Excel To Json 插件同步客户端配置。

`behavior` 控制初始招式，画布可编辑。`mechanics` 控制战斗初始状态、阶段和事件触发，可在页面的“特殊状态与阶段”中编辑 JSON 并应用。
阶段的 `behavior` 使用相同的行为树格式，在机制 JSON 内编辑；“预览阶段”可查看该阶段的招式，并指定阶段开始回合。

- `initialStatuses`：`status` 为状态 ID，`stacks` 为层数，`duration` 默认为整场战斗。
- `phases`：每个 `id` 必须唯一，`name` 显示在战斗意图中。`HP_BELOW` 的 `value` 为生命百分比；`TURN_AT_LEAST` 为战斗回合数；`HITS_AT_LEAST` 为累计受到攻击生命损失的段数。`effects` 进入阶段时执行一次，`behavior` 替换后续招式。回血不会退出阶段，循环从阶段进入回合开始。
- `triggers`：`event` 为监听事件，`listenSide` 为 `ENEMY` 或 `PLAYER`。`limit=0` 表示不限次数；伤害事件可用 `filter: {"damageKind":"ATTACK"}` 排除中毒、灼烧等生命损失。触发效果的 `SELF` 是敌人，`ENEMY` 是玩家。

新状态：

| ID | 结算 |
| --- | --- |
| ARMOR | 每段非生命损失伤害减少等量数值 |
| EVASION | 抵消一次攻击，消耗1层；不消耗格挡 |
| FLIGHT | 攻击伤害减半；受到攻击生命损失后减1层 |
| PLATED_ARMOR | 回合结束获得等量格挡；受到攻击生命损失后减1层 |
| FURY | 受到攻击生命损失后获得等量力量 |
| RITUAL | 自身回合结束获得等量力量 |
| BURN / CONSTRICTED | 自身回合结束损失等量生命，然后减1层；可被人工制品阻挡或净化 |

全部101个敌人均有初始状态和一次性阶段；首领有两个低生命阶段。原召唤、友方支援和未实现的状态牌占位，已转换为自身强化、状态或单体招式。游戏没有召唤单位，也没有召唤节点。

验证完成后，相关测试文件已清理。

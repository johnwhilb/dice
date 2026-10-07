# 装备编辑器

在本目录双击 `start.cmd`，或在 `dice` 目录运行：

```powershell
node 策划/equipmentEffectEditor/equipmentEffectEditorServer.cjs
```

启动后访问 **http://127.0.0.1:3213**。终端需保持运行；自定义端口可设置 `PORT` 环境变量。

每次打开或点击“重新读取 Excel”均直接读取 `策划/excel/19_Equipment.xlsx`，不使用网页缓存数据。支持搜索、类型筛选、新增、复制、编辑、删除和导出 JSON 备份。

字段沿用原表：`id`、`name`、`effectDes`、`des`、`effect`、`type`、`price`、`combine`。Component 为合成材料，Weapon 为武器，Armor 为护甲。价格是非负整数金币。合成配方为空数组或两个装备编号，两个材料允许相同；校验无效引用、删除引用和循环配方。

效果格式沿用 BattleEffect，目标仅 SELF/ENEMY，参数使用 camelCase。支持效果参数表单、条件 JSON、子效果与条件不成立分支、排序、复制、删除及完整 JSON 编辑。点击字段和效果旁的“!”打开解释。持续触发可通过 REGISTER_TRIGGER 配置，战斗开始初始化时应注册一次。

现有20件装备已按 effectDes 填写完整 effect，名称、描述、价格和合成配方保持原样。修改描述仍需同步修改效果节点，编辑器不会自动推导效果。

新增装备效果：MODIFY_CARD_VALUE（仅卡牌的伤害/格挡）、GAIN_ENERGY（增加当前能量）、DRAW（免费额外抽牌，可临时超过5张）、RETAIN_BLOCK（保留现有格挡上限）、FREE_DICE（下一张合法卡牌免骰子）。每回合/每场一次用 TURN/COMBAT 变量记录，装备变量按穿戴槽隔离。

PlayerBll.addEquipment(id) / removeEquipment(id) 管理穿戴和生命上限，equipmentIds 随冒险存档保存。BattleEquipmentBll 在每场战斗初始化时读取穿戴列表并注册配置效果。装备获取、合成和槽位界面继续调用这两个接口，本次不自动给玩家装备。

ON_BEFORE_CARD_PLAYED 包含本回合 cardCount、attackCount 和 requiredDiceCount / diceCount。ON_BLOCK_CARD_PLAYED 只在本次出牌实际获得格挡后触发。ON_CARD_DAMAGE_DEALT 的 amount 为实际生命损失，damage 为格挡前伤害。ON_ENERGY_SPENT 的 spent 为补牌、抽牌、重投或激活的实际消耗，不包含回合结束清空能量。ON_HAND_READY 在正常补足手牌后触发，用于首回合额外抽牌。

打牌本身不消耗能量；打出后有牌可补且能量足够时，消耗1点能量自动补一张。装备额外抽牌免费，零能量仍可用满足骰子条件的牌；免骰子不会减免补牌能量。

点击“保存并生成配置”会校验并写回原工作簿，再通过项目 oops-plugin-excel-to-json 生成器同步客户端 JSON、BaseEquipment、TableEquipment。保留五行表头、字段类型、现有工作表和样式。生成器会扫描所有配置表，与项目现有导表行为一致。如果生成失败，界面明确提示“表格已保存，但客户端配置生成失败”，可以修正问题后再次保存或运行项目导表。

保存前后检查文件版本，避免覆盖外部 Excel 修改；写入前保留 `19_Equipment.xlsx.editor-backup`，通过临时文件替换原表。打开 Excel 占用表格时，保存并关闭它后重试。编号自动分配且只读，避免修改主键破坏配方。

服务端只绑定本机127.0.0.1。端口占用时提示现有地址，不产生未处理异常。测试使用临时工作簿，不改正式装备数据，不留下测试文件。

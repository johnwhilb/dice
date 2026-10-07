# 道具编辑器

在当前 `itemEffectEditor` 目录启动：

```powershell
node itemEffectEditorServer.cjs
```

也可以双击本目录的 `start.cmd`，它会切换到编辑器目录并启动服务。
启动成功后显示 `道具编辑器：http://127.0.0.1:3212`，终端保持运行即可在浏览器访问。

在项目上层 `dice` 目录启动：

```powershell
node 策划/itemEffectEditor/itemEffectEditorServer.cjs
```

浏览器打开 `http://127.0.0.1:3212`。服务端兼容项目的旧 Node；测试脚本需 Node 18 以上。

编辑器每次打开或点击重新读取时直接读取 `策划/excel/17_Item.xlsx` 和 `5_Enemy.xlsx`。支持新增、修改、删除、搜索、导出 JSON，以及修改敌人的道具掉落关联。效果参数由本目录 effectCatalog.js 提供，沿用卡牌效果格式，参数有可视化表单，嵌套分支可在完整效果 JSON 中编辑。字段说明旁的感叹号可展开帮助。

道具只包含 id/name/des/effect/target/type，没有骰子条件或等级。效果 target 仅支持 SELF/ENEMY，JSON 参数使用 camelCase。敌人表原有拼写 `itemRewad` 保留，避免破坏现有配置约定。

保存会核对两张 Excel 的版本并保留 `.editor-backup`，防止覆盖外部修改；被敌人引用的道具须先解除关联再删除。保存后需运行项目 Excel To Json 生成器同步客户端配置。

保留原有石头（170001），101 件专属掉落使用 170002～170102，按敌人行为设计伤害、格挡、削弱、强化、回复和下回合效果。这里只实现编辑与配置；战斗中的道具持有、使用和掉落发放需运行时接入。

验证使用临时工作簿，不修改正式表格；临时测试文件在验证完成后清理。

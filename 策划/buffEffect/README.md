# Buff 效果编辑器

双击本目录的 `start.cmd`，保持服务窗口运行，访问 <http://127.0.0.1:3212/>。

也可以在项目根目录运行：

```powershell
node 策划/buffEffect/buffEffectServer.cjs
```

本编辑器独立运行，不需要启动卡牌编辑器。`buffEffect.html` 为页面，`buffEditor.js` 为页面控制器，`buffEffectServer.cjs` 为读取、引用检查和保存服务。通用效果树、样式及表格读取校验分别复用上一级的 `effectEditorCore.js`、`effectEditor.css`、`effectEditorTables.cjs`。

支持搜索、新增、复制、删除、JSON导入导出，以及名称、说明、增益/减益分类、叠加方式、层数上限、默认持续时间、回合末衰减、驱散设置、获得效果、事件监听和持续规则编辑。

保存只写入 `../excel/20_BattleBuff.xlsx`，保留 `.editor-backup`。保存时检查源表版本、卡牌和其他表格引用、战斗代码引用；文件被占用或版本冲突时保留页面修改。已有Buff的编号和枚举锁定。保存后通过项目配表插件同步客户端配置。

持续效果使用“注册能力 / 持续触发”节点及其子效果，条件和参数编辑方式与卡牌编辑器一致。监听随所属Buff移除或到期而失效；逐层执行的效果无需再次乘以层数。`@buff.stacks`读取当前实例层数。新机制仍需先由战斗执行器支持。

卡牌编辑器地址为 <http://127.0.0.1:3210/>。两边可独立启动，互相跳转。使用 `http://127.0.0.1:3212/?buff=200033` 可直接定位指定Buff。

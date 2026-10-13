### 游戏配置数据生成 + 数据对象代码生成器插件
![Cocos Creator 3.x 配套游戏配置数据生成 + 数据对象代码生成器插件](https://gitee.com/dgflash/oops-plugin-excel-to-json/raw/master/doc/1.png)

### Cocos Creator 3.x 配置Excel文件目录、配置Json数据输出目录、配置脚本输出目录
![Cocos Creator 3.x 配置Excel文件目录、配置Json数据输出目录、配置脚本输出目录](https://gitee.com/dgflash/oops-plugin-excel-to-json/raw/master/doc/2.png)


### Cocos Creator 3.x 扩展 -> Oops-Framework Excel To Json
![Cocos Creator 3.x 扩展 -> Oops-Framework Excel To Json](https://gitee.com/dgflash/oops-plugin-excel-to-json/raw/master/doc/3.png)

### Cocos Creator 3.x 生成数据资源与脚本资源
![Cocos Creator 3.x 生成数据资源与脚本资源，减少编码工作](https://gitee.com/dgflash/oops-plugin-excel-to-json/raw/master/doc/4.png)

工具指向策划配置表目录后，每次更新配置时，一键生成数据与静态配置表代码，在项目中后期平凡维护修改时，提高开发效率。

### Excel中数据规则
- Excel中前五行为工具规则数据
- 第一行为字段中文名
- 第二行为字段英文名，会生成为json数据的字段名；末尾的 `_ENUM` 是枚举生成标记，导出时会去掉
- 第三行为字段数据类型，支持 `int`、`float`、`string`、`boolean`、`json`、`array`、`any`
- 第四行标记输出服务器数据时，是否存在这个字段"server"为显示字段，"server_no"为删除字段
- 第五行标记输出客户端数据时，是否存在这个字段"client"为显示字段，"client_no"为删除字段

### 主表字段生成枚举

- 配置文件和首张工作表统一命名为 `表ID_表名`，例如 `4_DiceRule.xlsx` / `4_DiceRule`。
- 第一行用 `【KEY】` 标记唯一主键，主键为 `表ID × 10000 + 表内编号`，表内编号范围为 1～9999。
- 需要生成枚举时，在第二行的字段名末尾添加大写 `_ENUM`，例如 `numNeed_ENUM`。第三行类型必须为 `string`。
- 从第六行开始，该列填写英文枚举成员名，同一行主键作为枚举值；成员名不能为空、重复或包含不合法字符。
- 自动生成 `<表名><字段名首字母大写>Enum.ts`，支持一张表标记多个字段。JSON、Base 和服务端配置类均去掉字段名末尾的 `_ENUM`，单元格内容保持不变。
- 枚举标记独立于 `client` / `server` 导出开关；需要只生成枚举而不导出字段时，可使用 `client_no` / `server_no`。
- 新规则不需要 Sheet2。主表包含 `_ENUM` 字段时忽略 Sheet2；未迁移的旧表暂时兼容 Sheet2 生成 `Enum<表名>`。
- 自动生成文件不得手改，扩展逻辑写在 `TableXxx`、Model 或 Bll 中。

例如 `4_DiceRule` 的 `numNeed_ENUM` 列填写 `DOUBLE`，同行 `id` 为 `40001`：

```ts
export enum DiceRuleNumNeedEnum {
    DOUBLE = 40001,
}
```

JSON 仍为 `"40001": { "numNeed": "DOUBLE", ... }`，配置类仍通过 `table.numNeed` 读取。

`6_Event` 使用 `type_ENUM` 保存事件英文标识，生成 `EventTypeEnum`，例如 `SHOP = 60001`；原来的中文 `name` 保持不变。

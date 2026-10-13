# Codex 项目要求
## 项目介绍

-《绝壁攀登》
- 这是一款以四肢独立操控、岩点争夺、体力管理和路线规划为核心的策略攀岩游戏。
- 玩家需要控制小人的双手和双脚，在岩点稀少的垂直岩壁上不断向上攀爬，最终双手同时抓住终点，完成挑战。
- 玩家可以分别控制小人的左手、右手、左脚和右脚，拖动到不同岩点上。
- 每个岩点只能被一只手或一只脚占据，并且四肢都有伸展距离限制。玩家需要不断调整身体姿态，寻找下一个能够到达的岩点。

## 角色与语言

- 你是一位资深 Cocos Creator 游戏前端开发工程师，精通 TypeScript 与 OOP。
- 最终回复、解释和代码注释使用中文。
- 回复直接、专业、切中要害，优先给出可直接落地的代码。

## 技术栈与架构

- 引擎使用 Cocos Creator 3.8.x，开发语言使用 TypeScript，项目启用严格类型检查。
- ECS 与业务模块使用 OopsFramework。数据放在 `Model`，业务判断和状态变更放在 `Bll`，界面展示与交互放在 `View` 或对应节点组件。
- 表格配置通过 `TableXxx` 类读取。需要生成枚举的主表字段添加 `_ENUM` 后缀，自动生成 `<表名><字段名首字母大写>Enum`（如 `HoldTypeKindEnum`）；JSON 和配置类字段去掉后缀，枚举成员值使用同行主键。新表无需 Sheet2，未迁移旧表暂时兼容 `EnumXxx`，禁止在业务代码中重复维护魔法数字或字符串映射。
- `Climb` 实体负责注册 `ClimbModel`、`ClimbBll`、`GameView` 与 `LevelSelectView`；跨组件访问攀岩数据统一通过实体引用或 `smc.climb`。
- 关卡编辑器独立使用 `GameEditor`、`GameEditorModel`、`GameEditorBll`、`GameEditorView`、`GameEditorClimberView` 和 `GameEditorRoute`。编辑与试爬不能修改 `Climb`、`ClimbBll`、`ClimbModel`、`GameView` 的逻辑或正在进行的游戏状态。
- 编辑器通过配表插件的本机接口写回 `excel/3_ClimbHold.xlsx`，随后使用原生成器同步 JSON 与配置类；仅替换当前关卡岩点，保留其他关卡、五行表头、样式及现有主键。前 3 关仍禁止危险石头，4 个初始抓点不能删除，左右终点各需保留 1 个。
- 关卡参数、岩点类型和岩点坐标以 `excel/*.xlsx` 为配置源，通过 `oops-plugin-excel-to-json` 生成客户端配置。危险、终点左、终点右和普通岩点使用生成的 `HoldTypeKindEnum`。
- 主菜单的“开始攀登”先进入关卡选择界面，再开始选中的关卡。现有 10 关按等级排序，高度逐关增加，前 3 关禁止出现危险岩点；原始路线作为 Lv6 保留。
- 游戏内的人物和岩点预制体通过编辑器拖拽绑定 `@property(Prefab)`，使用 `instantiate` 同步创建，禁止使用 Promise、异步加载或 `createPrefabNode` 创建这些节点。岩点按类型使用 `NodePool`，碎裂回收、重开复用，缩放范围从关卡配置读取。
- 自动生成的 `BaseXxx`、`XxxEnum` 和旧版 `EnumXxx` 文件禁止手动修改；项目扩展逻辑写在对应的 `TableXxx`、Model 或 Bll 中。
- Cocos 已序列化的 `@ccclass` 名称不能随意修改；TypeScript 类名仍使用 `PascalCase`，两者允许不同，以保证旧 Prefab 和场景引用有效。

## 编码规范

- 判空优先使用真值特性，例如 `if (val)` 或 `!!val`。禁止写 `val !== null && val !== undefined`。
- 控制节点 `active` 时必须形成 true/false 闭环，避免 List Item 复用导致状态残留。优先写 `node.active = index === currentIndex;`。
- 禁止使用 `var`。
- 禁止使用 `as`。
- 默认优先使用 `const`，只有明确需要重新赋值时使用 `let`。
- 方法返回值不额外声明类型时，以 `return` 的值为准。
- 遍历数组或集合时，优先使用 `map`、`forEach`、`filter` 或 `for...of`。非必要不使用传统索引循环。
- 严格使用 TypeScript `interface` 和 `enum` 定义数据结构。
- 非必要不使用 `any`。
- 类名、枚举名使用 `PascalCase`。
- 方法名、变量名使用 `camelCase`。
- 除按钮点击方法外，方法名和变量名禁止使用下划线，禁止下划线开头命名。
- 继承 `GameComponent` 或 `CCView` 的组件在 `nodeTreeInfoLite()` 后，统一使用框架的 `this.getNode("节点名称")` 获取固定节点。Prefab 等资源允许使用 `@property`；动态子节点和材质依赖节点允许使用 Cocos 原生节点 API。
- 禁止写单行函数和单行 `if`。函数体至少多行展开；所有 `if`、`else`、`for`、`while` 等控制流必须使用 `{}` 并换行。
- 禁止对获取的节点进行判空，例如 `if (node)`。节点获取时已确保存在，无需额外判断。
- 对获取的数据使用兜底值。
- 禁止过度封装，保持代码简洁明了。
- 允许新建文件，但是新建文件夹必须请求项目负责人同意。
- 禁止写try catch，所有异常必须在业务逻辑中处理。
- 非必要不使用async/await。确需使用时，在方法上方用中文注释说明等待的原因。
- 非必要不写注释，只有在代码中违反编码规范时才写注释。bll的方法必须写注释，说明方法的功能和参数。 model的方法必须写注释，说明数据的结构和含义。


## 项目结构
- `excel`：关卡参数、岩点类型和岩点坐标的 Excel 配置源。
- `extensions\oops-plugin-excel-to-json`：表格配置插件。
- `assets\script\game\game`：攀岩实体、Model、Bll 与 View。
- `assets\script\game\mainManue`：主菜单逻辑代码，可以作为编码规范参考。
- `assets\script\game\common\table`：生成的配置类、枚举及 `TableXxx` 扩展。
- `assets\bundle\config\game`：自动生成的客户端 JSON。
- `assets\bundle\gui\gameView`：游戏界面、人物与岩点预制体及贴图。

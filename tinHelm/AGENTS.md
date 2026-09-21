# Codex 项目要求
## 项目介绍

- 这是一个卡牌游戏，结合tinHelm的机制，玩家需要根据牌组中的牌，通过策略和技巧，实现游戏的目标。
- 核心战斗，投掷骰子，根据骰子的结果，玩家打出手牌，击败对手。

## 角色与语言

- 你是一位资深 Cocos Creator 游戏前端开发工程师，精通 TypeScript 与 OOP。
- 最终回复、解释和代码注释使用中文。
- 回复直接、专业、切中要害，优先给出可直接落地的代码。

## 技术栈与架构

- 引擎使用 Cocos Creator 3.8.x，开发语言使用 TypeScript，项目启用严格类型检查。
- ECS 与业务模块使用 OopsFramework。数据放在 `Model`，业务判断和状态变更放在 `Bll`，界面展示与交互放在 `View` 或对应节点组件。
- 表格配置通过 `TableXxx` 类读取，配置枚举统一使用 `EnumXxx`，禁止在业务代码中重复维护魔法数字或字符串映射。
- `Battle` 实体负责注册战斗 Model、Bll 与 View；跨组件访问战斗数据统一通过实体引用或 `smc.battle`。
- 自动生成的 `BaseXxx` 和 `EnumXxx` 文件禁止手动修改；项目扩展逻辑写在对应的 `TableXxx`、Model 或 Bll 中。
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
- 继承 `GameComponent` 或 `CCView` 的组件在 `nodeTreeInfoLite()` 后，统一使用框架的 `this.getNode("节点名称")` 获取固定节点。Prefab 等资源允许使用 `@property`；动态子节点、材质依赖节点和按索引访问的骰子面允许使用 Cocos 原生节点 API。
- 禁止写单行函数和单行 `if`。函数体至少多行展开；所有 `if`、`else`、`for`、`while` 等控制流必须使用 `{}` 并换行。
- 禁止对获取的节点进行判空，例如 `if (node)`。节点获取时已确保存在，无需额外判断。
- 对获取的数据使用兜底值。
- 禁止过度封装，保持代码简洁明了。
- 允许新建文件，但是新建文件夹必须请求项目负责人同意。

## 项目结构
- tinHelm\excel  表格配置文件 
- tinHelm\extensions\oops-plugin-excel-to-json  表格配置插件
- tinHelm\assets\script\game  游戏逻辑代码  
- tinHelm\assets\script\game\mainManue  主菜单逻辑代码，可以作为编码规范参考
- tinHelm\assets\script\game\ui  ui工具类代码，包含动画处理、列表等
- tinHelm\assets\script\game\battle  战斗逻辑代码，包含骰子投掷、牌组管理、玩家操作等

## skill使用
$tinhelm-table-config  给 XXX 表新增XXX字段

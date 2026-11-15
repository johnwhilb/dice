# Codex 项目要求
## 项目介绍

- SNKRX的cocos creator项目，需要根据项目需求进行修改,手游项目。
- 画布大小为1334*750。

## 角色与语言

- 你是一位资深 Cocos Creator 游戏前端开发工程师，精通 TypeScript 与 OOPS框架。
- 最终回复、解释和代码注释使用中文。
- 回复直接、专业、切中要害，优先给出可直接落地的代码。
- 每个新的修改请求开始前，先向用户提出两个确认问题，收到回答后再修改。已确认范围内的实现和修复无需重复提问。
- 临时生成的 `.test` 测试文件在验证完成后自行删除，不作为交付文件保留；项目原有测试文件保留。

## 技术栈与架构

- 引擎使用 Cocos Creator 3.8.x，开发语言使用 TypeScript，项目启用严格类型检查。
- ECS 与业务模块使用 OopsFramework。数据放在 `Model`，业务判断和状态变更放在 `Bll`，界面展示与交互放在 `View` 或对应节点组件。
- 表格配置通过 `TableXxx` 类读取。需要生成枚举的主表字段添加 `_ENUM` 后缀，自动生成 `<表名><字段名首字母大写>Enum`；JSON 和配置类字段去掉后缀，枚举成员值使用同行主键。新表无需 Sheet2，禁止在业务代码中重复维护魔法数字或字符串映射，生成的excel表格只有基础表格，禁止使用多色样式。
- 自动生成的 `BaseXxx`、`XxxEnum` 和旧版 `EnumXxx` 文件禁止手动修改；项目扩展逻辑写在对应的 `TableXxx`、Model 或 Bll 中。
- Cocos 已序列化的 `@ccclass` 名称不能随意修改；TypeScript 类名仍使用 `PascalCase`，两者允许不同，以保证旧 Prefab 和场景引用有效。

## 编码规范
- 判空优先使用真值特性，例如 `if (val)` 或 `!!val`。禁止写 `val !== null && val !== undefined`。
- 控制节点 `active` 时必须形成 true/false 闭环，避免 List Item 复用导致状态残留。优先写 `node.active = index === currentIndex;`。
- 禁止使用 `var`。
- 禁止使用 `as`。
- 默认优先使用 `const`，只有明确需要重新赋值时使用 `let`。
- 方法返回值不额外声明类型时，以 `return` 的值为准。
- 遍历数组或集合时，优先使用 `map`、`forEach`、`filter` 或 `for...of`。非必要不使用传统索引循环；创建不确定长度节点的时候 允许使用普通 for (let ...) 循环。
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
- 禁止写try catch，所有异常必须在业务逻辑中处理。
- 非必要不使用async/await。确需使用时，在方法上方用中文注释说明等待的原因。
- 非必要不写注释，只有在代码中违反编码规范时才写注释。bll的方法必须写注释，说明方法的功能和参数。 model的方法必须写注释，说明数据的结构和含义。
- this.setButton()默认开启,点击事件方法写在view界面末尾;
- 禁止过度封装，保持代码简洁明了。
- 刷新界面时，必须使用事件方法，不能使用回调函数。
- event界面写事件名和各类和enum枚举，枚举写在事件名后面，每个都需要写注释
- 禁止写兜底值，所有数据必须从表格中获取，获取不到就报错。
- 如果没有特殊要求，代码操作范围在script/game目录下。

## UI 专项规范
- 涉及滚动列表或虚拟列表时，使用框架内置 `List`，并遵守 `.codex/skills/cocos-ui-list/SKILL.md` 中的 List 组件规范与 `setRwdContent` 骨架。
- 涉及 Tab 页签切换时，遵守 `.codex/skills/cocos-ui-tab/SKILL.md` 中的 Tab 状态管理和配置化更新规范。
- ListView刷新 必须使用事件方法，不能使用回调函数。
- 禁止随意修改计算position，除非有特殊需求，比如动画表现，list的高度计算等。

## 框架 API 使用
- 唯一 UI 节点统一使用 `this.getNode("节点名称")` 获取。
- 首选自动绑定事件：只要节点名在预制体中唯一，就声明 `节点名`，不要写多余监听。
- 只有节点名不唯一时，才允许手动使用 `node.on(Button.EventType.CLICK, ...)` 注册事件。
- 图片设置必须使用 `this.setSprite(this.getNode("节点名称"), path)` path一般通过ResPath对应方法获取，禁止手动调用 `oops.res.load`，禁止过度封装，保持代码简洁明了；。

## 预制体规范
- 按钮节点 btn开头，例如 btnEnd、btnBuy等，点击效果无例外情况统一预制体里设置为scale=0.8。
- label节点 分为动态label和静态label。如果label内容为动态，则起名lbt开头，例如lbtCount、lbtPrice等；如果label内容为静态，则起名txt开头，例如txtEnd、txtBuy等，label系统字体高度是字体大小的+2，如字体20，则高度设置为22。

## 业务规则
- 飘字提示使用 `oops.gui.toast(lang("xxx"))`。
- 颜色如果不是动态的，不在代码里设置，直接在预制体中设置，需要动态设置的颜色 放在ColorConst类中编辑使用统一管理。
- 界面适配禁止在View直接处理，暂不处理。
- 手机游戏，暂无键盘输入，所有输入都通过触摸事件处理，无悬停事件，如果是原本项目必要处理，如右键点击出售，涉及到了玩法逻辑，相关逻辑需要在bll中处理的才允许使用，并且注释说明；如果只是美观优化，如悬停效果，不允许使用。
- fatPixelFont字体是系统字体大小的三倍，预制体中，如果同时出现系统字体和fatPixelFont字体，系统字体的大小是fatPixelFont字体的三倍，并且使用layout布局约束。 


## 项目结构
- dice\其他游戏\snk\assets\SNKRX-master  SNKRX项目代码（引擎 / 框架： LÖVE（Love2D）编程语言： Lua 游戏类型： 2D）




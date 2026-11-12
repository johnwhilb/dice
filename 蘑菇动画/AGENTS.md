# 默认生成参考

## style-ref

本项目使用 generate2dsprite 或生成角色素材时，默认使用项目内的 `style-ref.jpg`。本文中的相对路径均以本文件所在的项目文件夹为基准。

```json
{
  "style_ref": {
    "path": "./style-ref.jpg",
    "what": "画风参考，匹配吊带袜天使风格的角色比例、线条、配色和阴影"
  },
  "master_still_template": {
    "path": "./master-still-template.jpg",
    "what": "后续 master-still 生成的版式模板"
  }
}
```

- style-ref 用于画风，不默认将图中人偶作为其他角色的身份参考。
- 后续 master-still 默认使用 `master-still-template.jpg` 的设定图版式：正面、侧面、背面、细节、武器、表情范例、尺寸对比及右下补充区域。根据当次角色需求填充内容。
- 生成时必须通过生成工具的真实图片输入附加相应参考图；仅在提示词中写路径不算附加。
- 用户明确指定其他参考、版式，或要求单角色透明底等不同输出时，以当次用户要求为准。
- 模板是设定图的版式参考；动画管线所需的单角色 master 静帧应另行输出，不把整张设定图直接作为动画输入。

## 战斗场景背景

后续生成战斗场景背景时，默认使用以下图片作为场景画风参考，匹配其简洁粗线条、平涂与块面阴影、风格化建筑和地面表现；场景主题、具体建筑及配色根据当次需求设计，不默认复制参考图中的密室内容。生成时必须通过生成工具的真实图片输入附加该图，不能只在提示词中写路径。用户当次明确指定其他画风或布局时，以当次要求为准。

```json
{
  "battle_background_style_ref": {
    "path": "./assets/scenes/messmer-dark-chamber/background-style-ref.png",
    "what": "战斗场景背景的画风参考"
  }
}
```

战斗场景生成的图片、原图、提示词、预览及相关数据统一存放在 `./assets/scenes/` 下，按场景建立子文件夹。

### 默认布局规范提示词

后续战斗场景生成时，将以下布局规范加入生成提示词；构图和空间布局优先于装饰和环境创意。用户当次明确要求其他布局时，以当次要求为准。

```text
COMPOSITION AND CAMERA — HIGHEST PRIORITY
Create a complete panoramic battle background at 1750 × 750 pixels.
Preserve the fixed framing and visual center. Exclude characters and UI;
the enemy will be composited separately.

HORIZONTAL LAYOUT: left 15% / center 70% / right 15%.
Use the outer regions for balanced environmental framing. Keep the central
70% spacious and readable, without large foreground obstructions.

VERTICAL LAYOUT: upper 48% environmental background / lower 52% enemy
standing area. These describe visual functions, not a mandatory wall and floor.
Use terrain, architecture, vegetation, distant scenery or other suitable elements.
Keep the depth transition near Y 48%, connected naturally across the image.

The background may contain rich scenery and recognizable objects. Control
their contrast, brightness, edges and detail so they support the environment
without competing with the enemy. Place stronger accents toward the sides;
avoid bright focal points or dominant lines behind the expected silhouette.

Reserve enemy placement at X 50%, spanning approximately X 30–70%, with
ground contact at Y 88–92%. Provide a believable standing surface and clear
silhouette space. Keep the bottom center unobstructed while continuing natural
textures and environmental detail throughout; avoid an artificial blank zone.

CAMERA: centered first-person view, eye level, looking down 4–6 degrees,
zero roll and no horizontal offset. Use mild perspective depth, with horizon
and central vanishing point at X 50%, Y 48%.
```

检查最终尺寸、空间分区及敌人站立区和轮廓的可读性；背景细节不得抢夺敌人的视觉焦点。生成式构图若无法符合比例，应明确说明实际偏差。

## 梅瑟莫 identity_ref

后续生成梅瑟莫（Messmer / Messmer the Impaler）时，默认使用以下角色身份参考，通过生成工具的真实图片输入附加，并保留其脸型、红发、翼蛇头盔、盔甲、红披风、缠身蛇及长矛设计。项目 style_ref 仍用于画风。

```json
{
  "identity_ref": {
    "path": "./assets/messmer/master-still-sheet.png",
    "what": "用户指定的梅瑟莫身份参考设定图",
    "copy": "匹配角色外观、配色、服装、武器和蛇的设计；姿势与构图按当次要求调整"
  }
}
```

## 复仇者 identity_ref

后续生成复仇者（Revenant，艾尔登法环：黑夜君临）时，默认通过生成工具的真实图片输入附加以下身份参考。匹配脸型、银白长发、蓝白花冠、金币饰物、浅蓝白礼裙、赤足及象牙色里拉琴；姿势与构图按当次要求调整。项目 style_ref 仍用于画风。

```json
{
  "identity_ref": {
    "path": "./assets/revenant/master-still-sheet.png",
    "what": "用户指定的复仇者身份参考设定图"
  }
}
```

## 拉卡德 identity_ref

后续生成亵渎君王拉卡德（Rykard, Lord of Blasphemy，二阶段）时，默认通过生成工具的真实图片输入附加以下身份参考。匹配苍白人形上半身、红色长发、尖角王冠、暗红巨蛇身躯、寄生手臂、破损深色披风、金色饰物及亵渎圣剑的设计，并保留邪恶、搞怪的表情特征；姿势与构图按当次要求调整。项目 style_ref 仍用于画风。

```json
{
  "identity_ref": {
    "path": "./assets/rykard/master-still-sheet.png",
    "what": "用户指定的拉卡德二阶段 master-still 身份参考设定图"
  }
}
```

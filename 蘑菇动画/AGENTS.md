# 默认生成参考

## style-ref

本项目使用 generate2dsprite 或生成角色素材时，默认使用项目内的 `style-ref.jpg`，替代此前的 `C:/Users/Administrator/Desktop/血缘诅咒/画风锚点/stly.jpg`。

```json
{
  "style_ref": {
    "path": "F:/COCOSproject/dice/蘑菇动画/style-ref.jpg",
    "what": "画风参考，匹配吊带袜天使风格的角色比例、线条、配色和阴影"
  },
  "master_still_template": {
    "path": "F:/COCOSproject/dice/蘑菇动画/master-still-template.jpg",
    "what": "后续 master-still 生成的版式模板"
  }
}
```

- style-ref 用于画风，不默认将图中人偶作为其他角色的身份参考。
- 后续 master-still 默认使用 `master-still-template.jpg` 的设定图版式：正面、侧面、背面、细节、武器、表情范例、尺寸对比及右下补充区域。根据当次角色需求填充内容。
- 生成时必须通过生成工具的真实图片输入附加相应参考图；仅在提示词中写路径不算附加。
- 用户明确指定其他参考、版式，或要求单角色透明底等不同输出时，以当次用户要求为准。
- 模板是设定图的版式参考；动画管线所需的单角色 master 静帧应另行输出，不把整张设定图直接作为动画输入。

## 梅瑟莫 identity_ref

后续生成梅瑟莫（Messmer / Messmer the Impaler）时，默认使用以下角色身份参考，通过生成工具的真实图片输入附加，并保留其脸型、红发、翼蛇头盔、盔甲、红披风、缠身蛇及长矛设计。项目 style_ref 仍用于画风。

```json
{
  "identity_ref": {
    "path": "F:/COCOSproject/dice/蘑菇动画/assets/messmer/master-still-sheet.png",
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
    "path": "F:/COCOSproject/dice/蘑菇动画/assets/revenant/master-still-sheet.png",
    "what": "用户指定的复仇者身份参考设定图"
  }
}
```

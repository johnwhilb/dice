九界分层素材 · v1

backgrounds/background-paper-tree.png：独立暖纸＋浅世界树背景（1672×941）。
worlds/：九个世界的独立透明 PNG，无 UI、无连接线。
worlds-layer.png：按原图位置排好的九界整层透明 PNG，可与背景直接叠加。
preview.png：依据原图布局合成的预览。
contact-sheet.png：九界透明素材检查图（棋盘格仅在此预览图上）。
map-data.json：世界中文名称、PNG 路径、原生尺寸、合成坐标、锚点和交互区域。
verification.json：透明通道与边缘检查记录。
prompts/：每张图的实际生成提示词，使用内置 image_gen。
raw/：原始生成结果。references/：源图分区参考。

使用方法：背景在底层；按 map-data.json 的 x/y/w/h 放置各世界。
默认 x/y 为左上角坐标；如引擎用底部中心锚点，使用 centerBottom。
所有世界 PNG 均保留 12 像素透明保护边，白雪、白云与遗骨不是被扣空的区域。
灰色迷雾、瀑布、熔岩、云层及周边小浮石属于对应世界图层。
每个世界作为完整岛屿素材；内部建筑尚未单独拆层。

美术调整：保留主体轮廓和主要地标，适度减少重复小叶片、碎石、屋顶细纹等，轻度加强粗黑线和蜡笔笔触。
生成式修整可能使局部细节和边缘与原图略有差异；preview.png 为本包实际合成效果。

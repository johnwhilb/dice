CRUX 攀岩游戏：原始 SVG -> PNG 全图片版

素材来源：用户上传的 crux_sparse_challenge(1).html。
未使用任何 AI 生图、外部照片、额外人工绘画；所有图片由上传文件中的 SVG 元素提取、拆分并使用 Chromium 2x 倍率栅格化。

游戏：
  index.html：独立运行，所有 PNG 图片内嵌，双击即玩。
  index_assets.html：读取 assets 子目录中的 PNG，便于二次修改。
  source_original.html：未修改的上传原版，方便对照。

素材：
  assets/world/background.svg + .png 背景边栏及氛围纹理
  assets/world/climbing_wall.svg + .png 岩壁、结构纹理、终点和起点装饰
  assets/holds/*.svg + .png 每个岩点（普通、易碎、终点）
  assets/character/*.svg + .png 头、身体、手臂腿部、关节、手套和鞋子
  assets/effects/*.svg + .png 抓点高亮、破碎圈、可达范围、碎屑粒子
  assets/ui/*.svg + .png 原版小图标
  manifest.json 资产清单、原始 SVG 画布尺寸

渲染说明：
  游戏仍使用一个空 SVG 容器提供坐标系和透明点击热区，但背景、岩壁、岩点、角色和特效实际使用 <image> 引用 PNG；不会绘制路径/多边形/圆形作为可见游戏美术。
  四肢仍由原版 IK 计算弯曲角度，程序只移动/旋转两段 PNG。
  保留两档难度、24 岩点、一点一肢、易碎点、体力流失、落点限制及胜负逻辑。

注意：同一原版背景为固定长关卡，因此 PNG 非无缝贴图；如果后续扩展无限关卡，需要另外实现分块拼接。

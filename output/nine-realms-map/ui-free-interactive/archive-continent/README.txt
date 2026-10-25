九界无 UI 分层地图

打开 index.html 即可使用，不需要服务端。画面只有地形与独立地标。
点击/触摸地标：选择、轻微弹动与高亮；再次点击仍会触发探索事件。
键盘 Tab 选择地标，Enter / 空格激活，Escape 或点击空地取消选择。

terrain.png：无 UI 地形底图。
props/*.png：九个独立透明地标，可以替换、移动、隐藏。
map-data.json：地标坐标、尺寸、锚点、交互范围与事件类型。
map-data.js：相同数据的本地浏览器加载版本。
layered-preview.png：底图与独立地标合成的静态检查图，不作为运行底图。

业务接入：监听地图根节点向上冒泡的 realm-interact 事件。
document.addEventListener('realm-interact', event => {
  const {id, name, action, visits} = event.detail;
  // 在这里接入目标王国的探索、事件或场景加载逻辑。
});
也可调用 window.nineRealmsMap.activate('mid')。

坐标为原始地图像素，左上为原点，地标采用中心底部锚点。
这是交互素材预览；未接入 tinHelm 战斗、存档或场景切换。
所有新绘制素材使用内置 image_gen，生成提示词保存在同目录。

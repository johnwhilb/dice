---
name: cocos-ui-list
description: Cocos Creator UI List 组件开发规范。Use when implementing or refactoring Cocos Creator TypeScript views/items that render virtual lists, scrolling lists, repeated item nodes, reward/item icon reuse, dynamic list item sizes, or setRwdContent-style item reuse.
---

# Cocos Creator UI List 组件开发规范

## 核心原则

- 编写和维护带有 `List`、循环列表、虚拟列表的渲染逻辑时，必须遵守本规范。
- 优先保证列表复用时的状态闭环，尤其是节点 `active`、按钮状态、文本、图片和奖励图标复用。

## 列表项复杂度控制

- 如果单个 List Item 的数据渲染与事件绑定逻辑超过 20 行，或内部嵌套逻辑复杂，必须拆成独立 Item 组件脚本。
- 独立 Item 组件可继承 `AssetUseProvider` 或 `Component`，例如 `XxxItem.ts`。
- 主视图中只获取组件并调用赋值方法，例如 `node.getComponent(XxxItem).setData(itemData)`。
- 只有逻辑非常简单且小于 20 行时，才允许直接在主 View 的 `updateItem` 方法中处理。

## 奖励与道具复用

- 只要列表项包含多个奖励或道具图标展示，必须使用 `setRwdContent` 思路统一处理。
- 禁止在 Item 逻辑中手写散装的循环实例化节点代码。
- 必须统一处理节点复用、按需生成和隐藏。
- 推荐签名：`private setRwdContent(itemBox: Node, rwd: any[], itemScale: number = 1)`。

## 动态尺寸计算

- 如果列表长度或尺寸需要根据内容动态计算，列表绑定的更新方法必须增加 `isCalculateSize?: boolean` 参数。
- 方法顶部必须包含 `if (isCalculateSize)` 分支。
- 禁止在 `if (isCalculateSize)` 中替人类开发者臆造具体公式。只保留注释和 `return`。

## 代码骨架

```typescript
updateXXXItem(node: Node, index: number, isCalculateSize?: boolean) {
    const itemData = this.dataList[index];

    if (isCalculateSize) {
        // TODO: 尺寸计算逻辑由人类开发者自行完善
        return;
    }

    // Item 内容超过 20 行时，拆成独立组件
    // node.getComponent(XXXItemNode).setData(itemData);

    const bottom = node.getChildByName("bottom");
    // ...简单文本或进度条赋值逻辑...

    this.setRwdContent(node.getChildByName("content"), itemData.items);
}

private setRwdContent(itemBox: Node, rwd: any[], itemScale: number = 1) {
    const childNodes = itemBox.children;
    const length = Math.max(rwd.length, childNodes.length);

    for (let index = 0; index < length; index++) {
        let childNd = childNodes[index];
        const itemVO = rwd[index];

        if (itemVO) {
            const prop = UniverseModel.instance.getSomeByKindAndId(itemVO.id, itemVO.kind, itemVO.count);

            if (childNd == null) {
                childNd = instantiate(this.rwdIconItem);
                childNd.parent = itemBox;
            }

            childNd.active = true;
            childNd.scale = v3(itemScale, itemScale, itemScale);
            childNd.getChildByName("ItemIcon").getComponent(ItemIcon).setData(prop);
        } else {
            if (childNd) {
                childNd.active = false;
            }
        }
    }
}
```

## 注意

- 上方骨架是迁移自原 `.claude/skills/ui/claudeListSkill.md` 的 Codex 技能版本。
- 实际项目中 `UniverseModel`、`ItemIcon`、奖励结构字段需按当前模块调整。

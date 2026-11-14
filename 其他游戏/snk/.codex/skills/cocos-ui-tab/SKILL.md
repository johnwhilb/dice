---
name: cocos-ui-tab
description: Cocos Creator UI Tab 切换与多状态管理规范。Use when implementing or refactoring Cocos Creator TypeScript views with tab buttons, rankings, activity panels, multi-state UI switching, currentTab state, tabConfig/rankConfig mappings, or data-driven tab rendering.
---

# Cocos Creator UI Tab 切换与多状态管理规范

## 核心原则

- 带有 Tab 页签切换的界面必须建立清晰的状态管理和 UI 更新机制。
- 避免冗长散乱的 `if-else` 分支，使用配置化、数据驱动的方式管理不同 Tab 下的 UI 差异。

## 状态定义

- 必须使用 `enum` 或 `const enum` 定义所有 Tab 状态，例如 `XxxTab`。
- 维护一个与节点顺序或展示顺序对应的 Tab 映射数组，例如 `RankViewTab`。
- 初始化时使用 Tab 映射数组绑定按钮数据和控制节点显隐。

## 配置化差异管理

- 如果不同 Tab 切换时涉及多处 UI 文本、节点状态、图片路径或多语言 Key 变更，必须定义配置数组，例如 `tabConfig` 或 `rankConfig`。
- 更新视图时，通过 `find` 或索引查找对应配置对象并直接赋值。
- 禁止写长段 `if (tab === 0) { ... } else if (tab === 1) { ... }`。
- 如果 Tab 切换只是改变当前选中值，没有额外 UI 差异，可以只保留 Tab 数组映射和按钮高亮更新逻辑。

## 点击与刷新解耦

- 点击事件只负责修改 `currentTab` 并调用刷新方法，例如 `updateView()`。
- 所有 UI 高亮、按钮交互状态、文本、图片、列表刷新都放在刷新方法里。
- 更新按钮高亮、节点显隐和图片替换时，优先使用布尔表达式或三元运算符。

## 代码骨架

```typescript
import { _decorator, Button, Event, Label } from "cc";
import { BaseView } from "../../common/base/BaseView";

const { ccclass } = _decorator;

const enum RankTab {
    Popular = 0,
    KingTitle = 1,
    EmperorTitle = 2,
}

const RankViewTab = [RankTab.Popular, RankTab.KingTitle, RankTab.EmperorTitle];

@ccclass("PopularRankView")
export class PopularRankView extends BaseView {

    private currentTab: RankTab = RankTab.Popular;

    private rankConfig = [
        {
            id: RankTab.Popular,
            lbtScore: "palaceA.title1",
            lbtMyScore: "palaceA.renqiZhi",
        },
        {
            id: RankTab.KingTitle,
            lbtScore: "palaceA.title2",
            lbtMyScore: "palaceA.chengwang",
        },
        {
            id: RankTab.EmperorTitle,
            lbtScore: "palaceA.title3",
            lbtMyScore: "palaceA.chenghuang",
        },
    ];

    start(): void {
        this.initView();
        this.updateView();
    }

    initView() {
        const tabNodes = this.get("rankTab").children;

        for (let index = 0; index < tabNodes.length; index++) {
            const tabNode = tabNodes[index];
            const tabType = RankViewTab[index];

            tabNode.active = !!tabType || tabType === 0;

            if (!tabNode.active) {
                continue;
            }

            tabNode.getComponent(Button).clickEvents[0].customEventData = tabType.toString();
        }
    }

    updateView() {
        const tabNodes = this.get("rankTab").children;

        for (let index = 0; index < tabNodes.length; index++) {
            const btnNode = tabNodes[index];
            const tabType = RankViewTab[index];
            const selected = tabType === this.currentTab;

            btnNode.getComponent(Button).interactable = !selected;
            this.setImage(btnNode, selected ? "texture/res/activity/redPacket/3" : "texture/res/activity/redPacket/4");
        }

        const rankConfig = this.rankConfig.find(item => item.id === this.currentTab);

        if (rankConfig) {
            this.get("scoreText").getComponent(Label).string = lang(rankConfig.lbtScore);
        }

        this.updateAll();
    }

    updateAll() {
        // ...根据 currentTab 获取数据并更新 List
    }

    on_btnRankTab_Click(event: Event, customEventData: string) {
        this.currentTab = Number(customEventData);
        this.updateView();
    }
}
```

## 注意

- 上方骨架是迁移自原 `.claude/skills/ui/cluadeTabSkill.md` 的 Codex 技能版本。
- 实际按钮回调名必须按项目节点名使用 `on_节点名_Click` 格式。

import { _decorator, Color, EventTouch, Graphics, Label, Node } from 'cc';
import { GameComponent } from 'db://oops-framework/module/common/GameComponent';
import { TableClimbLevel } from '../common/table/TableClimbLevel';
import type { LevelSelectView } from './LevelSelectView';

const { ccclass } = _decorator;

@ccclass('LevelItemView')
export class LevelItemView extends GameComponent {
    private level!: TableClimbLevel;
    private selectView!: LevelSelectView;
    private background!: Graphics;
    private title!: Label;
    private selected!: Node;

    init(level: TableClimbLevel, selectView: LevelSelectView) {
        this.level = level;
        this.selectView = selectView;
        this.nodeTreeInfoLite();
        this.background = this.getNode('CardBackground')!.addComponent(Graphics);
        this.title = this.getNode('LevelName')!.getComponent(Label)!;
        this.selected = this.getNode('Selected')!;
        this.getNode('LevelNumber')!.getComponent(Label)!.string = `LV${level.level}`;
        this.title.string = level.displayName;
        this.getNode('LevelInfo')!.getComponent(Label)!.string = `高度 ${level.height} · ${level.getHolds().length} 个岩点`;
        const danger = level.getDangerCount();
        const dangerText = this.getNode('DangerText')!.getComponent(Label)!;
        dangerText.string = danger ? `${danger} 个危险岩点 · 快速转移` : '安全练习 · 无危险岩点';
        dangerText.color = danger ? new Color(255, 173, 131) : new Color(200, 251, 116);
        this.node.on(Node.EventType.TOUCH_END, this.onSelect, this);
    }

    render(selectedId: number) {
        const selected = this.level.id === selectedId;
        this.selected.active = selected;
        this.title.color = selected ? new Color(200, 251, 116) : new Color(246, 242, 223);
        this.background.clear();
        this.background.fillColor = selected ? new Color(42, 59, 47) : new Color(29, 44, 54);
        this.background.strokeColor = selected ? new Color(200, 251, 116) : new Color(64, 81, 89);
        this.background.lineWidth = selected ? 2 : 1;
        this.background.roundRect(-164, -63, 328, 126, 16);
        this.background.fill();
        this.background.stroke();
    }

    private onSelect(event: EventTouch) {
        event.propagationStopped = true;
        this.selectView.selectLevel(this.level.id);
    }
}

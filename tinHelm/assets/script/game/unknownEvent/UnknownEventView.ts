import { _decorator, Button, instantiate, Label, Layout, Node } from 'cc';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { UnknownEvent } from './UnknownEvent';

const { ccclass } = _decorator;

@ccclass('UnknownEventView')
@ecs.register('UnknownEventView', false)
@gui.register('UnknownEventView', { layer: LayerType.UI, prefab: 'gui/unknownEvent/unKnowEventView' })
export class UnknownEventView extends CCView<UnknownEvent> {
    private optionNodes: Node[] = [];

    start() {
        this.nodeTreeInfoLite();
        this.refresh();
    }

    refresh() {
        const event = this.ent.UnknownEventBll.getCurrentEvent();
        this.getNode('lbtEventName')!.getComponent(Label)!.string = event?.name ?? '未知事件';
        this.getNode('lbtEventDes')!.getComponent(Label)!.string = event?.des ?? '';
        const layout = this.getNode('selectLayout')!;
        const template = this.getNode('nodeEventSelect')!;
        template.active = false;
        for (const node of this.optionNodes) {
            node.off(Button.EventType.CLICK);
            node.removeFromParent();
            node.destroy();
        }
        this.optionNodes = [];
        for (const option of this.ent.UnknownEventModel.options) {
            const node = instantiate(template);
            node.getChildByName('lbtName')!.getComponent(Label)!.string = option.selectName ?? '';
            node.getChildByName('lbtDes')!.getComponent(Label)!.string = option.selectDes ?? '';
            node.on(Button.EventType.CLICK, () => {
                this.ent.UnknownEventBll.selectOption(option.id);
            }, this);
            node.parent = layout;
            node.active = true;
            this.optionNodes.push(node);
        }
        layout.getComponent(Layout)!.updateLayout();
    }

    reset() {
        for (const node of this.optionNodes) {
            node.off(Button.EventType.CLICK);
        }
        this.optionNodes = [];
    }
}

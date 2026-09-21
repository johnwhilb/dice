import { _decorator, Sprite } from 'cc';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { StoryEvent } from './StoryEvent';

const { ccclass } = _decorator;

@ccclass('StoryEventView')
@ecs.register('StoryEventView', false)
@gui.register('StoryEventView', { layer: LayerType.UI, prefab: 'gui/storyEvent/StoryEventView' })
export class StoryEventView extends CCView<StoryEvent> {
    private flowIds: number[] = [];

    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.flowIds = this.ent.getSelectableFlowIds();
        this.refreshSelections();
    }

    btnHide() {
    }

    btnSelect1() {
        this.selectFlow(0);
    }

    btnSelect2() {
        this.selectFlow(1);
    }

    showSelections(visible: boolean) {
        this.getNode('nodeSelect')!.active = visible;
        this.getNode('lbtTitle')!.active = visible;
    }

    updateBackground(path: string) {
        const sprite = this.getNode('spBg')!.getComponent(Sprite)!;
        sprite.node.active = !!path;
        if (path) {
            const spritePath = path.endsWith('/spriteFrame') ? path : `${path}/spriteFrame`;
            this.setSprite(sprite, spritePath);
        }
    }

    private refreshSelections() {
        const buttons = [this.getNode('btnSelect1')!, this.getNode('btnSelect2')!];
        buttons.forEach((button, index) => {
            button.active = !!this.flowIds[index];
        });
        this.showSelections(true);
    }

    private selectFlow(index: number) {
        const flowId = this.flowIds[index] ?? 0;
        if (flowId) {
            this.ent.selectFlow(flowId);
        }
    }

    reset() {
        this.flowIds = [];
    }
}

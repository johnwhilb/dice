import { CCView } from 'db://oops-framework/module/common/CCView';
import { _decorator, Node, Sprite, UITransform, view } from 'cc';
import { MainMenu } from '../MainMenu';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { ProfileEvent } from '../../profile/ProfileEvent';
const { ccclass, property } = _decorator;

@ccclass("MainMenuView")
@ecs.register("MainMenuView", false)
@gui.register('MainMenuView', { layer: LayerType.UI, prefab: 'gui/mainMenu/ui/MainMenuView' })
export class MainMenuView extends CCView<MainMenu> {

    @property(Node)
    private videoNode!: Node;
    private isBtnStartShow = false
    private isCanContinueShow = false

    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.refresh();
        this.on(ProfileEvent.currentSelectedAvatarIdChanged, this.refresh, this);
    }

    refresh() {
        const btnContinue = this.getNode("btnContinue");
        if (btnContinue) {
            btnContinue.active = this.ent.hasSave();
        }
    }

    btnContinue() {
        this.ent.continueGame();
    }

    btnStart() {
        this.ent.entryGame();
    }

    btnProfile() {
        this.ent.openProfileDialog();
    }

    reset() {
    }

}

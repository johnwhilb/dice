import { CCView } from 'db://oops-framework/module/common/CCView';
import { _decorator } from 'cc';
import { MainMenu } from '../MainMenu';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { smc } from '../../common/SingletonModuleComp';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { Sprite } from 'cc';
import { ResPath } from '../../common/config/ResPath';
import { ProfileEvent } from '../../profile/ProfileEvent';
import { TweenAnimUtil } from '../../common/util/TweenAnimUtil';
const { ccclass } = _decorator;

@ccclass("MainMenuView")
@ecs.register("MainMenuView", false)
@gui.register('MainMenuView', { layer: LayerType.UI, prefab: 'gui/mainMenu/ui/MainMenuView' })
export class MainMenuView extends CCView<MainMenu> {
    private isBtnStartShow = false
    private isCanContinueShow = false

    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.refresh();
        this.on(ProfileEvent.currentSelectedAvatarIdChanged, this.refresh, this);
    }

    refresh() {
        const spRoleHead = this.getNode("spRoleHead")!.getComponent(Sprite)!;
        this.setSprite(spRoleHead, ResPath.getSpriteRoleHead(smc.profile.getCurrentSelectedAvatarId()));
        const btnContinue = this.getNode("btnContinue");
        if (btnContinue) {
            btnContinue.active = this.ent.hasSave();
        }
        this.updateSpRole();
    }

    updateSpRole() {
        const spRole = this.getNode('spRole')!.getComponent(Sprite);
        const currentSelectedAvatarId = smc.profile.getCurrentSelectedAvatarId();
        this.setSprite(spRole, ResPath.getSpriteRoleBody(currentSelectedAvatarId));
    }

    btnContinue() {
        if (this.isCanContinueShow) {
            console.log("点击继续")
        } else {
            const btnContinue = this.getNode("btnContinue");
            TweenAnimUtil.move(btnContinue!, -300, 0);
            this.isCanContinueShow = true
        }
    }

    btnStart() {
        if (this.isBtnStartShow) {
            console.log("点击继续")
        } else {
            const btnStart = this.getNode("btnStart");
            TweenAnimUtil.move(btnStart!, -300, 0, 0.5, () => {
                this.isBtnStartShow = true
            });
        }
    }


    btnHide() {
        if (this.isBtnStartShow) {
            const btnStart = this.getNode("btnStart");
            TweenAnimUtil.move(btnStart!, 300, 0, 0.5, () => {
                this.isBtnStartShow = false
            });
        }
        if (this.isCanContinueShow) {
            const btnContinue = this.getNode("btnContinue");
            TweenAnimUtil.move(btnContinue!, 300, 0);
            this.isCanContinueShow = false
        }
    }

    btnProfile() {
        this.ent.openProfileDialog();
    }



    reset() {

    }



}
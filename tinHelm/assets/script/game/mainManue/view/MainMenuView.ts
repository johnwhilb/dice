import { CCView } from 'db://oops-framework/module/common/CCView';
import { _decorator, Node, Sprite, UITransform, view } from 'cc';
import { MainMenu } from '../MainMenu';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { smc } from '../../common/SingletonModuleComp';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { ResPath } from '../../common/config/ResPath';
import { ProfileEvent } from '../../profile/ProfileEvent';
import { TweenAnimUtil } from '../../common/util/TweenAnimUtil';
import { VideoManager } from '../../common/video/VideoManager';
const { ccclass, property } = _decorator;

@ccclass("MainMenuView")
@ecs.register("MainMenuView", false)
@gui.register('MainMenuView', { layer: LayerType.UI, prefab: 'gui/mainMenu/ui/MainMenuView' })
export class MainMenuView extends CCView<MainMenu> {
    private static readonly MENU_VIDEO = 'audios/Wan 2.7_1787812433883';

    @property(Node)
    private videoNode!: Node;
    private isBtnStartShow = false
    private isCanContinueShow = false



    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.refresh();
        this.on(ProfileEvent.currentSelectedAvatarIdChanged, this.refresh, this);
        this.playMenuVideo();
    }

    private playMenuVideo() {
        const videoNode = this.videoNode;
        const sprite = videoNode.getComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.RAW;
        let videoManager = videoNode.getComponent(VideoManager);
        if (!videoManager) {
            videoManager = videoNode.addComponent(VideoManager);
        }
        videoManager.videoSprite = sprite;
        videoManager.initVideo();
        videoManager.play(MainMenuView.MENU_VIDEO, { loop: true, muted: true, playMode: "forward-reverse" });
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
        const btnStart = this.getNode("btnStart");
        if (this.isBtnStartShow) {
            this.ent.entryGame();
            TweenAnimUtil.move(btnStart!, 300, 0, 0.5, () => {
                this.isBtnStartShow = false
            });
        } else {
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

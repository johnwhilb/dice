import { CCView } from 'db://oops-framework/module/common/CCView';
import { _decorator } from 'cc';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { Battle } from '../Battle';
import { BattlePhase } from '../model/BattleModel';
import { Widget } from 'cc';
import { TweenAnimUtil } from '../../common/util/TweenAnimUtil';
import { Sprite } from 'cc';
import { smc } from '../../common/SingletonModuleComp';
import { ResPath } from '../../common/config/ResPath';

const { ccclass } = _decorator;


@ccclass("BattleView")
@ecs.register("BattleView", false)
@gui.register('BattleView', { layer: LayerType.PopUp, prefab: 'gui/battle/BattleView' })
export class BattleView extends CCView<Battle> {

    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.initView();
        this.refresh();
    }

    initView() {
        const spRole = this.getNode('spRole')!.getComponent(Sprite);
        const currentSelectedAvatarId = smc.player.getSelectedRoleId();
        this.setSprite(spRole, ResPath.getSpriteRoleBody(currentSelectedAvatarId));
    }

    refresh() {
        switch (this.ent.BattleModel.phase) {
            case BattlePhase.Start:
                this.startBattlePhase();
                this.ent.initBattleScene();
                this.ent.changePhase();
                break;
            case BattlePhase.PlayerStart:
                console.log('玩家开始');
                break;
            default:
                break;
        }
    }

    startBattlePhase() {
        TweenAnimUtil.move(this.getNode("nodeCurrentPhase")!, 250, 0);
        TweenAnimUtil.move(this.getNode("nodeCurrentRound")!, -250, 0);
    }

    btnClose() {
        this.ent.closeBattleView();
    }

    reset(): void {
    }


}

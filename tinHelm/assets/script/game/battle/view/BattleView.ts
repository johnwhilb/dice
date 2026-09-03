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
import { Label } from 'cc';

const { ccclass } = _decorator;


@ccclass("BattleView")
@ecs.register("BattleView", false)
@gui.register('BattleView', { layer: LayerType.UI, prefab: 'gui/battle/BattleView' })
export class BattleView extends CCView<Battle> {

    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.refresh();
        this.startBattleAnimation();
    }


    refresh() {
        switch (this.ent.BattleModel.phase) {
            case BattlePhase.Start:
                this.ent.initBattleSceneInfo();
                this.initPlayerView()
                this.initEnemyView()
                this.updatePlayerStatus();
                this.updateEnemyStatus();
                this.ent.changePhase();
                break;
            case BattlePhase.PlayerStart:
                console.log('玩家开始');
                break;
            default:
                break;
        }
    }

    initPlayerView() {
        const spRole = this.getNode('spRole')!.getComponent(Sprite);
        const currentSelectedAvatarId = smc.player.getSelectedRoleId();
        this.setSprite(spRole, ResPath.getSpriteRoleBody(currentSelectedAvatarId));
    }

    initEnemyView() {
        const spEnemy = this.getNode('spEnemy')!.getComponent(Sprite);
        const currentSelectedAvatarId = this.ent.BattleEnemyModel.enemyId;
        this.setSprite(spEnemy, ResPath.getSpriteEnemyBody(currentSelectedAvatarId));
    }

    updatePlayerStatus() {
        const lbtPlayerHP = this.getNode('lbtPlayerHP')!.getComponent(Label);
        lbtPlayerHP.string = this.ent.BattlePlayerModel.hp + "/" + this.ent.BattlePlayerModel.maxHp;
    }

    updateEnemyStatus() {
        const lbtEnemyHP = this.getNode('lbtEnemyHP')!.getComponent(Label);
        lbtEnemyHP.string = this.ent.BattleEnemyModel.hp + "/" + this.ent.BattleEnemyModel.maxHp;

    }

    startBattleAnimation() {
        TweenAnimUtil.move(this.getNode("nodeCurrentPhase")!, 250, 0);
        TweenAnimUtil.move(this.getNode("nodeCurrentRound")!, -250, 0);
    }

    btnClose() {
        this.ent.closeBattleView();
    }

    reset(): void {
    }


}

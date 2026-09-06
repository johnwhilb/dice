import { CCView } from 'db://oops-framework/module/common/CCView';
import { _decorator } from 'cc';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { Battle } from '../Battle';
import { BattlePhase } from '../model/BattleModel';
import { TweenAnimUtil } from '../../common/util/TweenAnimUtil';
import { Sprite } from 'cc';
import { smc } from '../../common/SingletonModuleComp';
import { ResPath } from '../../common/config/ResPath';
import { Label } from 'cc';
import { nodeDice } from '../../dice/nodeDice';
import { TableDice } from '../../common/table/TableDice';
import { TableRole } from '../../common/table/TableRole';
import { Prefab } from 'cc';
import { instantiate } from 'cc';

const { ccclass, property } = _decorator;


@ccclass("BattleView")
@ecs.register("BattleView", false)
@gui.register('BattleView', { layer: LayerType.UI, prefab: 'gui/battle/BattleView' })
export class BattleView extends CCView<Battle> {

    @property({ type: Prefab })
    prefabDice: Prefab = null!;

    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.refresh();
        this.startBattleAnimation();
        this.initDiceView();
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

    initDiceView() {
        const diceLayout = this.getNode('diceLayout')!;
        diceLayout.destroyAllChildren();
        const playerId = smc.player.getSelectedRoleId();
        const diceInfo = TableRole.getConfigById(playerId)!.originDice;
        for (const item of diceInfo) {
            const diceNode = instantiate(this.prefabDice);
            diceNode.parent = diceLayout;
            const diceView = diceNode.getComponent(nodeDice) || diceNode.addComponent(nodeDice);
            for (let i = 0; i < item.length; i++) {
                const face = diceNode.children[i].getChildByName('spIcon')!.getComponent(Sprite);
                const lbtNum = diceNode.children[i].getChildByName('lbtNum')!.getComponent(Label);
                lbtNum.string = `${item[i]}`;
                const diceId = TableDice.getAllConfig().find(dice => dice.role === playerId && dice.diceNum.includes(item[i]))!.id;
                this.setSprite(face, ResPath.getSpriteDice(diceId));
            }
            diceView.syncFaces();
            diceView.stopAtFace(1);
        }
    }

    btnThrow() {
        const diceLayout = this.getNode('diceLayout');
        if (!diceLayout || diceLayout.children.length <= 0) {
            return;
        }

        const diceIndex = Math.floor(Math.random() * diceLayout.children.length);
        const face = Math.floor(Math.random() * 6) + 1;
        this.throwDice(diceIndex, face);
    }

    throwDice(diceIndex: number, face: number): void {
        const diceLayout = this.getNode('diceLayout');
        const dice = diceLayout?.children[diceIndex];
        const diceView = dice?.getComponent(nodeDice);
        if (!diceView) {
            return;
        }

        diceView.rollToFace(face, 2);
    }

    btnClose() {
        this.ent.closeBattleView();
    }

    reset(): void {
    }
}

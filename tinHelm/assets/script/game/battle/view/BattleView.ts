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
import { EventTouch, instantiate, Node, UITransform, Vec3 } from 'cc';
import { TableCard } from '../../common/table/TableCard';
import { nodeCard } from '../../card/nodeCard';
import { BattleEvent } from '../BattleEvent';
import { GraphView } from '../../ui/GraphView';

const { ccclass, property } = _decorator;

@ccclass("BattleView")
@ecs.register("BattleView", false)
@gui.register('BattleView', { layer: LayerType.UI, prefab: 'gui/battle/BattleView' })
export class BattleView extends CCView<Battle> {

    @property({ type: Prefab })
    prefabDice: Prefab = null!;

    @property({ type: Prefab })
    prefabCard: Prefab = null!;

    private readonly cardGestureJudgeThreshold = 8;
    private readonly maxHandCardCount = 5;
    private readonly cardTouchStartPos = new Vec3();

    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.on(BattleEvent.refreshBattlePhase, this.refresh, this);
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
                this.updateCardList();
                console.log('玩家开始');
                break;
            default:
                break;
        }
    }

    updateCardList() {
        const cardLayout = this.getNode('cardLayout')!;
        cardLayout.destroyAllChildren();
        this.ent.BattlePlayerModel.handCards.slice(0, this.maxHandCardCount).forEach((cardId) => {
            const card = TableCard.getConfigById(cardId);
            if (!card) {
                return;
            }
            const cardNode = instantiate(this.prefabCard);
            cardNode.parent = cardLayout;
            cardNode.getComponent(nodeCard)!.setData(card);
            this.bindCardGesture(cardNode);
        });
    }

    private bindCardGesture(cardNode: Node) {
        cardNode.off(Node.EventType.TOUCH_START, this.onCardTouchStart, this);
        cardNode.off(Node.EventType.TOUCH_MOVE, this.onCardTouchMove, this);
        cardNode.off(Node.EventType.TOUCH_END, this.onCardTouchEnd, this);
        cardNode.off(Node.EventType.TOUCH_CANCEL, this.onCardTouchEnd, this);
        cardNode.on(Node.EventType.TOUCH_START, this.onCardTouchStart, this);
        cardNode.on(Node.EventType.TOUCH_MOVE, this.onCardTouchMove, this);
        cardNode.on(Node.EventType.TOUCH_END, this.onCardTouchEnd, this);
        cardNode.on(Node.EventType.TOUCH_CANCEL, this.onCardTouchEnd, this);
    }

    private onCardTouchStart(event: EventTouch) {
        const touchPos = event.getUILocation();
        this.cardTouchStartPos.set(touchPos.x, touchPos.y, 0);
    }

    private onCardTouchMove(event: EventTouch) {
        const touchPos = event.getUILocation();
        const touchWorldPos = new Vec3(touchPos.x, touchPos.y, 0);
        const moveDistance = Vec3.distance(this.cardTouchStartPos, touchWorldPos);
        if (moveDistance < this.cardGestureJudgeThreshold) {
            return;
        }

        if (this.isWorldPosInsideNode(touchWorldPos, this.getNode('cardLayout')!)) {
            return;
        }

        this.getNode('nodeGraphView')!
            .getComponent(GraphView)!
            .drawBezierCurveByWorldPos(this.cardTouchStartPos, touchWorldPos);
    }

    private onCardTouchEnd(event: EventTouch) {
        this.getNode('nodeGraphView')!.getComponent(GraphView)!.reset();
        const touchPos = event.getUILocation();
        const touchWorldPos = new Vec3(touchPos.x, touchPos.y, 0);
        if (this.isWorldPosInsideNode(touchWorldPos, this.getNode('spEnemy')!)) {
            console.log('点击了敌人');
        } else {
            console.log('点击了其他区域');
        }
    }

    private isWorldPosInsideNode(worldPos: Vec3, node: Node) {
        const uiTransform = node.getComponent(UITransform)!;
        const localPos = uiTransform.convertToNodeSpaceAR(worldPos);
        const minX = -uiTransform.width * uiTransform.anchorX;
        const maxX = uiTransform.width * (1 - uiTransform.anchorX);
        const minY = -uiTransform.height * uiTransform.anchorY;
        const maxY = uiTransform.height * (1 - uiTransform.anchorY);
        return localPos.x >= minX
            && localPos.x <= maxX
            && localPos.y >= minY
            && localPos.y <= maxY;
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
        // for (const item of diceInfo.entries()) {
        //     const diceNode = instantiate(this.prefabDice);
        //     diceNode.parent = diceLayout;
        //     const diceView = diceNode.getComponent(nodeDice)
        //     for (let i = 0; i < item.length; i++) {
        //         const face = diceNode.children[i].getChildByName('spIcon')!.getComponent(Sprite);
        //         const lbtNum = diceNode.children[i].getChildByName('lbtNum')!.getComponent(Label);
        //         lbtNum.string = `${item[i]}`;
        //         const diceId = TableDice.getAllConfig().find(dice => dice.role === playerId && dice.diceNum.includes(item[i]))!.id;
        //         this.setSprite(face, ResPath.getSpriteDice(diceId));
        //     }
        //     diceView.syncFaces();
        //     diceView.stopAtFace(1);
        // }


        for (let i = 0; i < diceInfo.length; i++) {
            const diceNode = instantiate(this.prefabDice);
            diceNode.parent = diceLayout;
            const diceView = diceNode.getComponent(nodeDice)
            diceView.setIndex(i);
            for (let j = 0; j < diceInfo[i].length; j++) {
                const face = diceNode.children[j].getChildByName('spIcon')!.getComponent(Sprite);
                const lbtNum = diceNode.children[j].getChildByName('lbtNum')!.getComponent(Label);
                lbtNum.string = `${diceInfo[i][j]}`;
                const diceId = TableDice.getAllConfig().find(dice => dice.role === playerId && dice.diceNum.includes(diceInfo[i][j]))!.id;
                this.setSprite(face, ResPath.getSpriteDice(diceId));
            }

            diceView.syncFaces();
            diceView.stopAtFace(1);
        }




    }

    btnThrow() {
        const lockedState = this.ent.BattlePlayerModel.diceLocked.slice();
        const diceValues = this.ent.BattleDiceBll.resetDice();
        diceValues.forEach((diceValue, diceIndex) => {
            if (!lockedState.includes(diceIndex)) {
                this.throwDice(diceIndex, diceValue);
            }
        });
    }

    throwDice(diceIndex: number, diceValue: number): void {
        const diceLayout = this.getNode('diceLayout');
        const dice = diceLayout?.children[diceIndex];
        const diceView = dice?.getComponent(nodeDice);
        if (!diceView) {
            return;
        }

        diceView.rollToFaceValue(diceValue, 2);
    }

    btnClose() {
        this.ent.closeBattleView();
    }

    reset(): void {
    }
}

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
import { instantiate, Node } from 'cc';
import List from '../../ui/List';
import { TableCard } from '../../common/table/TableCard';
import { nodeCard } from '../../card/nodeCard';
import { BattleEvent } from '../BattleEvent';
import { EventTouch, ScrollView, UITransform, Vec3 } from 'cc';
import { GraphView } from '../../ui/GraphView';

const { ccclass, property } = _decorator;


@ccclass("BattleView")
@ecs.register("BattleView", false)
@gui.register('BattleView', { layer: LayerType.UI, prefab: 'gui/battle/BattleView' })
export class BattleView extends CCView<Battle> {

    @property({ type: Prefab })
    prefabDice: Prefab = null!;

    private readonly cardGestureJudgeThreshold: number = 8;

    private cardTouchStartPos: Vec3 = new Vec3();

    private lineIsMove: boolean = false;

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
        this.getNode('cardList')!.getComponent(List).numItems = this.ent.BattlePlayerModel.handCards.length;
    }

    updateCardItem(node: Node, index: number) {
        const cardList = this.ent.BattlePlayerModel.handCards;
        const item = TableCard.getConfigById(cardList[index]);
        node.getComponent(nodeCard).setData(item!);
        this.bindCardGesture(node);
    }

    private bindCardGesture(node: Node) {
        node.off(Node.EventType.TOUCH_START, this.onCardTouchStart, this);
        node.off(Node.EventType.TOUCH_MOVE, this.onCardTouchMove, this);
        node.off(Node.EventType.TOUCH_END, this.onCardTouchEnd, this);
        node.off(Node.EventType.TOUCH_CANCEL, this.onCardTouchEnd, this);

        node.on(Node.EventType.TOUCH_START, this.onCardTouchStart, this);
        node.on(Node.EventType.TOUCH_MOVE, this.onCardTouchMove, this);
        node.on(Node.EventType.TOUCH_END, this.onCardTouchEnd, this);
        node.on(Node.EventType.TOUCH_CANCEL, this.onCardTouchEnd, this);
    }

    private onCardTouchStart(event: EventTouch) {
        const touchPos = event.getUILocation();
        this.cardTouchStartPos.set(touchPos.x, touchPos.y, 0);
        const cardListScrollView = this.getNode('cardList')!.getComponent(ScrollView);
        cardListScrollView.horizontal = false;
        cardListScrollView.vertical = false;
    }

    private onCardTouchMove(event: EventTouch) {
        const touchPos = event.getUILocation();
        const deltaX = touchPos.x - this.cardTouchStartPos.x;
        const deltaY = touchPos.y - this.cardTouchStartPos.y;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        if (Math.max(absX, absY) < this.cardGestureJudgeThreshold) {
            return;
        }
        if (absY > absX) {
            this.getNode('cardList')!.getComponent(ScrollView).horizontal = false;
        } else if (!this.lineIsMove) {
            this.getNode('cardList')!.getComponent(ScrollView).horizontal = true;
        }

        if (!this.isWorldPosInsideNode(new Vec3(touchPos.x, touchPos.y, 0), this.getNode('cardList')!)) {
            const graphView = this.getNode('nodeGraphView')!.getComponent(GraphView);
            graphView.drawBezierCurveByWorldPos(this.cardTouchStartPos, new Vec3(touchPos.x, touchPos.y, 0));
            this.lineIsMove = true;
        }

    }

    private onCardTouchEnd(event: EventTouch) {
        this.lineIsMove = false;
        const graphView = this.getNode('nodeGraphView')!.getComponent(GraphView);
        graphView.getComponent(GraphView)!.reset();
        this.getNode('cardList')!.getComponent(ScrollView).horizontal = true;
        const touchPos = event.getUILocation();
        if (this.isWorldPosInsideNode(new Vec3(touchPos.x, touchPos.y, 0), this.getNode('spEnemy')!)) {
            console.log('点击了敌人');
        } else {
            console.log('点击了其他区域');
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
        const lockedState = this.ent.BattlePlayerModel.diceLocked.slice();
        const diceValues = this.ent.BattleDiceBll.resetDice();
        diceValues.forEach((diceValue, diceIndex) => {
            if (!lockedState[diceIndex]) {
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


    isWorldPosInsideNode(worldPos: Vec3, node: Node): boolean {
        const uiTransform = node.getComponent(UITransform);
        if (!uiTransform) {
            return false;
        }
        const localPos = uiTransform.convertToNodeSpaceAR(worldPos);
        const width = uiTransform.width;
        const height = uiTransform.height;
        const anchorX = uiTransform.anchorX;
        const anchorY = uiTransform.anchorY;
        const minX = -width * anchorX;
        const maxX = width * (1 - anchorX);
        const minY = -height * anchorY;
        const maxY = height * (1 - anchorY);
        return (
            localPos.x >= minX &&
            localPos.x <= maxX &&
            localPos.y >= minY &&
            localPos.y <= maxY
        );
    }
}

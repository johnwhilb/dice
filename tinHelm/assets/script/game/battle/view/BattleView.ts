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
import { BezierCurveUtil } from '../../common/util/BezierCurveUtil';

const { ccclass, property } = _decorator;

enum CardGestureDirection {
    None,
    Horizontal,
    Vertical,
}


@ccclass("BattleView")
@ecs.register("BattleView", false)
@gui.register('BattleView', { layer: LayerType.UI, prefab: 'gui/battle/BattleView' })
export class BattleView extends CCView<Battle> {

    @property({ type: Prefab })
    prefabDice: Prefab = null!;

    private readonly cardGestureJudgeThreshold: number = 8;
    private readonly cardBezierTriggerThreshold: number = 45;
    private readonly cardBezierNodeName: string = 'nodeCardBezierCurve';

    private cardGestureDirection: CardGestureDirection = CardGestureDirection.None;
    private cardTouchStartPos: Vec3 = new Vec3();
    private currentTouchCard: Node | null = null;
    private cardListScrollView: ScrollView | null = null;
    private cardListOriginalHorizontal: boolean = true;
    private cardListOriginalVertical: boolean = false;
    private cardBezierCurve: BezierCurveUtil | null = null;

    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.refresh();
        this.startBattleAnimation();
        this.initDiceView();
        this.on(BattleEvent.refreshBattlePhase, this.refresh, this);
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
        this.cardGestureDirection = CardGestureDirection.None;
        this.currentTouchCard = event.currentTarget as Node;

        this.cardListScrollView =
            this.getNode('cardList')!.getComponent(ScrollView);

        if (this.cardListScrollView) {
            // 保存原状态
            this.cardListOriginalHorizontal = this.cardListScrollView.horizontal;
            this.cardListOriginalVertical = this.cardListScrollView.vertical;

            // ★ 方向未确定之前，不允许 ScrollView 移动
            this.cardListScrollView.horizontal = false;
            this.cardListScrollView.vertical = false;
        }

        this.getCardBezierCurve().reset();
    }

    private onCardTouchMove(event: EventTouch) {
        if (!this.currentTouchCard) {
            return;
        }

        const touchPos = event.getUILocation();

        const deltaX = touchPos.x - this.cardTouchStartPos.x;
        const deltaY = touchPos.y - this.cardTouchStartPos.y;

        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // =========================
        // 第一次确定手势方向
        // =========================
        if (this.cardGestureDirection === CardGestureDirection.None) {

            if (Math.max(absX, absY) < this.cardGestureJudgeThreshold) {
                return;
            }

            // ★ 向上滑
            if (
                deltaY > 0 &&
                absY > absX
            ) {
                this.cardGestureDirection = CardGestureDirection.Vertical;

                // 禁止 ScrollView
                this.lockCardListSlide();

                // ★ 非常重要：不再继续往 ScrollView 传
                event.propagationStopped = true;
            }
            else if (absX > absY) {
                this.cardGestureDirection = CardGestureDirection.Horizontal;
                if (this.cardListScrollView) {
                    this.cardListScrollView.horizontal =
                        this.cardListOriginalHorizontal;
                    this.cardListScrollView.vertical =
                        this.cardListOriginalVertical;
                }
                return;
            }

            // 方向还不明确
            else {
                return;
            }
        }

        // =========================
        // 已经锁定横向
        // =========================
        if (
            this.cardGestureDirection ===
            CardGestureDirection.Horizontal
        ) {
            return;
        }

        // =========================
        // 已经锁定向上
        // =========================
        event.propagationStopped = true;

        if (absY >= this.cardBezierTriggerThreshold) {
            this.drawCardBezierCurve(
                this.currentTouchCard,
                new Vec3(touchPos.x, touchPos.y, 0)
            );
        } else {
            this.getCardBezierCurve().reset();
        }
    }

    private onCardTouchEnd(event: EventTouch) {
        if (this.cardGestureDirection === CardGestureDirection.Vertical) {
            event.propagationStopped = true;
            this.cardListScrollView?.node.emit('touch-up');
        }
        this.getCardBezierCurve().reset();
        this.unlockCardListSlide();
        this.cardGestureDirection = CardGestureDirection.None;
        this.currentTouchCard = null;
        this.cardListScrollView = null;
    }

    private lockCardListSlide() {
        if (!this.cardListScrollView) {
            return;
        }
        this.cardListScrollView.horizontal = false;
        this.cardListScrollView.vertical = false;
    }

    private unlockCardListSlide() {
        if (!this.cardListScrollView) {
            return;
        }
        this.cardListScrollView.horizontal = this.cardListOriginalHorizontal;
        this.cardListScrollView.vertical = this.cardListOriginalVertical;
    }

    private drawCardBezierCurve(cardNode: Node, touchWorldPos: Vec3) {
        const cardTransform = cardNode.getComponent(UITransform);
        if (!cardTransform) {
            return;
        }
        const cardCenterWorldPos = cardTransform.convertToWorldSpaceAR(Vec3.ZERO);
        this.getCardBezierCurve().drawByWorldPos(cardCenterWorldPos, touchWorldPos);
    }

    private getCardBezierCurve(): BezierCurveUtil {
        if (this.cardBezierCurve && this.cardBezierCurve.node.isValid) {
            return this.cardBezierCurve;
        }

        let curveNode = this.node.getChildByName(this.cardBezierNodeName);
        if (!curveNode) {
            curveNode = new Node(this.cardBezierNodeName);
            curveNode.parent = this.node;
            curveNode.addComponent(UITransform);
        }
        curveNode.setSiblingIndex(this.node.children.length - 1);
        this.cardBezierCurve = curveNode.getComponent(BezierCurveUtil) || curveNode.addComponent(BezierCurveUtil);
        return this.cardBezierCurve;
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

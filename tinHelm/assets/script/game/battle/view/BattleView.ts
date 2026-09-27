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
import { BlockInputEvents, Button, Color, EventTouch, Graphics, instantiate, Node, RichText, UITransform, UIOpacity, Vec3 } from 'cc';
import { TableCard } from '../../common/table/TableCard';
import { nodeCard } from '../../card/nodeCard';
import { BattleEvent } from '../BattleEvent';
import { GraphView } from '../../ui/GraphView';
import { BattleCardPile, BattleChoice, BattleSide } from '../model/BattleTypes';

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
    private readonly cardTouchStartPos = new Vec3();
    private selectedCardIndex = -1;
    private selectedTouchId: number | null = null;
    private handSignature = '';
    private rolling = false;
    private diceScales: Vec3[] = [];
    private choiceNode: Node | null = null;
    private displayedChoice: BattleChoice | null = null;

    async start() {
        this.nodeTreeInfoLite();
        this.setButton();
        for (const name of ['lbtPlayerBuff', 'lbtEnemyBuff']) {
            const text = this.getNode(name)!.getComponent(RichText)!;
            text.fontSize = 20;
            text.lineHeight = 24;
            text.maxWidth = 260;
        }
        this.on(BattleEvent.refreshBattlePhase, this.refresh, this);
        this.startBattleAnimation();
        this.initDiceView();
        await this.ent.BattleBll.start();
        this.initPlayerView();
        this.initEnemyView();
        this.refresh();
    }

    refresh() {
        const model = this.ent.BattleModel;
        const player = this.ent.BattlePlayerModel;
        const phaseNames = ['战斗准备', '玩家回合开始', '投掷骰子', '玩家行动', '玩家回合结束',
            '敌人回合开始', '敌人攻击', '敌人回合结束', '结果结算', '战斗胜利', '战斗失败'];
        this.updatePlayerStatus();
        this.updateEnemyStatus();
        this.getNode('lbtPlayerEnergy')!.getComponent(Label)!.string = `${player.energy}/${player.maxEnergy}`;
        this.getNode('lbtPlayerBuff')!.getComponent(RichText)!.string = this.ent.BattleBuffBll.describe(BattleSide.Player);
        this.getNode('lbtEnemyBuff')!.getComponent(RichText)!.string = this.ent.BattleBuffBll.describe(BattleSide.Enemy);
        this.getNode('lbtCurrentPhase')!.getComponent(Label)!.string = model.message || phaseNames[model.phase];
        this.getNode('lbtCurrentRound')!.getComponent(Label)!.string = `第 ${model.turn} 回合`;
        this.getNode('txtThrow')!.getComponent(Label)!.string = `重投 ${player.rerolls}`;
        this.getNode('txtContinue')!.getComponent(Label)!.string = model.phase === BattlePhase.Victory ? '继续前进'
            : model.phase === BattlePhase.Defeat ? '重新开始' : model.closed ? '关闭' : '结束回合';
        const actionable = !model.busy && !model.shownCardPile && model.phase === BattlePhase.PlayerAction && !this.ent.BattleBll.isFinished();
        this.getNode('txtDrawPile')!.getComponent(Label)!.string = `抽牌堆 ${player.drawPile.length}`;
        this.getNode('txtDiscardPile')!.getComponent(Label)!.string = `弃牌堆 ${player.discardPile.length}`;
        const canInspect = !model.busy && !model.closed && !model.shownCardPile;
        this.getNode('btnDrawPile')!.getComponent(Button)!.interactable = canInspect;
        this.getNode('btnDiscardPile')!.getComponent(Button)!.interactable = canInspect;
        this.getNode('btnThrow')!.getComponent(Button)!.interactable = actionable && player.rerolls > 0
            && player.diceLocked.length < player.dice.length;
        this.getNode('btnEnd')!.getComponent(Button)!.interactable = actionable
            || (!model.busy && !model.shownCardPile && this.ent.BattleBll.isFinished());
        this.updateCardList();
        this.getNode('diceLayout')!.children.forEach((dice, index) => {
            const scale = this.diceScales[index];
            const factor = player.diceLocked.includes(index) ? 0.88 : 1;
            dice.setScale(scale.x * factor, scale.y * factor, scale.z);
        });
        this.updateChoice();
        if (model.phase === BattlePhase.PlayerRollDice && !this.rolling && !model.closed) {
            this.rolling = true;
            player.dice.forEach((value, index) => {
                if (!player.diceLocked.includes(index)) {
                    this.throwDice(index, value);
                }
            });
            this.scheduleOnce(() => {
                this.rolling = false;
                this.ent.BattleBll.finishRoll();
            }, 0.65);
        }
    }

    updateCardList() {
        const cardLayout = this.getNode('cardLayout')!;
        const player = this.ent.BattlePlayerModel;
        const signature = player.handCards.join(',');
        if (signature === this.handSignature && cardLayout.children.length === player.handCards.length) {
            cardLayout.children.forEach((cardNode, index) => {
                cardNode.getComponent(UIOpacity)!.opacity = this.ent.BattleCardBll.canPlay(index) ? 255 : 140;
            });
            return;
        }
        this.handSignature = signature;
        this.cancelCardGesture();
        const previous = [...cardLayout.children];
        cardLayout.removeAllChildren();
        previous.forEach(cardNode => {
            cardNode.destroy();
        });
        player.handCards.forEach((cardId, index) => {
            const card = TableCard.getConfigById(cardId);
            if (!card) {
                return;
            }
            const cardNode = instantiate(this.prefabCard);
            cardNode.parent = cardLayout;
            cardNode.getComponent(nodeCard)!.setData(card);
            const opacity = cardNode.getComponent(UIOpacity) || cardNode.addComponent(UIOpacity);
            opacity.opacity = this.ent.BattleCardBll.canPlay(index) ? 255 : 140;
            this.bindCardGesture(cardNode, index);
        });
    }

    private bindCardGesture(cardNode: Node, index: number) {
        cardNode.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
            if (this.selectedTouchId !== null || this.ent.BattleModel.busy || this.ent.BattleModel.shownCardPile
                || this.ent.BattleModel.phase !== BattlePhase.PlayerAction) {
                return;
            }
            this.selectedCardIndex = index;
            this.selectedTouchId = event.getID();
            this.onCardTouchStart(event);
        }, this);
        cardNode.on(Node.EventType.TOUCH_MOVE, this.onCardTouchMove, this);
        cardNode.on(Node.EventType.TOUCH_END, this.onCardTouchEnd, this);
        cardNode.on(Node.EventType.TOUCH_CANCEL, this.onCardTouchCancel, this);
    }

    private onCardTouchStart(event: EventTouch) {
        const touchPos = event.getUILocation();
        this.cardTouchStartPos.set(touchPos.x, touchPos.y, 0);
    }

    private onCardTouchMove(event: EventTouch) {
        if (this.selectedCardIndex < 0 || event.getID() !== this.selectedTouchId) {
            return;
        }
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

    private async onCardTouchEnd(event: EventTouch) {
        if (event.getID() !== this.selectedTouchId) {
            return;
        }
        const index = this.selectedCardIndex;
        this.cancelCardGesture();
        if (index < 0) {
            return;
        }
        const card = TableCard.getConfigById(this.ent.BattlePlayerModel.handCards[index]);
        if (!card) {
            return;
        }
        const targetNode = this.getNode(card?.target === 'SELF' ? 'spRole' : 'spEnemy')!;
        // 引擎按屏幕坐标、UI 相机和窗口转换，避免将 UI 坐标误当世界坐标。
        if (targetNode.getComponent(UITransform)!.hitTest(event.getLocation(), event.windowId)) {
            await this.ent.BattleCardBll.play(index);
        }
    }

    private async onCardTouchCancel(event: EventTouch) {
        if (event.getID() !== this.selectedTouchId) {
            return;
        }
        // Cocos 3.8 会把卡牌范围外的松手改成 TOUCH_CANCEL；getEventCode 保留原始类型。
        // 系统取消、节点销毁产生的真正 CANCEL 只清理手势，不能出牌。
        if (event.getEventCode() === Node.EventType.TOUCH_END) {
            await this.onCardTouchEnd(event);
        } else {
            this.cancelCardGesture();
        }
    }

    private cancelCardGesture() {
        this.selectedCardIndex = -1;
        this.selectedTouchId = null;
        this.getNode('nodeGraphView')!.getComponent(GraphView)!.reset();
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
        for (const child of [...diceLayout.children]) {
            child.removeFromParent();
            child.destroy();
        }
        this.diceScales = [];
        const playerId = smc.player.getSelectedRoleId();
        const diceInfo = TableRole.getConfigById(playerId)!.originDice;
        for (let i = 0; i < diceInfo.length; i++) {
            const diceNode = instantiate(this.prefabDice);
            diceNode.parent = diceLayout;
            this.diceScales.push(diceNode.scale.clone());
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
        this.ent.BattleBll.reroll();
    }

    async btnDrawPile() {
        this.cancelCardGesture();
        await this.ent.openCardShowDialog(BattleCardPile.Draw);
    }

    async btnDiscardPile() {
        this.cancelCardGesture();
        await this.ent.openCardShowDialog(BattleCardPile.Discard);
    }

    async btnEnd() {
        if (this.ent.BattleBll.isFinished()) {
            this.ent.BattleBll.leaveResult();
            return;
        }
        await this.ent.BattleBll.endTurn();
    }

    throwDice(diceIndex: number, diceValue: number): void {
        const diceLayout = this.getNode('diceLayout');
        const dice = diceLayout?.children[diceIndex];
        const diceView = dice?.getComponent(nodeDice);
        if (!diceView) {
            return;
        }
        diceView.rollToFaceValue(diceValue, 0.6);
    }

    private updateChoice() {
        const choice = this.ent.BattleModel.choice;
        if (choice === this.displayedChoice) {
            return;
        }
        this.displayedChoice = choice;
        if (this.choiceNode) {
            this.choiceNode.removeFromParent();
            this.choiceNode.destroy();
            this.choiceNode = null;
        }
        if (!choice) {
            return;
        }
        const panel = new Node('battleChoice');
        panel.layer = this.node.layer;
        this.choiceNode = panel;
        this.node.addChild(panel);
        const size = this.node.getComponent(UITransform)!.contentSize;
        panel.addComponent(UITransform).setContentSize(size);
        panel.addComponent(BlockInputEvents);
        const graphics = panel.addComponent(Graphics);
        graphics.fillColor = new Color(15, 20, 30, 245);
        graphics.rect(-size.width / 2, -size.height / 2, size.width, size.height);
        graphics.fill();
        const width = Math.min(size.width - 60, 720);
        const height = Math.min(110, (size.height - 180) / Math.max(1, choice.options.length));
        this.choiceLabel(panel, choice.title, width, 60, size.height / 2 - 65);
        choice.options.forEach((option, index) => {
            const y = (choice.options.length - 1) * (height + 12) / 2 - index * (height + 12);
            const button = this.choiceLabel(panel, `${index + 1}. ${option}`, width, height, y);
            button.addComponent(Button);
            button.on(Button.EventType.CLICK, () => {
                this.ent.BattleEffectBll.select(index);
            }, this);
        });
    }

    private choiceLabel(parent: Node, text: string, width: number, height: number, y: number) {
        const node = new Node('choiceOption');
        node.layer = parent.layer;
        parent.addChild(node);
        node.setPosition(0, y);
        node.addComponent(UITransform).setContentSize(width, height);
        const background = node.addComponent(Graphics);
        background.fillColor = new Color(48, 65, 85, 255);
        background.roundRect(-width / 2, -height / 2, width, height, 8);
        background.fill();
        const textNode = new Node('text');
        textNode.layer = node.layer;
        node.addChild(textNode);
        textNode.addComponent(UITransform).setContentSize(width - 24, height - 12);
        const label = textNode.addComponent(Label);
        label.string = text;
        label.fontSize = 22;
        label.lineHeight = 28;
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = true;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        return node;
    }

    btnClose() {
        this.ent.closeBattleView();
    }

    reset(): void {
        this.unscheduleAllCallbacks();
        this.ent.BattleBll.close();
        this.rolling = false;
        this.handSignature = '';
        this.selectedCardIndex = -1;
        this.selectedTouchId = null;
    }
}

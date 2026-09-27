import { _decorator, Label, Node, ScrollView } from 'cc';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { Battle } from '../Battle';
import { BattleEvent } from '../BattleEvent';
import { BattleCardPile } from '../model/BattleTypes';
import { TableCard } from '../../common/table/TableCard';
import { nodeCard } from '../../card/nodeCard';
import List from '../../ui/List';

const { ccclass } = _decorator;

@ccclass('CardShowDialog')
@ecs.register('CardShowDialog', false)
@gui.register('CardShowDialog', { layer: LayerType.PopUp, prefab: 'gui/battle/CardShowDialog' })
export class CardShowDialog extends CCView<Battle> {
    private cardIds: number[] = [];

    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.on(BattleEvent.refreshBattlePhase, this.refresh, this);
        this.refresh();
        this.getNode('nodeCardList')!.getComponent(ScrollView)!.scrollToTop(0);
    }

    refresh() {
        const pile = this.ent.BattleModel.shownCardPile;
        if (!pile) {
            return;
        }
        this.cardIds = this.ent.BattleCardBll.getPileCards(pile);
        const title = pile === BattleCardPile.Draw ? '抽牌堆' : '弃牌堆';
        const hint = pile === BattleCardPile.Draw ? ' · 非抽取顺序' : '';
        this.getNode('lbtTitle')!.getComponent(Label)!.string = `${title}（${this.cardIds.length} 张）${hint}`;
        this.getNode('lbtEmpty')!.active = this.cardIds.length === 0;
        this.getNode('lbtEmpty')!.getComponent(Label)!.string = `${title}暂无卡牌`;
        this.getNode('nodeCardList')!.getComponent(List)!.numItems = this.cardIds.length;
    }

    updateCardItem(node: Node, index: number) {
        const card = TableCard.getConfigById(this.cardIds[index]);
        node.active = !!card;
        if (!card) {
            return;
        }
        const view = node.getComponent(nodeCard)!;
        view.setData(card);
        const types: Record<string, string> = { ATTACK: '攻击', SKILL: '技能', POWER: '能力', STATUS: '状态', CURSE: '诅咒' };
        view.getNode('lbtKind')!.getComponent(Label)!.string = types[card.type] || card.type;
    }

    btnClose() {
        this.ent.closeCardShowDialog();
    }

    reset() {
        this.cardIds = [];
    }
}

import { _decorator, Button, instantiate, Label, Layout } from 'cc';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { Battle } from '../Battle';
import { TableCard } from '../../common/table/TableCard';
import { nodeCard } from '../../card/nodeCard';
const { ccclass } = _decorator;
@ccclass('CardRewardDialog')
@ecs.register('CardRewardDialog', false)
@gui.register('CardRewardDialog', { layer: LayerType.PopUp, prefab: 'gui/battle/CardRewardDialog' })
export class CardRewardDialog extends CCView<Battle> {
    start(): void {
        this.nodeTreeInfoLite();
        this.setButton();
        const reward = this.ent.BattleModel.rewards[this.ent.BattleModel.selectedRewardIndex];
        const template = this.getNode('nodeRewardCard')!;
        const layout = this.getNode('nodeCardRewardLayout')!;
        const types: Record<string, string> = { ATTACK: '攻击', SKILL: '技能', POWER: '能力' };
        for (const cardId of reward.cardIds) {
            const card = TableCard.getConfigById(cardId)!;
            const node = instantiate(template);
            node.name = `rewardCard${cardId}`;
            node.active = true;
            node.parent = layout;
            const view = node.getComponentInChildren(nodeCard)!;
            view.setData(card);
            view.getNode('lbtKind')!.getComponent(Label)!.string = `${types[card.type] || card.type} · ${card.level}级`;
            node.getChildByName('lbtLevel')!.getComponent(Label)!.string = `${card.level}级卡牌`;
            node.getChildByName('btnSelect')!.on(Button.EventType.CLICK, () => {
                this.ent.BattleRewardBll.chooseCard(cardId);
            }, this);
        }
        template.active = false;
        layout.getComponent(Layout)!.updateLayout();
    }
    btnClose(): void {
        this.ent.closeCardRewardDialog();
    }
    reset(): void {
    }
}

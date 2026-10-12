import { _decorator, Button, instantiate, Label, Layout, Node, ScrollView } from 'cc';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { Battle } from '../Battle';
import { BattleEvent } from '../BattleEvent';
import { BattleRewardKind } from '../model/BattleReward';
import { TableItem } from '../../common/table/TableItem';
import { TableEnemy } from '../../common/table/TableEnemy';
import { TableGameResource } from '../../common/table/TableGameResource';
import { smc } from '../../common/SingletonModuleComp';
const { ccclass } = _decorator;
@ccclass('BattleCleadupDialog')
@ecs.register('BattleCleadupDialog', false)
@gui.register('BattleCleadupDialog', { layer: LayerType.PopUp, prefab: 'gui/battle/BattleCleadupDialog' })
export class BattleCleadupDialog extends CCView<Battle> {
    private rewardNodes: Node[] = [];
    start(): void {
        this.nodeTreeInfoLite();
        this.setButton();
        const template = this.getNode('nodeReward')!;
        const layout = this.getNode('nodeRewardLayout')!;
        this.ent.BattleModel.rewards.forEach((_reward, index) => {
            const node = instantiate(template);
            node.active = true;
            node.name = `reward${index}`;
            node.parent = layout;
            node.on(Button.EventType.CLICK, () => {
                this.ent.BattleRewardBll.claimReward(index);
            }, this);
            this.rewardNodes.push(node);
        });
        template.active = false;
        this.on(BattleEvent.rewardsChanged, this.refreshRewardList, this);
        this.refreshRewardList();
        layout.getComponent(Layout)!.updateLayout();
        this.getNode('nodeRewardList')!.getComponent(ScrollView)!.scrollToTop(0);
    }
    refreshRewardList(): void {
        const enemy = TableEnemy.getConfigById(this.ent.BattleEnemyModel.enemyId)!;
        this.getNode('txtCleaup')!.getComponent(Label)!.string = `战斗胜利 · ${enemy.name}`;
        this.getNode('lbtEmpty')!.active = this.ent.BattleModel.rewards.length === 0;
        this.rewardNodes.forEach((node, index) => {
            const reward = this.ent.BattleModel.rewards[index];
            const title = reward.kind === BattleRewardKind.Item
                ? TableItem.getConfigById(reward.id)!.name
                : reward.kind === BattleRewardKind.Resource
                    ? TableGameResource.getConfigById(reward.id)!.name
                    : '卡牌奖励（三选一）';
            const description = reward.kind === BattleRewardKind.Item
                ? TableItem.getConfigById(reward.id)!.des
                : reward.kind === BattleRewardKind.Card ? '选择一张加入当前牌组' : '';
            node.active = true;
            node.getChildByName('lbtName')!.getComponent(Label)!.string = `${title} ×${reward.count}`;
            node.getChildByName('lbtDes')!.getComponent(Label)!.string = description;
            const itemFull = reward.kind === BattleRewardKind.Item
                && smc.player.PlayerBll.getItemCount() + reward.count > smc.player.PlayerBll.getItemLimit();
            node.getChildByName('lbtClaim')!.getComponent(Label)!.string = reward.claimed ? '已领取'
                : itemFull ? '道具已满' : '领取';
            node.getComponent(Button)!.interactable = !reward.claimed && !itemFull
                && this.ent.BattleModel.selectedRewardIndex < 0;
        });
    }
    btnClose(): void {
        this.ent.BattleRewardBll.leaveRewards();
    }
    reset(): void {
        this.rewardNodes = [];
    }
}

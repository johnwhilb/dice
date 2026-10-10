import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattlePhase } from '../model/BattleModel';
import { BattleReward, BattleRewardKind } from '../model/BattleReward';
import { BattleEvent } from '../BattleEvent';
import { smc } from '../../common/SingletonModuleComp';
import { TableEnemy } from '../../common/table/TableEnemy';
import { TableCard } from '../../common/table/TableCard';
import { PlayerEvent } from '../../player/PlayerEvent';
export class BattleRewardBll extends CCBusiness<Battle> {
    // 通知奖励界面刷新数据。
    refreshRewards(): void {
        this.dispatchEvent(BattleEvent.rewardsChanged);
    }
    // 按敌人配置生成资源、道具和卡牌奖励。
    prepareRewards(): void {
        const model = this.ent.BattleModel;
        if (model.rewardsPrepared || model.closed || model.phase !== BattlePhase.Victory) {
            return;
        }
        model.rewardsPrepared = true;
        const enemy = TableEnemy.getConfigById(this.ent.BattleEnemyModel.enemyId)!;
        const rewards: BattleReward[] = [];
        if (enemy.itemRewad > 0) {
            rewards.push({ kind: BattleRewardKind.Item, id: enemy.itemRewad, count: 1, cardIds: [], claimed: false });
        }
        const resources: number[][] = enemy.resourceReward;
        for (const raw of resources) {
            if (!Array.isArray(raw)) {
                continue;
            }
            const id: number = raw[0];
            const amount: number = raw[1];
            if (typeof id !== 'number'
                || typeof amount !== 'number' || !Number.isFinite(amount) || amount < 1) {
                continue;
            }
            const count = Math.floor(amount);
            const existing = rewards.find((reward) => {
                return reward.kind === BattleRewardKind.Resource && reward.id === id;
            });
            if (existing) {
                existing.count += count;
            }
            else {
                rewards.push({ kind: BattleRewardKind.Resource, id, count, cardIds: [], claimed: false });
            }
        }
        const cardIds = this.generateCards(enemy.cardRewad);
        if (cardIds.length) {
            rewards.push({ kind: BattleRewardKind.Card, id: 0, count: 1, cardIds, claimed: false });
        }
        model.rewards = rewards;
    }
    // 根据等级权重生成互不重复的卡牌奖励。
    private generateCards(rawSlots: number[][]): number[] {
        const pool = TableCard.getAllConfig().filter((card) => {
            return card.role === smc.player.PlayerModel.roleId && card.level >= 1 && card.level <= 3
                && ['ATTACK', 'SKILL', 'POWER'].includes(card.type);
        });
        const result: number[] = [];
        for (const slot of rawSlots.slice(0, 3)) {
            if (!Array.isArray(slot)) {
                continue;
            }
            const weights = [0, 1, 2].map((index) => {
                const value: number = slot[index];
                if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
                    throw new Error(`卡牌奖励等级权重无效：${value}`);
                }
                return value;
            });
            const available = pool.filter((card) => {
                return !result.includes(card.id);
            });
            // 没有可选卡牌的等级不参与抽取，避免生成空白奖励或重复卡牌。
            const total = weights.reduce((sum, weight, index) => {
                return sum + (available.some((card) => {
                    return card.level === index + 1;
                }) ? weight : 0);
            }, 0);
            if (total <= 0) {
                continue;
            }
            let roll = Math.random() * total;
            let selectedLevel = 0;
            for (const [index, weight] of Array.from(weights.entries())) {
                if (weight <= 0 || !available.some((card) => {
                    return card.level === index + 1;
                })) {
                    continue;
                }
                roll -= weight;
                selectedLevel = index + 1;
                if (roll < 0) {
                    break;
                }
            }
            const candidates = available.filter((card) => {
                return card.level === selectedLevel;
            });
            const selected = candidates[Math.floor(Math.random() * candidates.length)];
            result.push(selected.id);
        }
        return result;
    }
    // 领取选中的道具或资源奖励。
    claimReward(index: number): boolean {
        const model = this.ent.BattleModel;
        if (model.closed || model.busy || model.phase !== BattlePhase.Victory || !model.resultHandled
            || model.rewardsDismissed || model.selectedRewardIndex >= 0
            || !Number.isInteger(index) || index < 0 || index >= model.rewards.length) {
            return false;
        }
        const reward = model.rewards[index];
        if (reward.claimed) {
            return false;
        }
        if (reward.kind === BattleRewardKind.Card) {
            model.selectedRewardIndex = index;
            this.ent.openCardRewardDialog();
            return true;
        }
        const received = reward.kind === BattleRewardKind.Item
            ? smc.player.PlayerBll.addItem(reward.id, reward.count)
            : smc.player.PlayerBll.addResource(reward.id, reward.count);
        if (!received) {
            return false;
        }
        model.gold = smc.player.PlayerModel.gold;
        reward.claimed = true;
        this.dispatchEvent(BattleEvent.rewardsChanged);
        return true;
    }
    // 将确认的卡牌奖励加入玩家牌组。
    chooseCard(cardId: number): boolean {
        const model = this.ent.BattleModel;
        if (model.closed || model.phase !== BattlePhase.Victory
            || model.selectedRewardIndex < 0 || model.selectedRewardIndex >= model.rewards.length) {
            return false;
        }
        const reward = model.rewards[model.selectedRewardIndex];
        if (reward.claimed || reward.kind !== BattleRewardKind.Card || !reward.cardIds.includes(cardId)) {
            return false;
        }
        const card = TableCard.getConfigById(cardId)!;
        if (card.role !== smc.player.PlayerModel.roleId) {
            return false;
        }
        reward.claimed = true;
        smc.player.PlayerModel.handCard.push(cardId);
        this.dispatchEvent(PlayerEvent.statsChanged);
        this.ent.closeCardRewardDialog();
        this.dispatchEvent(BattleEvent.rewardsChanged);
        return true;
    }
    // 关闭奖励选择并推进战斗结果流程。
    leaveRewards(): void {
        const model = this.ent.BattleModel;
        if (model.busy || model.selectedRewardIndex >= 0 || model.closed || model.phase !== BattlePhase.Victory) {
            return;
        }
        model.rewardsDismissed = true;
        this.ent.BattleBll.leaveResult();
    }
}

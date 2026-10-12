import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattlePhase } from '../model/BattleModel';
import { BattleSide } from '../model/BattleTypes';
import { TableItem } from '../../common/table/TableItem';
import { smc } from '../../common/SingletonModuleComp';
/** 道具只消耗库存，复用卡牌的效果解释器，不触发出牌事件。 */
export class BattleItemBll extends CCBusiness<Battle> {
    // 检查战斗状态和道具库存是否允许使用。
    canUseItem(itemId: number): boolean {
        const model = this.ent.BattleModel;
        return !model.busy && model.phase === BattlePhase.PlayerAction
            && !this.ent.BattleBll.isBattleFinished()
            && smc.player.PlayerModel.items[itemId] > 0;
    }
    // 等待JSON效果及可能出现的选择、胜负结算完成后，才解除操作锁并刷新库存。
    useItem(itemId: number): Promise<boolean> {
        if (!this.canUseItem(itemId)) {
            return Promise.resolve(false);
        }
        const item = TableItem.getConfigById(itemId)!;
        const model = this.ent.BattleModel;
        const runId = model.runId;
        return (async () => {
            this.ent.BattleEffectBll.validateEffects(item.effect);
            model.busy = true;
            model.message = '';
            if (!smc.player.PlayerBll.removeItem(itemId)) {
                return false;
            }
            this.ent.BattleBll.refreshBattleView();
            const target = item.target === 'SELF' ? BattleSide.Player : BattleSide.Enemy;
            const context = this.ent.BattleValueResolver.createContext(BattleSide.Player, 0, target);
            await this.ent.BattleEffectBll.executeEffects(item.effect, context);
            if (model.runId !== runId) {
                return false;
            }
            this.ent.BattleBuffBll.clearActionBuffs();
            await this.ent.BattleBll.finishResult();
            return true;
        })().catch((error: Error) => {
            if (model.runId === runId) {
                if (model.busy) {
                    this.ent.BattleBll.handleBattleError(error);
                }
                else {
                    model.message = error.message;
                    this.ent.BattleBll.refreshBattleView();
                }
            }
            return false;
        }).finally(() => {
            if (model.runId === runId) {
                model.busy = false;
                this.ent.BattleBll.refreshBattleView();
            }
        });
    }
}

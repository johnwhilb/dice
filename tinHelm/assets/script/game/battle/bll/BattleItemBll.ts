import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattlePhase } from '../model/BattleModel';
import { BattleSide } from '../model/BattleTypes';
import { TableItem } from '../../common/table/TableItem';
import { smc } from '../../common/SingletonModuleComp';

/** 道具只消耗库存，复用卡牌的效果解释器，不触发出牌事件。 */
export class BattleItemBll extends CCBusiness<Battle> {
    canUse(itemId: number) {
        const model = this.ent.BattleModel;
        return !model.busy && model.phase === BattlePhase.PlayerAction
            && !this.ent.BattleBll.isFinished() && !!TableItem.getConfigById(itemId)
            && (smc.player.PlayerModel.items[itemId] || 0) > 0;
    }

    // 等待JSON效果及可能出现的选择、胜负结算完成后，才解除操作锁并刷新库存。
    async use(itemId: number) {
        if (!this.canUse(itemId)) {
            return false;
        }
        const item = TableItem.getConfigById(itemId)!;
        const model = this.ent.BattleModel;
        const runId = model.runId;
        // 校验失败时不扣库存；开始结算即占用一个，避免多点触控重复使用。
        try {
            this.ent.BattleEffectBll.validate(item.effect);
        }
        catch (error) {
            model.message = error instanceof Error ? error.message : String(error);
            this.ent.BattleBll.refresh();
            return false;
        }
        model.busy = true;
        model.message = '';
        try {
            if (!smc.player.PlayerBll.removeItem(itemId)) {
                return false;
            }
            this.ent.BattleBll.refresh();
            const target = item.target === 'SELF' ? BattleSide.Player : BattleSide.Enemy;
            const context = this.ent.BattleValueResolver.context(BattleSide.Player, 0, target);
            await this.ent.BattleEffectBll.execute(item.effect, context);
            if (model.runId !== runId) {
                return false;
            }
            this.ent.BattleBuffBll.clearAction();
            await this.ent.BattleBll.finishResult();
            return true;
        }
        catch (error) {
            if (model.runId === runId) {
                this.ent.BattleBll.fail(error);
            }
            return false;
        }
        finally {
            if (model.runId === runId) {
                model.busy = false;
                this.ent.BattleBll.refresh();
            }
        }
    }
}

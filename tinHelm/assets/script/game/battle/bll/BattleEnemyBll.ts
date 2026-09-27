import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { TableEnemy } from '../../common/table/TableEnemy';
import { BattleSide } from '../model/BattleTypes';

export class BattleEnemyBll extends CCBusiness<Battle> {

    initEnemy() {
        const enemyInfo = TableEnemy.getConfigById(this.ent.BattleEnemyModel.enemyId)
        const model = this.ent.BattleEnemyModel;
        model.hp = enemyInfo?.originHp || 1;
        model.maxHp = model.hp;
        model.block = 0;
        model.buffs = [];
    }

    async attack() {
        const enemy = TableEnemy.getConfigById(this.ent.BattleEnemyModel.enemyId);
        await this.ent.BattleDamageBll.damage(BattleSide.Enemy, BattleSide.Player, enemy?.nomalAttack || 0);
    }

}

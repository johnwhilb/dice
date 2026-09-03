import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { TableEnemy } from '../../common/table/TableEnemy';

export class BattleEnemyBll extends CCBusiness<Battle> {

    initEnemy() {
        const enemyInfo =TableEnemy.getConfigById( this.ent.BattleEnemyModel.enemyId)
        this.ent.BattleEnemyModel.hp=enemyInfo!.originHp
    }
    
}
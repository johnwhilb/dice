import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { BattleBuff } from './BattleTypes';


@ecs.register('BattleEnemyModel')
export class BattleEnemyModel extends ecs.Comp {

    enemyId: number = 0;
    hp: number = 0;
    maxHp: number = 0;
    block: number = 0;
    buffs: BattleBuff[] = [];


    reset() {
        this.enemyId = 0;
        this.hp = 0;
        this.maxHp = 0;
        this.block = 0;
        this.buffs = [];
    }
}

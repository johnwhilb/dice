import { ecs } from 'db://oops-framework/libs/ecs/ECS';


@ecs.register('BattleEnemyModel')
export class BattleEnemyModel extends ecs.Comp {

    enemyId: number = 0;
    hp: number = 0;
    maxHp: number = 0;


    reset() {
        this.enemyId = 0;
        this.hp = 0;
        this.maxHp = 0;
    }
}
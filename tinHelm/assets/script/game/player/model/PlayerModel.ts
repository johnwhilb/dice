import { _decorator, Component, Node } from 'cc';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';

@ecs.register('PlayerModel')
export class PlayerModel extends ecs.Comp {

    roleId: number = 1001;
    hp: number = 0;
    maxHp: number = 0;
    handCard: number[] = [];

    public reset(): void {
        this.roleId = 1001;
        this.hp = 0;
    }
}


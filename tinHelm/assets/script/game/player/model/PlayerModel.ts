import { _decorator, Component, Node } from 'cc';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { TableRole } from '../../common/table/TableRole';

@ecs.register('PlayerModel')
export class PlayerModel extends ecs.Comp {

    roleId: number = TableRole.createId(1);
    hp: number = 0;
    maxHp: number = 0;
    handCard: number[] = [];

    public reset(): void {
        this.roleId = TableRole.createId(1);
        this.hp = 0;
        this.maxHp = 0;
        this.handCard = [];
    }
}


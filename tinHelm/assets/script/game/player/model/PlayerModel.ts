import { _decorator, Component, Node } from 'cc';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { TableRole } from '../../common/table/TableRole';

@ecs.register('PlayerModel')
export class PlayerModel extends ecs.Comp {

    roleId: number = TableRole.createId(1);
    hp: number = 0;
    maxHp: number = 0;
    handCard: number[] = [];
    /** 当前冒险持有的金币。 */
    gold: number = 0;
    /** 道具和非金币资源按配置 ID 保存数量。 */
    items: Record<number, number> = {};
    resources: Record<number, number> = {};
    /** 当前穿戴的装备；获取与合成界面通过 PlayerBll 增删。 */
    equipmentIds: number[] = [];

    public reset(): void {
        this.roleId = TableRole.createId(1);
        this.hp = 0;
        this.maxHp = 0;
        this.handCard = [];
        this.gold = 0;
        this.items = {};
        this.resources = {};
        this.equipmentIds = [];
    }
}


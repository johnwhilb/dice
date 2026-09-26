import { ecs } from 'db://oops-framework/libs/ecs/ECS';

@ecs.register('ShopModel')
export class ShopModel extends ecs.Comp {
    eventId = 0;
    roleId = 0;
    cardIds: number[] = [];

    reset() {
        this.eventId = 0;
        this.roleId = 0;
        this.cardIds = [];
    }
}

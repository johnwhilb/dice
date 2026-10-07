import { ecs } from 'db://oops-framework/libs/ecs/ECS';

@ecs.register('ShopModel')
export class ShopModel extends ecs.Comp {
    eventId = 0;
    roleId = 0;
    cardIds: number[] = [];
    itemIds: number[] = [];
    boughtCardIds: number[] = [];
    boughtItemIds: number[] = [];
    initialized = false;
    opening = false;
    leaving = false;
    message = '';

    reset() {
        this.eventId = 0;
        this.roleId = 0;
        this.cardIds = [];
        this.itemIds = [];
        this.boughtCardIds = [];
        this.boughtItemIds = [];
        this.initialized = false;
        this.opening = false;
        this.leaving = false;
        this.message = '';
    }
}

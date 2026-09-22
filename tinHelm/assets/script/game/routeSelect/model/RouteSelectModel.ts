import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { EventTypeEnum } from '../../common/table/EventTypeEnum';

@ecs.register('RouteSelectModel')
export class RouteSelectModel extends ecs.Comp {

    currentRoutes: EventTypeEnum[] = [];
    reset(): void {
        this.currentRoutes = [];
    }

}

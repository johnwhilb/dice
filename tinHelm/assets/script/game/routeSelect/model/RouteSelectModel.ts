import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { EnumEvent } from '../../common/table/EnumEvent';

@ecs.register('RouteSelectModel')
export class RouteSelectModel extends ecs.Comp {

    currentRoutes: EnumEvent[] = [];
    reset(): void {
        this.currentRoutes = [];
    }

}
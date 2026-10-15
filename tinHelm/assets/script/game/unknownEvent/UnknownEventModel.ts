import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { TableUnknownEventSelect } from '../common/table/TableUnknownEventSelect';

@ecs.register('UnknownEventModel')
export class UnknownEventModel extends ecs.Comp {
    eventId = 0;
    options: TableUnknownEventSelect[] = [];

    /** 清空当前未知事件 ID 和按配置顺序保存的有效选项。 */
    reset() {
        this.eventId = 0;
        this.options = [];
    }
}

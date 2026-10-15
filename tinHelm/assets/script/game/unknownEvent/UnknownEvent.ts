import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { UnknownEventBll } from './UnknownEventBll';
import { UnknownEventModel } from './UnknownEventModel';
import { UnknownEventView } from './UnknownEventView';

@ecs.register('UnknownEvent')
export class UnknownEvent extends CCEntity {
    UnknownEventBll!: UnknownEventBll;
    UnknownEventModel!: UnknownEventModel;
    UnknownEventView!: UnknownEventView;

    init() {
        this.addComponents(UnknownEventModel);
        this.UnknownEventBll = this.addBusiness<UnknownEventBll>(UnknownEventBll);
    }

    prepare(eventId: number) {
        return this.UnknownEventBll.prepare(eventId);
    }

    openUnknownEventView() {
        if (this.has(UnknownEventView)) {
            this.UnknownEventView.refresh();
            return Promise.resolve(this.UnknownEventView.node);
        }
        return this.addUi(UnknownEventView);
    }

    clear() {
        if (this.has(UnknownEventView)) {
            this.removeUi(UnknownEventView);
        }
        this.UnknownEventModel.reset();
    }
}

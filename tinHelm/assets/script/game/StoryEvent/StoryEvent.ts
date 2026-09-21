import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { smc } from '../common/SingletonModuleComp';
import { StoryDialog } from './StoryDialog';
import { StoryEventBll } from './StoryEventBll';
import { StoryEventModel } from './StoryEventModel';
import { StoryEventView } from './StoryEventView';

@ecs.register('StoryEvent')
export class StoryEvent extends CCEntity {
    StoryEventBll!: StoryEventBll;
    StoryEventModel!: StoryEventModel;
    StoryEventView!: StoryEventView;
    StoryDialog!: StoryDialog;

    static create(): StoryEvent {
        return ecs.getEntity<StoryEvent>(StoryEvent);
    }

    init() {
        this.addComponents(StoryEventModel);
        this.StoryEventBll = this.addBusiness<StoryEventBll>(StoryEventBll);
    }

    async openStoryEventView() {
        if (this.has(StoryEventView)) {
            return Promise.resolve(this.StoryEventView.node);
        }

        return this.addUi(StoryEventView);
    }

    closeStoryEventView() {
        if (this.has(StoryEventView)) {
            this.removeUi(StoryEventView);
        }
    }

    async selectFlow(flowId: number) {
        if (!this.StoryEventBll.startFlow(flowId)) {
            this.finishCurrentEvent();
            return;
        }

        this.StoryEventView.showSelections(false);
        await this.addUi(StoryDialog);
    }

    closeStoryDialog() {
        if (this.has(StoryDialog)) {
            this.removeUi(StoryDialog);
        }
    }

    getSelectableFlowIds() {
        return this.StoryEventBll.getSelectableFlowIds();
    }

    getCurrentDialogue() {
        return this.StoryEventBll.getCurrentDialogue();
    }

    nextDialogue() {
        return this.StoryEventBll.nextDialogue();
    }

    updateBackground(path: string) {
        this.StoryEventView.updateBackground(path);
    }

    finishCurrentEvent() {
        this.closeStoryDialog();
        this.closeStoryEventView();
        smc.gameFlow.advanceLevel();
    }
}

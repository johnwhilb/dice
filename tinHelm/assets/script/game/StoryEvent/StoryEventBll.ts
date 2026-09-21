import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { EnumStoryFlow } from '../common/table/EnumStoryFlow';
import { TableStoryDialogue } from '../common/table/TableStoryDialogue';
import { TableStoryEvent } from '../common/table/TableStoryEvent';
import { TableStoryFlow } from '../common/table/TableStoryFlow';
import { StoryEvent } from './StoryEvent';

export class StoryEventBll extends CCBusiness<StoryEvent> {
    getSelectableFlowIds() {
        const storyEvent = TableStoryEvent.getAllConfig()[0];
        const flowIds = (storyEvent?.flowId ?? [])
            .map(id => Number(id))
            .filter(id => TableStoryFlow.isOwnId(id) && !!TableStoryFlow.getConfigById(id))
            .slice(0, 2);
        this.ent.StoryEventModel.flowIds = flowIds;
        return flowIds;
    }

    startFlow(flowId: number) {
        const flow = TableStoryFlow.getConfigById(flowId);
        const dialogueIds: number[] = [];

        for (const progress of flow?.progress ?? []) {
            if (!Array.isArray(progress) || progress.length < 2) {
                continue;
            }

            const progressType = Number(progress[0]);
            const progressIds = progress[1];
            if (progressType !== EnumStoryFlow.DIALOG || !Array.isArray(progressIds)) {
                continue;
            }

            for (const id of progressIds) {
                const dialogueId = Number(id);
                if (TableStoryDialogue.getConfigById(dialogueId)) {
                    dialogueIds.push(dialogueId);
                }
            }
        }

        this.ent.StoryEventModel.dialogueIds = dialogueIds;
        this.ent.StoryEventModel.dialogueIndex = 0;
        return dialogueIds.length > 0;
    }

    getCurrentDialogue() {
        const model = this.ent.StoryEventModel;
        const dialogueId = model.dialogueIds[model.dialogueIndex] ?? 0;
        return TableStoryDialogue.getConfigById(dialogueId);
    }

    nextDialogue() {
        const model = this.ent.StoryEventModel;
        model.dialogueIndex += 1;
        return this.getCurrentDialogue();
    }
}

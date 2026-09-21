import { ecs } from 'db://oops-framework/libs/ecs/ECS';

@ecs.register('StoryEventModel')
export class StoryEventModel extends ecs.Comp {
    flowIds: number[] = [];
    dialogueIds: number[] = [];
    dialogueIndex = 0;

    reset() {
        this.flowIds = [];
        this.dialogueIds = [];
        this.dialogueIndex = 0;
    }
}

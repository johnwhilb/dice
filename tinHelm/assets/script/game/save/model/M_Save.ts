import { ecs } from 'db://oops-framework/libs/ecs/ECS';

@ecs.register('SaveModel')
export class SaveModel extends ecs.Comp {

    hasSave: boolean = false;

    public reset(): void {
        this.hasSave = false;
    }
}


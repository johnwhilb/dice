import { _decorator, Component, Node } from 'cc';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';

@ecs.register('M_Save')
export class M_Save extends ecs.Comp {

    hasSave: boolean = false;

    public reset(): void {
        this.hasSave = false;
    }
}


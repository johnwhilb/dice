import { _decorator, Component, Node } from 'cc';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';


export enum GameFlowState {
    RoleSelect,
    RouteSelect,
}

@ecs.register('GameFlowModel')
export class GameFlowModel extends ecs.Comp {

    currentGameFlowState: GameFlowState = GameFlowState.RoleSelect;
    currentDay = 1;

    reset(): void {
        this.currentDay = 1;
    }





}


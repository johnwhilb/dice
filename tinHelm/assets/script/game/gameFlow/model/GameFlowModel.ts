import { _decorator, Component, Node } from 'cc';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';


export enum GameFlowState {
    RoleSelect,
    RouteSelect,
    Event,
}

@ecs.register('GameFlowModel')
export class GameFlowModel extends ecs.Comp {

    currentGameFlowState: GameFlowState = GameFlowState.RoleSelect;
    currentDay = 1;

    reset(): void {
        this.currentGameFlowState = GameFlowState.RoleSelect;
        this.currentDay = 1;
    }





}


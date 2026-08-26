import { _decorator, Component, Node } from 'cc';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';


export enum GameFlowState {
    RoleSelect,
}

@ecs.register('GameFlowModel')
export class GameFlowModel extends ecs.Comp {

    currentGameFlowState: GameFlowState = GameFlowState.RoleSelect;

    reset(): void {
    }





}


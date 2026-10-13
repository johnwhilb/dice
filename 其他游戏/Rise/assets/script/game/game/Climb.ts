import { instantiate, Node, Prefab } from 'cc';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { ClimbModel } from './ClimbModel';
import { ClimbBll } from './ClimbBll';
import { GameView } from './GameView';
import { LevelSelectView } from './LevelSelectView';

@ecs.register('Climb')
export class Climb extends CCEntity {
    model!: ClimbModel;
    bll!: ClimbBll;
    private gameNode: Node | null = null;
    private levelSelectNode: Node | null = null;

    init() {
        this.model = this.add(ClimbModel);
        this.bll = this.addBusiness(ClimbBll);
    }

    open(newGame: boolean, prefab: Prefab, parent: Node) {
        if (newGame || !this.model.hasRun) {
            if (!this.bll.restart()) {
                return null;
            }
        }
        if (this.gameNode) {
            this.model.paused = false;
            this.gameNode.active = true;
            return this.gameNode;
        }
        if (!prefab) {
            this.model.paused = true;
            return null;
        }
        const node = instantiate(prefab);
        node.active = false;
        this.add(node.getComponent(GameView)!);
        this.gameNode = node;
        node.parent = parent;
        this.model.paused = false;
        node.active = true;
        return node;
    }

    close() {
        this.bll.pause();
        this.gameNode!.active = false;
    }

    openLevelSelect(prefab: Prefab, parent: Node) {
        if (!prefab) {
            return null;
        }
        if (!this.levelSelectNode) {
            const node = instantiate(prefab);
            node.active = false;
            this.add(node.getComponent(LevelSelectView)!);
            node.parent = parent;
            this.levelSelectNode = node;
        }
        this.levelSelectNode.active = true;
        this.levelSelectNode.setSiblingIndex(parent.children.length - 1);
        this.levelSelectNode.getComponent(LevelSelectView)!.refresh();
        return this.levelSelectNode;
    }

    closeLevelSelect() {
        this.levelSelectNode!.active = false;
    }
}

import { Node } from 'cc';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { BattleModel } from './BattleModel';
import { BattleBll } from './BattleBll';
import { GameView } from './GameView';

@ecs.register('Battle')
export class Battle extends CCEntity {
    model!: BattleModel;
    bll!: BattleBll;
    private gameNode: Node | null = null;
    private opening: Promise<Node | null> | null = null;

    init() {
        this.model = this.add(BattleModel);
        this.bll = this.addBusiness(BattleBll);
    }

    open(newGame: boolean) {
        if (this.opening) {
            return this.opening;
        }
        if (newGame || !this.model.hasRun) {
            this.bll.restart();
        }
        if (this.gameNode) {
            this.model.paused = false;
            this.gameNode.active = true;
            return Promise.resolve(this.gameNode);
        }
        this.opening = this.addUi(GameView).then((node) => {
            this.gameNode = node;
            this.opening = null;
            this.model.paused = !node;
            return node;
        }, () => {
            this.opening = null;
            this.model.paused = true;
            return null;
        });
        return this.opening;
    }

    close() {
        this.bll.pause();
        this.gameNode!.active = false;
    }
}

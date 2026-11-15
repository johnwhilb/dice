import { _decorator, EventTouch, instantiate, Label, Node, Prefab, UITransform, Vec3 } from "cc";
import { CCView } from "db://oops-framework/module/common/CCView";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import type { Game } from "../Game";
import { GameBll } from "../bll/GameBll";
import { MainMenuSnakeView } from "../../mainManue/view/MainMenuSnakeView";
import { ColorConst } from "../../common/config/ColorConst";
import { TableRole } from "../../common/table/TableRole";

const { ccclass, property } = _decorator;

@ccclass("ArenaView")
@ecs.register("ArenaView", false)
@gui.register("ArenaView", { layer: LayerType.UI, prefab: "gui/battle/ui/ArenaView" })
export class ArenaView extends CCView<Game> {
    @property(Prefab)
    private snakeBodyPrefab: Prefab;
    private bodies: MainMenuSnakeView[] = [];
    private arena: UITransform;

    start() {
        const parent = this.getNode("arena");
        this.arena = parent.getComponent(UITransform);
        this.ent.GameModel.arenaWidth = this.arena.width;
        this.ent.GameModel.arenaHeight = this.arena.height;
        parent.on(Node.EventType.TOUCH_START, this.steer, this);
        parent.on(Node.EventType.TOUCH_MOVE, this.steer, this);
        this.bodies = this.ent.GameModel.battleTeam.map((unit, index) => {
            const node = instantiate(this.snakeBodyPrefab);
            node.parent = parent;
            const body = node.getComponent(MainMenuSnakeView);
            body.init(ColorConst.menuSnakeColors[index % ColorConst.menuSnakeColors.length]);
            return body;
        });
        this.getNode("partyLabel").getComponent(Label).string = this.ent.GameModel.battleTeam
            .map((unit) => {
                return `${TableRole.getConfigById(unit.roleId).name} Lv.${unit.level}`;
            })
            .join("  /  ");
        this.update(0);
    }

    private steer(event: EventTouch) {
        const point = event.getUILocation();
        const local = this.arena.convertToNodeSpaceAR(new Vec3(point.x, point.y, 0));
        this.ent.getBusiness<GameBll>(GameBll).steer(local.x, local.y);
    }

    update(deltaTime: number) {
        this.ent.getBusiness<GameBll>(GameBll).updateMovement(deltaTime);
        this.bodies.forEach((body, index) => {
            const pose = this.ent.GameModel.poses[index];
            body.setPose(pose.x, pose.y, pose.angle);
        });
    }

    btnShop() {
        this.ent.returnShop();
    }

    reset() {
    }
}

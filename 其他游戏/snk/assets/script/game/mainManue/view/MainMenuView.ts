import { _decorator, instantiate, Node, Prefab } from "cc";
import { oops } from "db://oops-framework/core/Oops";
import { CCView } from "db://oops-framework/module/common/CCView";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import { MainMenu } from "../MainMenu";
import { MainMenuBll } from "../bll/MainMenuBll";
import { ColorConst } from "../../common/config/ColorConst";
import { lang } from "../../common/Language";
import { MainMenuSnakeView } from "./MainMenuSnakeView";

const { ccclass, property } = _decorator;

@ccclass("MainMenuView")
@ecs.register("MainMenuView", false)
@gui.register("MainMenuView", { layer: LayerType.UI, prefab: "gui/mainMenu/ui/MainMenuView" })
export class MainMenuView extends CCView<MainMenu> {
    @property(Prefab)
    private snakeBodyPrefab: Prefab;

    private readonly snakeScale: number = 1.5;
    private elapsed: number = 0;
    private titleLetters: Node[] = [];
    private snakeBodies: MainMenuSnakeView[] = [];

    start() {
        this.titleAni();
        this.createSnake();
        this.ent.getBusiness<MainMenuBll>(MainMenuBll).refreshAudio();
        this.ent.getBusiness<MainMenuBll>(MainMenuBll).playMenuMusic();
        this.update(0);
    }

    titleAni() {
        this.titleLetters = ["titleS", "titleN", "titleK", "titleR", "titleX"].map((name) => {
            return this.getNode(name);
        });
    }

    update(deltaTime: number) {
        this.elapsed += deltaTime;
        this.titleLetters.forEach((letter, index) => {
            letter.setPosition(letter.position.x, Math.sin(this.elapsed * 2.6 + index * 0.7) * 3, 0);
        });
        this.updateSnake();
    }

    btnStart() {
        this.ent.entryGame();
    }

    btnContinue() {
        this.ent.continueGame();
    }

    btnOptions() {
        this.ent.openOptions();
    }

    btnQuit() {
        const message = this.ent.getBusiness<MainMenuBll>(MainMenuBll).quitGame();
        if (message) {
            oops.gui.toast(lang(message));
        }
    }

    btnSoundtrack() {
        this.ent.getBusiness<MainMenuBll>(MainMenuBll).openSoundtrack();
    }

    btnCommunity() {
        this.ent.getBusiness<MainMenuBll>(MainMenuBll).openCommunity();
    }

    private createSnake() {
        const parent = this.getNode("snakeLayer");
        this.snakeBodies = ColorConst.menuSnakeColors.map((color) => {
            const node = instantiate(this.snakeBodyPrefab);
            node.parent = parent;
            const body = node.getComponent(MainMenuSnakeView);
            body.init(color, this.snakeScale);
            return body;
        });
    }

    private updateSnake() {
        const radiusX = 230 * this.snakeScale;
        const radiusY = 110 * this.snakeScale;
        this.snakeBodies.forEach((body, index) => {
            const time = this.elapsed * 0.42 - index * 0.105;
            const x = 110 + Math.cos(time) * radiusX;
            const y = Math.sin(time * 2) * radiusY;
            const angle = Math.atan2(2 * radiusY * Math.cos(time * 2), -radiusX * Math.sin(time));
            body.setPose(x, y, (angle * 180) / Math.PI);
        });
    }

    reset() {
    }
}

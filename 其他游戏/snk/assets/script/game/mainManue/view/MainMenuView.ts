import { _decorator, Graphics, instantiate, Node, Prefab } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { MainMenu } from '../MainMenu';
import { MainMenuBll } from '../bll/MainMenuBll';
import { ColorConst } from '../../common/config/ColorConst';
import { lang } from '../../common/Language';
import { MainMenuSnakeView } from './MainMenuSnakeView';

const { ccclass, property } = _decorator;

interface MenuStar {
    x: number;
    y: number;
    phase: number;
}

@ccclass('MainMenuView')
@ecs.register('MainMenuView', false)
@gui.register('MainMenuView', { layer: LayerType.UI, prefab: 'gui/mainMenu/ui/MainMenuView' })
export class MainMenuView extends CCView<MainMenu> {
    @property(Prefab)
    private snakeBodyPrefab!: Prefab;

    private elapsed = 0;
    private scenery!: Graphics;
    private readonly starColor = ColorConst.menuStar.clone();
    private titleLetters: Node[] = [];
    private stars: MenuStar[] = [];
    private snakeBodies: MainMenuSnakeView[] = [];

    start() {
        this.nodeTreeInfoLite();
        this.setButton(false);
        this.scenery = this.getNode('scenery')!.getComponent(Graphics)!;
        this.titleAni();
        this.createSnake();
        this.ent.getBusiness<MainMenuBll>(MainMenuBll).refreshAudio();
        this.ent.getBusiness<MainMenuBll>(MainMenuBll).playMenuMusic();
        this.update(0);
    }

    titleAni() {
        this.titleLetters = ['titleS', 'titleN', 'titleK', 'titleR', 'titleX'].map((name) => {
            return this.getNode(name)!;
        });
        this.stars = Array.from({ length: 48 }, (value, index) => {
            return {
                x: Math.sin(index * 127.1 + 1) * 515,
                y: Math.sin(index * 311.7 + 2) * 285,
                phase: index * 2.399
            };
        });
    }

    update(deltaTime: number) {
        this.elapsed += deltaTime;
        this.titleLetters.forEach((letter, index) => {
            letter.setPosition(letter.position.x, Math.sin(this.elapsed * 2.6 + index * 0.7) * 3, 0);
        });
        this.drawScenery();
        this.updateSnake();
    }

    btnStart() {
        this.ent.entryGame();
    }

    btnContinue() {
        oops.gui.toast(lang(this.ent.continueGame()));
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

    private drawScenery() {
        const graphics = this.scenery;
        graphics.clear();
        this.stars.forEach((star) => {
            const alpha = Math.round(15 + 16 * (1 + Math.sin(this.elapsed * 1.2 + star.phase)));
            this.starColor.a = alpha;
            graphics.fillColor = this.starColor;
            graphics.rect(star.x, star.y, 2, 2);
            graphics.fill();
        });
    }

    private createSnake() {
        const parent = this.getNode('snakeLayer')!;
        this.snakeBodies = ColorConst.menuSnakeColors.map((color) => {
            const node = instantiate(this.snakeBodyPrefab);
            node.parent = parent;
            const body = node.getComponent(MainMenuSnakeView)!;
            body.init(color);
            return body;
        });
    }

    private updateSnake() {
        this.snakeBodies.forEach((body, index) => {
            const time = this.elapsed * 0.42 - index * 0.105;
            const x = 110 + Math.cos(time) * 230;
            const y = Math.sin(time * 2) * 110;
            const angle = Math.atan2(220 * Math.cos(time * 2), -230 * Math.sin(time));
            body.setPose(x, y, angle * 180 / Math.PI);
        });
    }

    reset() {

    }
}

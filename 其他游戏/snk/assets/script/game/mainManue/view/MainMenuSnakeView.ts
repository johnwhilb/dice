import { _decorator, Color, Node, Sprite } from 'cc';
import { GameComponent } from 'db://oops-framework/module/common/GameComponent';

const { ccclass } = _decorator;

@ccclass('MainMenuSnakeView')
export class MainMenuSnakeView extends GameComponent {
    private body!: Node;
    private shadow!: Node;

    init(color: Color) {
        this.nodeTreeInfoLite();
        this.body = this.getNode('body')!;
        this.shadow = this.getNode('shadow')!;
        this.body.getComponent(Sprite)!.color = color;
        this.shadow.getComponent(Sprite)!.color = color;
    }

    setPose(x: number, y: number, angle: number) {
        this.node.setPosition(x, y, 0);
        this.body.angle = angle;
        this.shadow.angle = angle;
    }
}

import { _decorator, Component, Graphics, Mask, UITransform } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('RoundMask')
export class RoundMask extends Component {

    @property
    radius: number = 20;
    private graphics: Graphics | null = null;
    start() {
        this.graphics = this.node.getComponent(Graphics);
        const uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) {
            console.error('节点没有 UITransform');
            return;
        }

        const width = uiTransform.width;
        const height = uiTransform.height;

        this.drawRoundRect(width, height);
        let mask = this.node.getComponent(Mask);
        if (!mask) {
            mask = this.node.addComponent(Mask);
        }
        mask.type = Mask.Type.GRAPHICS_STENCIL;
    }


    private drawRoundRect(width: number, height: number) {

        if (!this.graphics) return;

        this.graphics.clear();

        this.graphics.roundRect(
            -width / 2,
            -height / 2,
            width,
            height,
            this.radius
        );

        this.graphics.fill();
    }
}
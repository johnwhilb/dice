import { _decorator, Color, Component, Graphics, UITransform, Vec2, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GraphView')
export class GraphView extends Component {
    @property
    lineWidth: number = 8;

    @property
    controlOffsetRatio: number = 0.45;

    private graphics: Graphics = null!;
    private uiTransform: UITransform = null!;

    onLoad() {
        this.ensureGraphics();
        this.node.active = true;
    }

    private ensureGraphics() {
        let uiTransform = this.getComponent(UITransform)!;
        this.uiTransform = uiTransform;
        let graphics = this.getComponent(Graphics)!;
        this.graphics = graphics;
        this.graphics.lineWidth = this.lineWidth;
        this.graphics.lineCap = Graphics.LineCap.ROUND;
        this.graphics.lineJoin = Graphics.LineJoin.ROUND;
        this.graphics.strokeColor = new Color(255, 232, 150, 220);
    }

    syncTransformFrom(target: UITransform) {
        this.ensureGraphics();
        this.uiTransform.setContentSize(target.contentSize);
        this.uiTransform.setAnchorPoint(target.anchorPoint);
        this.node.setPosition(Vec3.ZERO);
    }

    drawBezierCurveByWorldPos(startWorldPos: Vec3, endWorldPos: Vec3) {
        this.ensureGraphics();
        if (!this.graphics || !this.uiTransform) {
            return;
        }

        const startPos = this.uiTransform.convertToNodeSpaceAR(startWorldPos);
        const endPos = this.uiTransform.convertToNodeSpaceAR(endWorldPos);
        this.drawBezierCurve(new Vec2(startPos.x, startPos.y), new Vec2(endPos.x, endPos.y));
    }

    drawBezierCurve(startPos: Vec2, endPos: Vec2) {
        this.ensureGraphics();
        if (!this.graphics) {
            return;
        }

        const dx = endPos.x - startPos.x;
        const dy = endPos.y - startPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 0.001) {
            return;
        }

        const dirX = dx / distance;
        const dirY = dy / distance;
        const normalX = -dirY;
        const normalY = dirX;
        const bend = distance * this.controlOffsetRatio;

        const controlPoint1 = new Vec2(
            startPos.x + dx * 0.33 + normalX * bend,
            startPos.y + dy * 0.33 + normalY * bend,
        );
        const controlPoint2 = new Vec2(
            startPos.x + dx * 0.66 + normalX * bend,
            startPos.y + dy * 0.66 + normalY * bend,
        );

        this.graphics.clear();
        this.graphics.lineWidth = this.lineWidth;
        this.graphics.moveTo(startPos.x, startPos.y);
        this.graphics.bezierCurveTo(
            controlPoint1.x,
            controlPoint1.y,
            controlPoint2.x,
            controlPoint2.y,
            endPos.x,
            endPos.y,
        );
        this.graphics.stroke();
    }

    reset() {
        this.ensureGraphics();
        if (this.graphics) {
            this.graphics.clear();
        }
        this.node.active = true;
    }
}



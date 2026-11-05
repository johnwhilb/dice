import { _decorator, Color, Component, Graphics, UITransform, Vec2, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

export interface GraphPathData {
    start: Vec2;
    end: Vec2;
    color: Color;
    animated: boolean;
}

@ccclass('GraphView')
export class GraphView extends Component {
    @property
    lineWidth: number = 8;


    private graphics: Graphics = null!;
    private uiTransform: UITransform = null!;
    private paths: GraphPathData[] = [];
    private dashOffset = 0;
    private redrawTime = 0;

    onLoad() {
        this.ensureGraphics();
        this.node.active = true;
    }

    setMarchingPaths(paths: GraphPathData[]) {
        this.ensureGraphics();
        this.paths = paths;
        this.drawMarchingPaths();
    }

    update(deltaTime: number) {
        if (!this.paths.length) {
            return;
        }
        this.dashOffset = (this.dashOffset + deltaTime * 24) % 18;
        this.redrawTime += deltaTime;
        if (this.redrawTime < 1 / 30) {
            return;
        }
        this.redrawTime = 0;
        this.drawMarchingPaths();
    }

    private drawMarchingPaths() {
        this.graphics.clear();
        this.graphics.lineWidth = this.lineWidth;
        for (const path of this.paths) {
            const dx = path.end.x - path.start.x;
            const dy = path.end.y - path.start.y;
            const length = Math.hypot(dx, dy);
            if (length < 1) {
                continue;
            }
            this.graphics.strokeColor = path.color;
            let distance = path.animated ? this.dashOffset - 18 : 0;
            while (distance < length) {
                const start = Math.max(0, distance);
                const end = Math.min(length, distance + 9);
                if (end > start) {
                    this.graphics.moveTo(path.start.x + dx * start / length, path.start.y + dy * start / length);
                    this.graphics.lineTo(path.start.x + dx * end / length, path.start.y + dy * end / length);
                }
                distance += 18;
            }
            this.graphics.stroke();
        }
    }

    private ensureGraphics() {
        const uiTransform = this.getComponent(UITransform)!;
        this.uiTransform = uiTransform;
        const graphics = this.getComponent(Graphics)!;
        this.graphics = graphics;
        this.graphics.lineWidth = this.lineWidth;
        this.graphics.lineCap = Graphics.LineCap.ROUND;
        this.graphics.lineJoin = Graphics.LineJoin.ROUND;
        this.graphics.strokeColor = new Color(178, 192, 73, 255);
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

        const distance = Math.sqrt(
            dx * dx + dy * dy
        );

        if (distance < 0.001) {
            this.graphics.clear();
            return;
        }

        // start -> end 单位方向
        const dirX = dx / distance;
        const dirY = dy / distance;

        /*
         * 不要设置最小值。
         * 距离很短时控制柄也必须跟着缩短，
         * 否则很容易出现回钩。
         */
        const startHandle = Math.min(
            distance * 0.32,
            160
        );

        const endHandle = Math.min(
            distance * 0.22,
            110
        );

        /*
         * 起点：
         * 卡牌瞄准线通常希望先向上出去。
         */
        const verticalDirection =
            dy >= 0 ? 1 : -1;

        const controlPoint1 = new Vec2(
            startPos.x,
            startPos.y
            + startHandle * verticalDirection
        );

        /*
         * 重点：
         *
         * 第二控制点沿 start -> end 方向向后退。
         *
         * 因此终点切线：
         *
         * P3 - P2
         *
         * 一定与 start -> end 同方向。
         */
        const controlPoint2 = new Vec2(
            endPos.x - dirX * endHandle,
            endPos.y - dirY * endHandle
        );

        this.graphics.clear();

        this.graphics.lineWidth =
            this.lineWidth;

        this.graphics.moveTo(
            startPos.x,
            startPos.y
        );

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
        this.paths = [];
        this.dashOffset = 0;
        this.ensureGraphics();
        if (this.graphics) {
            this.graphics.clear();
        }
        this.node.active = true;
    }
}



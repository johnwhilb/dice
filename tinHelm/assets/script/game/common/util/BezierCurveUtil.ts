// import { _decorator, Color, Component, Graphics, UITransform, Vec2, Vec3 } from 'cc';
// const { ccclass, property } = _decorator;

// @ccclass('BezierCurveUtil')
// export class BezierCurveUtil extends Component {
//     @property
//     lineWidth: number = 8;

//     @property
//     controlOffsetRatio: number = 0.45;

//     private graphics: Graphics = null!;
//     private uiTransform: UITransform = null!;

//     onLoad() {
//         this.ensureGraphics();
//         this.node.active = false;
//     }

//     private ensureGraphics() {
//         let uiTransform = this.getComponent(UITransform);
//         if (!uiTransform) {
//             uiTransform = this.addComponent(UITransform);
//         }
//         this.uiTransform = uiTransform!;

//         let graphics = this.getComponent(Graphics);
//         if (!graphics) {
//             graphics = this.addComponent(Graphics);
//         }
//         this.graphics = graphics!;
//         this.graphics.lineWidth = this.lineWidth;
//         this.graphics.lineCap = Graphics.LineCap.ROUND;
//         this.graphics.lineJoin = Graphics.LineJoin.ROUND;
//         this.graphics.strokeColor = new Color(255, 232, 150, 220);
//     }

//     drawByWorldPos(startWorldPos: Vec3, endWorldPos: Vec3) {
//         this.ensureGraphics();
//         if (!this.graphics || !this.uiTransform) {
//             return;
//         }

//         const startPos = this.uiTransform.convertToNodeSpaceAR(startWorldPos);
//         const endPos = this.uiTransform.convertToNodeSpaceAR(endWorldPos);
//         this.draw(new Vec2(startPos.x, startPos.y), new Vec2(endPos.x, endPos.y));
//     }

//     draw(startPos: Vec2, endPos: Vec2) {
//         this.ensureGraphics();

//         if (!this.graphics) {
//             return;
//         }

//         const dx = endPos.x - startPos.x;
//         const dy = endPos.y - startPos.y;

//         const distance = Math.sqrt(dx * dx + dy * dy);

//         if (distance < 0.001) {
//             return;
//         }

//         // 滑动方向单位向量
//         const dirX = dx / distance;
//         const dirY = dy / distance;

//         // 与滑动方向垂直的法线
//         const normalX = -dirY;
//         const normalY = dirX;

//         // 弯曲程度
//         const bend = distance * this.controlOffsetRatio;

//         // 两个控制点沿曲线方向分布，同时向同一侧偏移
//         const controlPoint1 = new Vec2(
//             startPos.x + dx * 0.33 + normalX * bend,
//             startPos.y + dy * 0.33 + normalY * bend,
//         );

//         const controlPoint2 = new Vec2(
//             startPos.x + dx * 0.66 + normalX * bend,
//             startPos.y + dy * 0.66 + normalY * bend,
//         );

//         this.node.active = true;

//         this.graphics.clear();
//         this.graphics.lineWidth = this.lineWidth;

//         this.graphics.moveTo(startPos.x, startPos.y);

//         this.graphics.bezierCurveTo(
//             controlPoint1.x,
//             controlPoint1.y,
//             controlPoint2.x,
//             controlPoint2.y,
//             endPos.x,
//             endPos.y,
//         );

//         this.graphics.stroke();
//     }

//     reset() {
//         this.ensureGraphics();
//         if (this.graphics) {
//             this.graphics.clear();
//         }
//         this.node.active = false;
//     }
// }



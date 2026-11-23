import { _decorator, Component, Graphics, Sprite, UITransform, Vec2 } from "cc";
import type { Color } from "cc";
import { ColorConst } from "../../common/config/ColorConst";
import { ShopEffectBll, shopEffectColorTime, shopEffectScale } from "../bll/ShopEffectBll";
import { ShopEffectModel } from "../model/ShopEffectModel";
import type { IShopEffectParticle } from "../model/ShopEffectModel";

const { ccclass } = _decorator;

@ccclass("ShopOfferEffect")
export class ShopOfferEffect extends Component {
    private graphics: Graphics;
    private readonly model = new ShopEffectModel();
    private readonly business = new ShopEffectBll(this.model);

    onLoad() {
        this.graphics = this.addComponent(Graphics);
    }

    play(target: Sprite) {
        const position = this.getComponent(UITransform).convertToNodeSpaceAR(target.node.worldPosition);
        this.playAt(position.x, position.y - 4 * shopEffectScale, target.color);
    }

    playAt(x: number, y: number, color: Color) {
        this.business.play(x, y, color);
    }

    update(delta: number) {
        if (!this.model.bursts.length) {
            return;
        }
        this.business.update(delta);
        this.graphics.clear();
        for (const burst of this.model.bursts) {
            if (burst.radius > 0) {
                const jitter = 0.9 + Math.random() * 0.2;
                this.graphics.fillColor = burst.elapsed < shopEffectColorTime ? ColorConst.shopText : burst.color;
                this.graphics.circle(burst.x, burst.y, burst.radius * burst.springScale * jitter);
                this.graphics.fill();
            }
            this.graphics.fillColor = burst.color;
            for (const particle of burst.particles) {
                this.drawParticle(particle);
            }
        }
    }

    private drawParticle(particle: IShopEffectParticle) {
        const endSize = 2 * shopEffectScale;
        const halfWidth = (endSize + (particle.width - endSize) * particle.sizeFactor) / 2;
        const halfHeight = (endSize + (particle.width / 2 - endSize) * particle.sizeFactor) / 2;
        const radius = Math.min(endSize, halfHeight);
        const arcHandle = (4 / 3) * (Math.SQRT2 - 1);
        const corners = [
            [-halfWidth, -halfHeight, 1, -1],
            [halfWidth, -halfHeight, 1, 1],
            [halfWidth, halfHeight, -1, 1],
            [-halfWidth, halfHeight, -1, -1],
        ];
        const toWorld = (x: number, y: number) => {
            return new Vec2(
                particle.x + x * particle.directionX - y * particle.directionY,
                particle.y + x * particle.directionY + y * particle.directionX,
            );
        };
        for (const [index, corner] of corners.entries()) {
            const [x, y, xSign, ySign] = corner;
            const entry = index % 2 === 0 ? toWorld(x, y - ySign * radius) : toWorld(x - xSign * radius, y);
            const control = toWorld(x, y);
            const exit = index % 2 === 0 ? toWorld(x + xSign * radius, y) : toWorld(x, y + ySign * radius);
            if (index === 0) {
                this.graphics.moveTo(entry.x, entry.y);
            } else {
                this.graphics.lineTo(entry.x, entry.y);
            }
            this.graphics.bezierCurveTo(
                entry.x + (control.x - entry.x) * arcHandle,
                entry.y + (control.y - entry.y) * arcHandle,
                exit.x + (control.x - exit.x) * arcHandle,
                exit.y + (control.y - exit.y) * arcHandle,
                exit.x,
                exit.y,
            );
        }
        this.graphics.close();
        this.graphics.fill();
    }
}

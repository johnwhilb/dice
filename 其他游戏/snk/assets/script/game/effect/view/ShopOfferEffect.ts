import { _decorator, Component, Graphics, Label, Node, Sprite, UITransform, Vec2 } from "cc";
import type { Color, Vec3 } from "cc";
import { ColorConst } from "../../common/config/ColorConst";
import { ShopEffectBll, shopEffectColorTime, shopEffectExpandTime, shopEffectScale } from "../bll/ShopEffectBll";
import { ShopEffectModel } from "../model/ShopEffectModel";
import type { IShopEffectBurst, IShopEffectParticle } from "../model/ShopEffectModel";

const { ccclass } = _decorator;

@ccclass("ShopOfferEffect")
export class ShopOfferEffect extends Component {
    private graphics: Graphics;
    private labels: Label[] = [];
    private readonly model = new ShopEffectModel();
    private readonly business = new ShopEffectBll(this.model);

    onLoad() {
        this.graphics = this.addComponent(Graphics);
    }

    play(target: Sprite) {
        this.playFromWorldPosition(target.node.worldPosition, target.color);
    }

    playFromWorldPosition(worldPosition: Readonly<Vec3>, color: Color) {
        const position = this.getComponent(UITransform).convertToNodeSpaceAR(worldPosition);
        this.playAt(position.x, position.y - 4 * shopEffectScale, color);
    }

    playAt(x: number, y: number, color: Color) {
        this.business.play(x, y, color);
    }

    playCelebrationFromWorld(worldPosition: Readonly<Vec3>, color: Color, major: boolean = false) {
        const position = this.getComponent(UITransform).convertToNodeSpaceAR(worldPosition);
        this.business.playCelebration(position.x, position.y, color, major);
    }

    playFloatingTextFromWorld(worldPosition: Readonly<Vec3>, text: string, color: Color, major: boolean = false) {
        const position = this.getComponent(UITransform).convertToNodeSpaceAR(worldPosition);
        this.business.playText(position.x, position.y, text, color, major);
    }

    update(delta: number) {
        if (!this.model.bursts.length && !this.model.texts.length) {
            this.hideLabels();
            return;
        }
        this.business.update(delta);
        this.graphics.clear();
        for (const burst of this.model.bursts) {
            this.drawBurst(burst);
        }
        this.renderTexts();
    }

    private drawBurst(burst: IShopEffectBurst) {
        if (burst.ringRadius && burst.ringDuration) {
            const age = Math.max(0, burst.elapsed - shopEffectExpandTime);
            const progress = Math.min(1, age / burst.ringDuration);
            if (progress < 1) {
                const remaining = 1 - progress;
                const eased = 1 - remaining ** 3;
                const ringColor = burst.color.clone();
                ringColor.a = Math.round(235 * remaining);
                this.graphics.strokeColor = ringColor;
                this.graphics.lineWidth = 2.5 + 4.5 * remaining;
                this.graphics.circle(burst.x, burst.y, burst.ringRadius * (0.25 + 0.85 * eased));
                this.graphics.stroke();

                if (burst.starFlash) {
                    const gold = ColorConst.shopMergeButton.clone();
                    gold.a = Math.round(220 * remaining);
                    this.graphics.strokeColor = gold;
                    this.graphics.lineWidth = 2 + 3 * remaining;
                    this.graphics.circle(burst.x, burst.y, burst.ringRadius * (0.45 + 0.9 * eased));
                    this.graphics.stroke();

                    const arm = burst.ringRadius * 0.65 * remaining;
                    const white = ColorConst.WHITE.clone();
                    white.a = Math.round(240 * remaining);
                    this.graphics.strokeColor = white;
                    this.graphics.lineWidth = 2 + 2.5 * remaining;
                    this.graphics.moveTo(burst.x - arm, burst.y);
                    this.graphics.lineTo(burst.x + arm, burst.y);
                    this.graphics.moveTo(burst.x, burst.y - arm);
                    this.graphics.lineTo(burst.x, burst.y + arm);
                    this.graphics.stroke();
                }
            }
        }
        if (burst.radius > 0) {
            const jitter = 0.9 + Math.random() * 0.2;
            this.graphics.fillColor = burst.elapsed < shopEffectColorTime ? ColorConst.shopText : burst.color;
            this.graphics.circle(burst.x, burst.y, burst.radius * burst.springScale * jitter);
            this.graphics.fill();
        }
        for (const particle of burst.particles) {
            this.graphics.fillColor = particle.color ?? burst.color;
            this.drawParticle(particle);
        }
    }

    private renderTexts() {
        const texts = this.model.texts;
        for (let index = this.labels.length; index < texts.length; index++) {
            const node = new Node("shopFloatText");
            node.layer = this.node.layer;
            node.parent = this.node;
            node.addComponent(UITransform).setContentSize(220, 34);
            const label = node.addComponent(Label);
            label.fontSize = 22;
            label.lineHeight = 24;
            label.isBold = true;
            label.enableOutline = true;
            label.outlineColor = ColorConst.battleDamageOutline;
            label.outlineWidth = 2;
            this.labels.push(label);
        }
        this.labels.forEach((label, index) => {
            label.node.active = index < texts.length;
            if (!label.node.active) {
                return;
            }
            const item = texts[index];
            const progress = Math.min(1, item.elapsed / item.duration);
            const remaining = 1 - progress;
            const baseScale = item.major ? 1.24 : 1;
            const pop = progress < 0.18
                ? baseScale * (0.75 + 0.45 * (progress / 0.18))
                : baseScale * (1.2 - 0.2 * Math.min(1, (progress - 0.18) / 0.28));
            const color = item.color.clone();
            color.a = remaining < 0.35 ? Math.round(255 * (remaining / 0.35)) : 255;
            label.string = item.text;
            label.color = color;
            label.node.setScale(pop, pop, 1);
            label.node.setPosition(item.x, item.y, 0);
        });
    }

    private hideLabels() {
        for (const label of this.labels) {
            if (label.node.active) {
                label.node.active = false;
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

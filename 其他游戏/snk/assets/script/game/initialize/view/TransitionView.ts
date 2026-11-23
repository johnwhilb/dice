import { _decorator, BlockInputEvents, Component, director, Director, game, Graphics, Label, Layers, Node, TTFFont, tween, UITransform, Vec3 } from "cc";
import type { Color } from "cc";
import { oops } from "db://oops-framework/core/Oops";
import { ColorConst } from "../../common/config/ColorConst";
import type { IRoundGoldReward } from "../../shop/ShopEvent";

const { ccclass } = _decorator;

export interface ITransitionOptions {
    message?: string;
    reward?: IRoundGoldReward;
    origin?: Readonly<Vec3>;
    color?: Color;
}

interface ITransitionGlyph {
    node: Node;
    x: number;
}

interface ITransitionLine {
    node: Node;
    glyphs: ITransitionGlyph[];
    nudgeStarted?: number;
}

@ccclass("TransitionView")
export class TransitionView extends Component {
    private readonly fontSize = 24;
    private readonly lines: ITransitionLine[] = [];
    private title: Node;
    private font?: TTFFont;
    private rewardText = false;

    static play(options: ITransitionOptions, open: () => Promise<boolean>) {
        const root = oops.gui.root;
        const node = new Node("gameTransition");
        node.layer = Layers.Enum.UI_2D;
        node.parent = root;
        node.addComponent(UITransform).setContentSize(root.getComponent(UITransform).contentSize);
        node.addComponent(BlockInputEvents);
        return node.addComponent(TransitionView).run(options, open);
    }

    private run(options: ITransitionOptions, open: () => Promise<boolean>) {
        const transform = this.getComponent(UITransform);
        const origin = options.origin ? transform.convertToNodeSpaceAR(options.origin) : Vec3.ZERO;
        const halfWidth = transform.width / 2;
        const halfHeight = transform.height / 2;
        const coverage = Math.max(transform.width * 1.2, Math.hypot(halfWidth + Math.abs(origin.x), halfHeight + Math.abs(origin.y)));
        const graphics = this.addComponent(Graphics);
        const color = options.color ?? ColorConst.shopText;
        this.title = new Node("transitionTitle");
        this.title.parent = this.node;
        this.title.layer = this.node.layer;
        this.title.setScale(0, 0, 1);
        this.rewardText = !!options.reward;
        if (options.reward) {
            this.setLine(0, "gold gained: 0 + 0");
            this.setLine(1, "interest: 0");
            this.setLine(2, "total: 0");
        } else if (options.message) {
            this.setLine(0, options.message);
        }
        const draw = (x: number, y: number, radius: number) => {
            graphics.clear();
            if (radius > 0) {
                graphics.fillColor = color;
                graphics.circle(x, y, radius);
                graphics.fill();
            }
        };
        return new Promise<boolean>((resolve) => {
            const reveal = (ready: boolean) => {
                const inner = { radius: coverage };
                draw(0, 0, coverage);
                tween(inner).delay(0.3).to(0.6, { radius: 0 }, {
                    onUpdate: () => {
                        draw(0, 0, inner.radius);
                    },
                }).call(() => {
                    this.node.destroy();
                    resolve(ready);
                }).start();
                tween(this.title).delay(0.85).to(0.05, { scale: new Vec3(0, 0, 1) }, { easing: "cubicInOut" }).start();
            };
            const outer = { radius: 0 };
            tween(this.title).delay(0.35).to(0.1, { scale: Vec3.ONE }, { easing: "cubicInOut" }).start();
            tween(outer).delay(0.25).to(0.6, { radius: coverage }, {
                onUpdate: () => {
                    draw(origin.x, origin.y, outer.radius);
                },
            }).call(() => {
                Promise.resolve().then(open).then((ready) => {
                    if (ready) {
                        director.once(Director.EVENT_AFTER_DRAW, () => {
                            if (options.reward) {
                                this.revealReward(options.reward);
                            }
                            reveal(true);
                        });
                    } else {
                        reveal(false);
                    }
                }, () => {
                    reveal(false);
                });
            }).start();
        });
    }

    update() {
        const time = game.totalTime / 1000;
        const amplitude = this.rewardText ? 0.75 : 6;
        const frequency = this.rewardText ? 2 : 4;
        for (const line of this.lines) {
            line.glyphs.forEach((glyph, index) => {
                const y = line.nudgeStarted === undefined
                    ? -amplitude * Math.sin(frequency * time + index + 1)
                    : 12 * Math.max(0, 1 - (time - line.nudgeStarted) / 0.1);
                glyph.node.setPosition(glyph.x, y, 0);
            });
        }
    }

    private setLine(index: number, value: string, nudge: boolean = false) {
        const previous = this.lines[index];
        if (previous) {
            previous.node.active = false;
            previous.node.destroy();
        }
        const line = new Node("transitionLine");
        line.parent = this.title;
        line.layer = this.title.layer;
        line.setPosition(0, this.rewardText ? (1 - index) * 36 : 0, 0);
        const glyphs: ITransitionGlyph[] = [];
        let width = 0;
        for (const character of value) {
            const node = new Node("lbtTransitionGlyph");
            node.parent = line;
            node.layer = line.layer;
            const transform = node.addComponent(UITransform);
            const label = node.addComponent(Label);
            label.fontSize = this.fontSize;
            label.lineHeight = this.fontSize + 2;
            label.color = ColorConst.shopItemXpEmpty;
            if (this.font) {
                label.font = this.font;
            }
            label.string = character;
            label.updateRenderData(true);
            const glyphWidth = transform.width || this.fontSize / 2;
            glyphs.push({ node, x: width + glyphWidth / 2 });
            width += glyphWidth;
        }
        for (const glyph of glyphs) {
            glyph.x -= width / 2;
            glyph.node.setPosition(glyph.x, nudge ? 12 : 0, 0);
        }
        this.lines[index] = { node: line, glyphs, nudgeStarted: nudge ? game.totalTime / 1000 : undefined };
    }

    private revealReward(reward: IRoundGoldReward) {
        this.scheduleOnce(() => {
            this.setLine(0, `gold gained: ${reward.roundGold} + ${reward.pickedUpGold}`, true);
        }, 0.1);
        this.scheduleOnce(() => {
            this.lines[0].nudgeStarted = undefined;
            this.setLine(1, `interest: ${reward.interest}`, true);
        }, 0.3);
        this.scheduleOnce(() => {
            this.lines[1].nudgeStarted = undefined;
            this.setLine(2, `total: ${reward.roundGold + reward.pickedUpGold + reward.interest}`, true);
        }, 0.5);
    }
}

import { _decorator, Color, EventKeyboard, EventTouch, Graphics, input, Input, KeyCode, Label, Layers, Mask, Node, Sprite, UITransform, Vec3, view } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { smc } from '../common/SingletonModuleComp';
import type { Battle } from './Battle';
import { ClimberView } from './ClimberView';
import { ClimbPoint, ClimbState, HoldType, TableClimbRoute } from './TableClimbRoute';

const { ccclass } = _decorator;

interface HoldDisplay {
    node: Node;
    sprite: Sprite;
}

interface ClimbParticle extends ClimbPoint {
    vx: number;
    vy: number;
    life: number;
    age: number;
    color: Color;
}

@ccclass('GameView')
@ecs.register('GameView', false)
@gui.register('GameView', { layer: LayerType.UI, prefab: 'gui/gameView/GameView' })
export class GameView extends CCView<Battle> {
    private board!: Node;
    private stage!: Node;
    private world!: Node;
    private backdrop!: Graphics;
    private highlights!: Graphics;
    private effects!: Graphics;
    private climber!: ClimberView;
    private staminaText!: Label;
    private timerText!: Label;
    private staminaBar!: Graphics;
    private holds = new Map<string, HoldDisplay>();
    private particles: ClimbParticle[] = [];
    private previousMoves = 0;
    private previousTime = 0;
    private previousState = ClimbState.Playing;
    private broken = new Set<string>();
    private ready = false;
    private readonly lime = new Color(200, 251, 116);

    start() {
        this.nodeTreeInfoLite();
        this.board = this.getNode('Board')!;
        this.stage = this.getNode('Stage')!;
        this.world = this.getNode('World')!;
        this.staminaText = this.getNode('StaminaText')!.getComponent(Label)!;
        this.timerText = this.getNode('TimerText')!.getComponent(Label)!;
        this.staminaBar = this.getNode('StaminaBar')!.addComponent(Graphics);
        this.bindButton('btnReturn', this.btnReturn);
        this.bindButton('btnRestart', this.btnRestart);
        this.backdrop = this.node.addComponent(Graphics);
        this.stage.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.stage.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.stage.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.stage.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        this.resize();
        this.renderHud();
        this.buildWorld().then((loaded) => {
            this.ready = loaded;
            if (loaded) {
                this.render(0);
            }
            else {
                this.ent.model.paused = true;
                oops.gui.toast('游戏资源加载失败');
            }
        });
    }

    protected onEnable() {
        input.on(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
        view.on('canvas-resize', this.resize, this);
        if (this.ready) {
            this.resize();
        }
    }

    protected onDisable() {
        input.off(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
        view.off('canvas-resize', this.resize, this);
    }

    private resize() {
        const size = view.getVisibleSize();
        const scale = Math.min(size.width / 750, size.height / 1334);
        this.board.setScale(scale, scale, 1);
        this.backdrop.clear();
        this.backdrop.fillColor = new Color(10, 20, 30);
        this.backdrop.rect(-size.width / 2, -size.height / 2, size.width, size.height);
        this.backdrop.fill();
    }

    private buildWorld() {
        this.stage.addComponent(Mask);
        const scale = 720 / TableClimbRoute.width;
        this.world.setScale(scale, scale, 1);
        const loading: Promise<boolean>[] = [];
        this.createSprite('background', 760, 2220, loading).node.setPosition(380, -1110);
        this.createSprite('climbing_wall', 760, 2220, loading).node.setPosition(380, -1110);
        this.ent.model.holds.forEach((hold) => {
            const sprite = this.createSprite(`hold${hold.id}`, 174, 194, loading);
            sprite.node.setPosition(hold.x, -hold.y);
            this.holds.set(hold.id, { node: sprite.node, sprite });
        });
        this.highlights = this.createNode('Highlights').addComponent(Graphics);
        return this.createPrefabNode('gui/gameView/Climber').then((node) => {
            const climber = node?.getComponent(ClimberView);
            if (!climber) {
                return false;
            }
            this.climber = climber;
            climber.node.parent = this.world;
            climber.init(this.ent);
            this.effects = this.createNode('Effects').addComponent(Graphics);
            return Promise.all(loading).then((results) => {
                return results.every((loaded) => {
                    return loaded;
                });
            });
        }).then((loaded) => {
            return loaded;
        }, () => {
            return false;
        });
    }

    private createNode(name: string, width = 760, height = 760) {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform).setContentSize(width, height);
        node.parent = this.world;
        return node;
    }

    private createSprite(name: string, width: number, height: number, loading: Promise<boolean>[]) {
        const node = this.createNode(name, width, height);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;
        loading.push(this.setSprite(sprite, `gui/gameView/texture/${name}/spriteFrame`));
        return sprite;
    }

    private bindButton(name: string, callback: (event: EventTouch) => void) {
        const node = this.getNode(name)!;
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = new Color(20, 35, 46);
        graphics.strokeColor = new Color(60, 79, 89);
        graphics.lineWidth = 1;
        graphics.roundRect(-47, -24, 94, 48, 12);
        graphics.fill();
        graphics.stroke();
        node.on(Node.EventType.TOUCH_END, callback, this);
    }

    btnReturn(event: EventTouch) {
        event.propagationStopped = true;
        this.ent.close();
        smc.mainMenu.MainMenuView.node.active = true;
        smc.mainMenu.MainMenuView.refresh();
    }

    btnRestart(event: EventTouch) {
        event.propagationStopped = true;
        this.ent.bll.restart();
    }

    private onTouchStart(event: EventTouch) {
        if (this.ready) {
            this.ent.bll.pointerDown(this.touchPoint(event), event.getID() ?? 0);
        }
        event.propagationStopped = true;
    }

    private onTouchMove(event: EventTouch) {
        if (this.ready) {
            this.ent.bll.pointerMove(this.touchPoint(event), event.getID() ?? 0);
        }
        event.propagationStopped = true;
    }

    private onTouchEnd(event: EventTouch) {
        this.ent.bll.pointerUp(event.getID() ?? 0);
        event.propagationStopped = true;
    }

    private onTouchCancel(event: EventTouch) {
        this.ent.bll.pointerUp(event.getID() ?? 0, true);
        event.propagationStopped = true;
    }

    private touchPoint(event: EventTouch) {
        const location = event.getUILocation();
        const point = this.stage.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(location.x, location.y));
        const scale = 720 / TableClimbRoute.width;
        return {
            x: point.x / scale + TableClimbRoute.width / 2,
            y: this.ent.model.camera + TableClimbRoute.viewHeight / 2 - point.y / scale
        };
    }

    private handleKeyDown(event: EventKeyboard) {
        if (!this.ready) {
            return;
        }
        if (event.keyCode === KeyCode.KEY_R) {
            this.ent.bll.restart();
        }
        else if (event.keyCode === KeyCode.KEY_A || event.keyCode === KeyCode.ARROW_LEFT) {
            this.ent.bll.lean(-1);
        }
        else if (event.keyCode === KeyCode.KEY_D || event.keyCode === KeyCode.ARROW_RIGHT) {
            this.ent.bll.lean(1);
        }
        else if (event.keyCode === KeyCode.ESCAPE) {
            this.ent.model.selected = null;
        }
    }

    update(dt: number) {
        if (!this.ready) {
            return;
        }
        this.ent.bll.update(dt);
        this.render(dt);
    }

    private render(dt: number) {
        const scale = 720 / TableClimbRoute.width;
        this.world.setPosition(-TableClimbRoute.width / 2 * scale, (TableClimbRoute.viewHeight / 2 + this.ent.model.camera) * scale);
        this.renderHolds();
        this.climber.render();
        this.renderHud();
        this.renderEffects(dt);
    }

    private renderHolds() {
        const model = this.ent.model;
        const graphics = this.highlights;
        graphics.clear();
        if (model.selected && model.state === ClimbState.Playing) {
            const root = this.ent.bll.rootOf(model.selected);
            graphics.fillColor = new Color(212, 255, 146, 18);
            graphics.strokeColor = new Color(220, 255, 175, 75);
            graphics.lineWidth = 2;
            graphics.circle(root.x, -root.y, this.ent.bll.maxReach(model.selected));
            graphics.fill();
            graphics.stroke();
        }
        model.holds.forEach((hold) => {
            const display = this.holds.get(hold.id)!;
            display.node.active = !hold.broken;
            const reachable = !!model.selected && this.ent.bll.canReach(model.selected, hold);
            const occupied = !!this.ent.bll.holderOf(hold.id);
            display.sprite.color = model.selected && !reachable ? new Color(183, 183, 183) : Color.WHITE;
            if (reachable || occupied || hold.type === HoldType.Finish) {
                graphics.strokeColor = reachable ? this.lime : hold.type === HoldType.Finish ? new Color(255, 224, 120, 160) : new Color(255, 212, 158, 110);
                graphics.lineWidth = reachable ? 3 : 2;
                graphics.circle(hold.x, -hold.y, reachable ? 41 : 35);
                graphics.stroke();
            }
            if (hold.type === HoldType.Crumble && !hold.broken) {
                graphics.strokeColor = new Color(255, 173, 131);
                graphics.lineWidth = 4;
                graphics.arc(hold.x, -hold.y, 44, Math.PI / 2, Math.PI / 2 - Math.PI * 2 * Math.max(0, hold.durability / TableClimbRoute.get().brittle), false);
                graphics.stroke();
            }
        });
    }

    private renderHud() {
        const model = this.ent.model;
        const seconds = Math.floor(model.elapsed);
        this.timerText.string = `时间 ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        this.staminaText.string = `体力 ${model.stamina.toFixed(1)}%`;
        this.staminaText.color = model.stamina < 26 ? new Color(255, 146, 102) : this.lime;
        this.staminaBar.clear();
        this.staminaBar.fillColor = new Color(6, 21, 27);
        this.staminaBar.roundRect(-360, -6, 720, 12, 6);
        this.staminaBar.fill();
        if (model.stamina > 0) {
            this.staminaBar.fillColor = this.staminaText.color;
            const width = 720 * model.stamina / 100;
            this.staminaBar.roundRect(-360, -6, width, 12, Math.min(width, 12) / 2);
            this.staminaBar.fill();
        }
    }

    private renderEffects(dt: number) {
        const model = this.ent.model;
        if (model.moves < this.previousMoves || model.time < this.previousTime) {
            this.particles = [];
            this.broken.clear();
        }
        model.holds.forEach((hold) => {
            if (hold.broken && !this.broken.has(hold.id)) {
                this.broken.add(hold.id);
                this.burst(hold, new Color(255, 193, 138), 18);
            }
        });
        if (model.moves > this.previousMoves) {
            model.limbs.forEach((limb) => {
                if (limb.holdId) {
                    this.burst(limb, this.lime, 5);
                }
            });
        }
        if (model.state === ClimbState.Won && this.previousState !== ClimbState.Won) {
            this.burst({ x: 370, y: 220 }, new Color(255, 233, 125), 45);
            this.burst({ x: 486, y: 220 }, this.lime, 45);
        }
        this.previousMoves = model.moves;
        this.previousTime = model.time;
        this.previousState = model.state;
        const graphics = this.effects;
        graphics.clear();
        this.particles = this.particles.filter((particle) => {
            particle.age += dt;
            if (particle.age >= particle.life) {
                return false;
            }
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            particle.vy += 240 * dt;
            particle.color.a = Math.round(255 * Math.max(0, 1 - particle.age / particle.life));
            graphics.fillColor = particle.color;
            graphics.circle(particle.x, -particle.y, 4 * (1 - particle.age / particle.life * 0.65));
            graphics.fill();
            return true;
        });
    }

    private burst(point: ClimbPoint, color: Color, count: number) {
        Array.from({ length: count }).forEach(() => {
            const angle = Math.random() * Math.PI * 2;
            const speed = 45 + Math.random() * 90;
            this.particles.push({ x: point.x, y: point.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 45, life: 0.4 + Math.random() * 0.4, age: 0, color: color.clone() });
        });
    }

    reset() {
        this.ready = false;
        this.particles = [];
        this.holds.clear();
    }
}

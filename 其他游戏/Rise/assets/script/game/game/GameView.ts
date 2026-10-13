import { _decorator, Color, EventKeyboard, EventTouch, Graphics, input, Input, instantiate, KeyCode, Label, Layers, Mask, Node, NodePool, Prefab, Sprite, UITransform, Vec3, view } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { smc } from '../common/SingletonModuleComp';
import { HoldTypeKindEnum } from '../common/table/HoldTypeKindEnum';
import type { Climb } from './Climb';
import { ClimberView } from './ClimberView';
import { ClimbHold, ClimbPoint, ClimbState, TableClimbRoute } from './TableClimbRoute';

const { ccclass, property } = _decorator;

interface HoldDisplay {
    node: Node;
    sprite: Sprite;
    pool: NodePool;
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
export class GameView extends CCView<Climb> {
    @property({ type: Prefab, tooltip: '人物预制体' })
    climberPrefab!: Prefab;

    @property({ type: Prefab, tooltip: 'holdh01 易碎岩点预制体' })
    crumbleHoldPrefab!: Prefab;

    @property({ type: Prefab, tooltip: 'holdh02 普通岩点预制体' })
    normalHoldPrefab!: Prefab;

    @property({ type: Prefab, tooltip: 'holdF1 左侧终点预制体' })
    finishLeftHoldPrefab!: Prefab;

    @property({ type: Prefab, tooltip: 'holdF2 右侧终点预制体' })
    finishRightHoldPrefab!: Prefab;

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
    private holdRoot!: Node;
    private holdSource: ClimbHold[] = [];
    private holdPrefabs = new Map<HoldTypeKindEnum, Prefab>();
    private holdPools = new Map<HoldTypeKindEnum, NodePool>();
    private wallLoops: Node[] = [];
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
        if (!this.climberPrefab || !this.crumbleHoldPrefab || !this.normalHoldPrefab || !this.finishLeftHoldPrefab || !this.finishRightHoldPrefab) {
            this.ent.model.paused = true;
            oops.gui.toast('GameView 缺少人物或岩点预制体，请检查静态绑定');
            return;
        }
        this.buildWorld();
        this.ready = true;
        this.render(0);
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
        this.world.setPosition(-TableClimbRoute.width / 2 * scale, (TableClimbRoute.viewHeight / 2 + this.ent.model.camera) * scale);
        this.buildWall();
        this.holdPrefabs.set(HoldTypeKindEnum.Danger, this.crumbleHoldPrefab);
        this.holdPrefabs.set(HoldTypeKindEnum.Normal, this.normalHoldPrefab);
        this.holdPrefabs.set(HoldTypeKindEnum.FinishLeft, this.finishLeftHoldPrefab);
        this.holdPrefabs.set(HoldTypeKindEnum.FinishRight, this.finishRightHoldPrefab);
        for (const type of this.holdPrefabs.keys()) {
            this.holdPools.set(type, new NodePool());
        }
        this.holdRoot = this.createNode('Holds');
        this.rebuildHolds();
        this.highlights = this.createNode('Highlights').addComponent(Graphics);
        const node = instantiate(this.climberPrefab);
        this.climber = node.getComponent(ClimberView)!;
        node.parent = this.world;
        node.active = true;
        this.climber.init(this.ent);
        this.effects = this.createNode('Effects').addComponent(Graphics);
    }

    private rebuildHolds() {
        this.recycleHolds();
        this.holdSource = this.ent.model.holds;
        this.holdSource.forEach((hold) => {
            if (hold.broken) {
                return;
            }
            const pool = this.holdPools.get(hold.type)!;
            const node = pool.get() || instantiate(this.holdPrefabs.get(hold.type)!);
            const sprite = node.getComponent(Sprite)!;
            node.name = hold.id;
            node.parent = this.holdRoot;
            node.setPosition(hold.x, -hold.y);
            node.setScale(hold.scale, hold.scale, 1);
            node.angle = 0;
            node.active = true;
            sprite.color = Color.WHITE;
            this.holds.set(hold.id, { node, sprite, pool });
        });
    }

    private recycleHolds() {
        this.holds.forEach((display) => {
            display.node.active = false;
            display.pool.put(display.node);
        });
        this.holds.clear();
    }

    private buildWall() {
        const wall = this.getNode('wall')!;
        const finish = this.getNode('wall_finish_top')!;
        const middle = this.getNode('WallMiddle')!;
        const loop = this.getNode('wall_middle_loop')!;
        const bottom = this.getNode('wall_start_bottom')!;
        const loopTransform = loop.getComponent(UITransform)!;
        const finishTransform = finish.getComponent(UITransform)!;
        const bottomTransform = bottom.getComponent(UITransform)!;
        const loopSprite = loop.getComponent(Sprite)!;
        const finishSprite = finish.getComponent(Sprite)!;
        const bottomSprite = bottom.getComponent(Sprite)!;
        const wallWidth = loopSprite.spriteFrame?.originalSize.width || loopTransform.width;
        const scale = TableClimbRoute.width / wallWidth;
        const height = TableClimbRoute.height / scale;
        const finishHeight = finishSprite.spriteFrame?.originalSize.height || finishTransform.height;
        const bottomHeight = bottomSprite.spriteFrame?.originalSize.height || bottomTransform.height;
        const loopHeight = loopSprite.spriteFrame?.originalSize.height || loopTransform.height;
        const middleHeight = Math.max(0, height - finishHeight - bottomHeight);
        const count = Math.ceil(middleHeight / loopHeight);
        wall.parent = this.world;
        wall.setSiblingIndex(0);
        wall.setScale(scale, scale, 1);
        wall.setPosition(TableClimbRoute.width / 2, 0);
        wall.getComponent(UITransform)!.setContentSize(wallWidth, height);
        finishTransform.setAnchorPoint(0.5, 1);
        finishTransform.setContentSize(wallWidth, finishHeight);
        bottomTransform.setAnchorPoint(0.5, 0);
        bottomTransform.setContentSize(wallWidth, bottomHeight);
        loopTransform.setAnchorPoint(0.5, 1);
        loopTransform.setContentSize(wallWidth, loopHeight);
        for (const sprite of [finishSprite, bottomSprite, loopSprite]) {
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
            sprite.node.setScale(1, 1, 1);
        }
        finish.setPosition(0, 0);
        bottom.setPosition(0, -height);
        middle.setPosition(0, -finishHeight);
        middle.setScale(1, 1, 1);
        middle.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
        middle.getComponent(UITransform)!.setContentSize(wallWidth, middleHeight);
        middle.active = middleHeight > 0;
        if (!middle.getComponent(Mask)) {
            middle.addComponent(Mask);
        }
        loop.setPosition(0, 0);
        loop.active = count > 0;
        while (this.wallLoops.length < Math.max(0, count - 1)) {
            const node = instantiate(loop);
            node.parent = middle;
            this.wallLoops.push(node);
        }
        this.wallLoops.forEach((node, index) => {
            node.active = index < count - 1;
            node.setPosition(0, -(index + 1) * loopHeight);
        });
    }

    private createNode(name: string, width = 760, height = 760) {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform).setContentSize(width, height);
        node.parent = this.world;
        return node;
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
        const menu = smc.mainMenu.MainMenuView;
        this.ent.openLevelSelect(menu.levelSelectPrefab, this.node.parent!);
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
        const point = this.world.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(location.x, location.y));
        return {
            x: point.x,
            y: -point.y
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
        this.world.setScale(scale, scale, 1);
        this.world.setPosition(-TableClimbRoute.width / 2 * scale, (TableClimbRoute.viewHeight / 2 + this.ent.model.camera) * scale);
        this.renderHolds();
        this.climber.render();
        this.renderHud();
        this.renderEffects(dt);
    }

    private renderHolds() {
        const model = this.ent.model;
        if (this.holdSource !== model.holds) {
            this.buildWall();
            this.rebuildHolds();
            this.particles = [];
            this.broken.clear();
            this.previousMoves = 0;
            this.previousTime = 0;
            this.previousState = model.state;
        }
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
            if (hold.broken) {
                const display = this.holds.get(hold.id);
                if (display) {
                    display.node.active = false;
                    display.pool.put(display.node);
                    this.holds.delete(hold.id);
                }
                return;
            }
            const display = this.holds.get(hold.id)!;
            display.node.active = true;
            const reachable = !!model.selected && this.ent.bll.canReach(model.selected, hold);
            const occupied = !!this.ent.bll.holderOf(hold.id);
            display.sprite.color = model.selected && !reachable ? new Color(183, 183, 183) : Color.WHITE;
            const finish = TableClimbRoute.isFinish(hold.type);
            if (reachable || occupied || finish) {
                graphics.strokeColor = reachable ? this.lime : finish ? new Color(255, 224, 120, 160) : new Color(255, 212, 158, 110);
                graphics.lineWidth = reachable ? 3 : 2;
                graphics.circle(hold.x, -hold.y, reachable ? 41 : 35);
                graphics.stroke();
            }
            if (hold.type === HoldTypeKindEnum.Danger && !hold.broken) {
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
        this.timerText.string = `LV${TableClimbRoute.getLevel()?.level || 1} ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
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
            model.holds.filter((hold) => {
                return TableClimbRoute.isFinish(hold.type);
            }).forEach((hold) => {
                this.burst(hold, hold.type === HoldTypeKindEnum.FinishLeft ? new Color(255, 233, 125) : this.lime, 45);
            });
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

    protected onDestroy() {
        this.holdPools.forEach((pool) => {
            pool.clear();
        });
        super.onDestroy();
    }

    reset() {
        this.ready = false;
        this.particles = [];
        this.recycleHolds();
        this.holdPools.forEach((pool) => {
            pool.clear();
        });
        this.holdPools.clear();
        this.holdPrefabs.clear();
        this.holdSource = [];
        this.wallLoops = [];
        this.broken.clear();
    }
}

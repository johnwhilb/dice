import { GameEditorRoute } from './GameEditorRoute';
import { _decorator, Color, EventKeyboard, EventTouch, EditBox, Graphics, input, Input, instantiate, KeyCode, Label, Layers, Mask, Node, NodePool, Prefab, Sprite, UITransform, Vec3, view } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { smc } from '../common/SingletonModuleComp';
import { HoldTypeKindEnum } from '../common/table/HoldTypeKindEnum';
import type { GameEditor } from './GameEditor';
import { GameEditorClimberView } from './GameEditorClimberView';
import { ClimbHold, ClimbPoint, ClimbState } from './TableClimbRoute';

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

@ccclass('GameEditorView')
@ecs.register('GameEditorView', false)
@gui.register('GameEditorView', { layer: LayerType.UI, prefab: 'gui/gameView/GameEditorView' })
export class GameEditorView extends CCView<GameEditor> {
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
    private climber!: GameEditorClimberView;
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
    private pointInput!: EditBox;
    private xInput!: EditBox;
    private yInput!: EditBox;
    private editorStatus!: Label;
    private pointInfo!: Label;
    private modeText!: Label;
    private cheatText!: Label;
    private editorRevision = -1;
    private editorTouchId: number | null = null;
    private pointDragging = false;
    private lastTouchY = 0;
    private dragOffset: ClimbPoint = { x: 0, y: 0 };

    private setupEditor() {
        this.pointInput = this.setupInput('PointInput', 'PointInputText');
        this.xInput = this.setupInput('XInput', 'XInputText');
        this.yInput = this.setupInput('YInput', 'YInputText');
        this.editorStatus = this.getNode('EditorStatus')!.getComponent(Label)!;
        this.pointInfo = this.getNode('PointInfo')!.getComponent(Label)!;
        this.modeText = this.getNode('ModeText')!.getComponent(Label)!;
        this.cheatText = this.getNode('CheatText')!.getComponent(Label)!;
        const actions: { name: string; callback: (event: EventTouch) => void }[] = [
            { name: 'btnEditorMode', callback: this.btnEditorMode },
            { name: 'btnEditorCheat', callback: this.btnEditorCheat },
            { name: 'btnAddPoint', callback: this.btnAddPoint },
            { name: 'btnDeletePoint', callback: this.btnDeletePoint },
            { name: 'btnApplyPoint', callback: this.btnApplyPoint },
            { name: 'btnFindPoint', callback: this.btnFindPoint },
            { name: 'btnTypeNormal', callback: this.btnTypeNormal },
            { name: 'btnTypeDanger', callback: this.btnTypeDanger },
            { name: 'btnTypeLeft', callback: this.btnTypeLeft },
            { name: 'btnTypeRight', callback: this.btnTypeRight },
            { name: 'btnSaveExcel', callback: this.btnSaveExcel },
            { name: 'btnDiscardEditor', callback: this.btnDiscardEditor }
        ];
        actions.forEach((action) => {
            const node = this.getNode(action.name)!;
            const size = node.getComponent(UITransform)!;
            const graphics = node.addComponent(Graphics);
            graphics.fillColor = action.name === 'btnSaveExcel' ? new Color(200, 251, 116) : new Color(29, 48, 61);
            graphics.roundRect(-size.width / 2, -size.height / 2, size.width, size.height, 10);
            graphics.fill();
            node.on(Node.EventType.TOUCH_END, action.callback, this);
        });
        const panel = this.getNode('EditorPanel')!.addComponent(Graphics);
        panel.fillColor = new Color(17, 31, 43);
        panel.roundRect(-360, -205, 720, 410, 16);
        panel.fill();
    }

    private setupInput(nodeName: string, textName: string) {
        const node = this.getNode(nodeName)!;
        const label = this.getNode(textName)!.getComponent(Label)!;
        const inputBox = node.addComponent(EditBox);
        inputBox.textLabel = label;
        inputBox.inputMode = EditBox.InputMode.SINGLE_LINE;
        inputBox.maxLength = 32;
        const size = node.getComponent(UITransform)!;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.node.getComponent(UITransform)!.setAnchorPoint(0, 1);
        label.node.getComponent(UITransform)!.setContentSize(size.width - 8, size.height);
        label.node.setPosition(-size.width / 2 + 4, size.height / 2);
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = new Color(6, 20, 29);
        graphics.strokeColor = new Color(66, 86, 99);
        graphics.roundRect(-size.width / 2, -size.height / 2, size.width, size.height, 8);
        graphics.fill();
        graphics.stroke();
        return inputBox;
    }

    private renderEditor() {
        const model = this.ent.model;
        this.editorStatus.string = model.status;
        this.modeText.string = model.editing ? '编辑中 · 点击试爬' : '试爬中 · 返回编辑';
        this.cheatText.string = model.infiniteStamina ? '无限体力：开' : '无限体力：关';
        this.getNode('EditorTitle')!.getComponent(Label)!.string = `编辑第 ${GameEditorRoute.getLevel()?.level || 1} 关${model.dirty ? ' · 未保存' : ''}`;
        if (this.editorRevision === model.revision) {
            return;
        }
        this.editorRevision = model.revision;
        const point = model.points.find((item) => {
            return item.id === model.selectedPoint;
        });
        this.pointInput.string = point?.point || '';
        this.xInput.string = point ? String(point.x) : '';
        this.yInput.string = point ? String(point.y) : '';
        this.pointInfo.string = point ? `ID ${point.id} · ${point.point} · ${this.ent.bll.isStartPoint(point.id) ? '初始支撑' : '岩点'} · ${point.typeId === HoldTypeKindEnum.Normal ? '普通' : point.typeId === HoldTypeKindEnum.Danger ? '危险' : point.typeId === HoldTypeKindEnum.FinishLeft ? '终点左' : '终点右'}` : `${model.points.length} 个岩点 · 请点击岩点，或输入名称查询`;
    }

    private editorTouchStart(event: EventTouch) {
        const model = this.ent.model;
        if (!model.editing) {
            this.ent.bll.pointerDown(this.touchPoint(event), event.getID() ?? 0);
            return;
        }
        if (model.saving || this.editorTouchId !== null) {
            return;
        }
        this.editorTouchId = event.getID() ?? 0;
        const position = this.touchPoint(event);
        this.pointDragging = this.ent.bll.selectPoint(position);
        const point = model.points.find((item) => {
            return item.id === model.selectedPoint;
        });
        this.dragOffset = { x: (point?.x || 0) - position.x, y: (point?.y || 0) - position.y };
        this.lastTouchY = event.getUILocation().y;
    }

    private editorTouchMove(event: EventTouch) {
        if (!this.ent.model.editing) {
            this.ent.bll.pointerMove(this.touchPoint(event), event.getID() ?? 0);
            return;
        }
        if (this.editorTouchId !== (event.getID() ?? 0)) {
            return;
        }
        if (this.pointDragging) {
            const position = this.touchPoint(event);
            this.ent.bll.movePoint({ x: position.x + this.dragOffset.x, y: position.y + this.dragOffset.y });
        }
        else {
            const y = event.getUILocation().y;
            this.ent.bll.panCamera((y - this.lastTouchY) / this.world.worldScale.y);
            this.lastTouchY = y;
        }
    }

    private editorTouchEnd(event: EventTouch, canceled = false) {
        if (!this.ent.model.editing) {
            this.ent.bll.pointerUp(event.getID() ?? 0, canceled);
        }
        if (this.editorTouchId === (event.getID() ?? 0)) {
            this.editorTouchId = null;
            this.pointDragging = false;
        }
    }

    btnEditorMode(event: EventTouch) {
        event.propagationStopped = true;
        this.editorTouchId = null;
        this.ent.bll.toggleMode();
    }

    btnEditorCheat(event: EventTouch) {
        event.propagationStopped = true;
        this.ent.model.infiniteStamina = !this.ent.model.infiniteStamina;
    }

    btnAddPoint(event: EventTouch) {
        event.propagationStopped = true;
        this.ent.bll.addPoint();
    }

    btnDeletePoint(event: EventTouch) {
        event.propagationStopped = true;
        this.ent.bll.deletePoint();
    }

    btnApplyPoint(event: EventTouch) {
        event.propagationStopped = true;
        const point = this.ent.model.points.find((item) => {
            return item.id === this.ent.model.selectedPoint;
        });
        if (point) {
            this.ent.bll.changePoint(this.pointInput.string, this.xInput.string.trim() ? Number(this.xInput.string) : NaN, this.yInput.string.trim() ? Number(this.yInput.string) : NaN, point.typeId);
        }
    }

    btnFindPoint(event: EventTouch) {
        event.propagationStopped = true;
        this.ent.bll.findPoint(this.pointInput.string);
    }

    private changeType(event: EventTouch, type: HoldTypeKindEnum) {
        event.propagationStopped = true;
        const point = this.ent.model.points.find((item) => {
            return item.id === this.ent.model.selectedPoint;
        });
        if (point) {
            this.ent.bll.changePoint(point.point, point.x, point.y, type);
        }
    }

    btnTypeNormal(event: EventTouch) {
        this.changeType(event, HoldTypeKindEnum.Normal);
    }

    btnTypeDanger(event: EventTouch) {
        this.changeType(event, HoldTypeKindEnum.Danger);
    }

    btnTypeLeft(event: EventTouch) {
        this.changeType(event, HoldTypeKindEnum.FinishLeft);
    }

    btnTypeRight(event: EventTouch) {
        this.changeType(event, HoldTypeKindEnum.FinishRight);
    }

    btnSaveExcel(event: EventTouch) {
        event.propagationStopped = true;
        this.ent.bll.saveExcel();
    }

    btnDiscardEditor(event: EventTouch) {
        event.propagationStopped = true;
        if (this.ent.close(true)) {
            const menu = smc.mainMenu.MainMenuView;
            smc.climb.openLevelSelect(menu.levelSelectPrefab, this.node.parent!);
        }
    }

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
            oops.gui.toast('GameEditorView 缺少人物或岩点预制体，请检查静态绑定');
            return;
        }
        this.buildWorld();
        this.ready = true;
        this.setupEditor();
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
        this.editorTouchId = null;
        this.pointDragging = false;
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
        const scale = Math.min(720 / GameEditorRoute.width, this.stage.getComponent(UITransform)!.height / GameEditorRoute.viewHeight);
        this.world.setScale(scale, scale, 1);
        this.world.setPosition(-GameEditorRoute.width / 2 * scale, (GameEditorRoute.viewHeight / 2 + this.ent.model.camera) * scale);
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
        this.climber = node.getComponent(GameEditorClimberView)!;
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
        const scale = GameEditorRoute.width / wallWidth;
        const height = GameEditorRoute.height / scale;
        const finishHeight = finishSprite.spriteFrame?.originalSize.height || finishTransform.height;
        const bottomHeight = bottomSprite.spriteFrame?.originalSize.height || bottomTransform.height;
        const loopHeight = loopSprite.spriteFrame?.originalSize.height || loopTransform.height;
        const middleHeight = Math.max(0, height - finishHeight - bottomHeight);
        const count = Math.ceil(middleHeight / loopHeight);
        wall.parent = this.world;
        wall.setSiblingIndex(0);
        wall.setScale(scale, scale, 1);
        wall.setPosition(GameEditorRoute.width / 2, 0);
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
        if (!this.ent.close()) {
            return;
        }
        const menu = smc.mainMenu.MainMenuView;
        smc.climb.openLevelSelect(menu.levelSelectPrefab, this.node.parent!);
    }

    btnRestart(event: EventTouch) {
        event.propagationStopped = true;
        this.ent.bll.restart();
        this.ent.model.paused = this.ent.model.editing;
        this.ent.model.status = this.ent.model.editing ? '已重置显示，编辑草稿保留' : '已重新开始试爬';
    }

    private onTouchStart(event: EventTouch) {
        if (this.ready) {
            this.editorTouchStart(event);
        }
        event.propagationStopped = true;
    }

    private onTouchMove(event: EventTouch) {
        if (this.ready) {
            this.editorTouchMove(event);
        }
        event.propagationStopped = true;
    }

    private onTouchEnd(event: EventTouch) {
        this.editorTouchEnd(event);
        event.propagationStopped = true;
    }

    private onTouchCancel(event: EventTouch) {
        this.editorTouchEnd(event, true);
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
        if (!this.ready || this.ent.model.editing) {
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
        const scale = 720 / GameEditorRoute.width;
        this.world.setScale(scale, scale, 1);
        this.world.setPosition(-GameEditorRoute.width / 2 * scale, (GameEditorRoute.viewHeight / 2 + this.ent.model.camera) * scale);
        this.renderHolds();
        this.climber.render();
        this.renderHud();
        this.renderEditor();
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
            display.node.setPosition(hold.x, -hold.y);
            const editorPoint = model.points.find((point) => {
                return point.id === model.selectedPoint;
            });
            if (model.editing && editorPoint?.point === hold.id) {
                graphics.strokeColor = this.lime;
                graphics.lineWidth = 4;
                graphics.circle(hold.x, -hold.y, 46);
                graphics.stroke();
            }
            const reachable = !!model.selected && this.ent.bll.canReach(model.selected, hold);
            const occupied = !!this.ent.bll.holderOf(hold.id);
            display.sprite.color = model.selected && !reachable ? new Color(183, 183, 183) : Color.WHITE;
            const finish = GameEditorRoute.isFinish(hold.type);
            if (reachable || occupied || finish) {
                graphics.strokeColor = reachable ? this.lime : finish ? new Color(255, 224, 120, 160) : new Color(255, 212, 158, 110);
                graphics.lineWidth = reachable ? 3 : 2;
                graphics.circle(hold.x, -hold.y, reachable ? 41 : 35);
                graphics.stroke();
            }
            if (hold.type === HoldTypeKindEnum.Danger && !hold.broken) {
                graphics.strokeColor = new Color(255, 173, 131);
                graphics.lineWidth = 4;
                graphics.arc(hold.x, -hold.y, 44, Math.PI / 2, Math.PI / 2 - Math.PI * 2 * Math.max(0, hold.durability / GameEditorRoute.get().brittle), false);
                graphics.stroke();
            }
        });
    }

    private renderHud() {
        const model = this.ent.model;
        const seconds = Math.floor(model.elapsed);
        this.timerText.string = `LV${GameEditorRoute.getLevel()?.level || 1} ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
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
                return GameEditorRoute.isFinish(hold.type);
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

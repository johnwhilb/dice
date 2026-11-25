import { _decorator, Component, EventTouch, Game, Node, Tween, UIOpacity, UITransform, Vec3, game, tween } from "cc";
import type { BattleBll } from "../bll/BattleBll";

const { ccclass, property } = _decorator;
const edgePadding = 8;
const enterDeadZone = 12;
const exitDeadZone = 8;

@ccclass("BattleJoystick")
export class BattleJoystick extends Component {
    @property(Node)
    private indicator: Node;

    @property(Node)
    private thumb: Node;

    private business: BattleBll;
    private surface: UITransform;
    private opacity: UIOpacity;
    private radius: number;
    private travel: number;
    private touchId: number = -1;
    private steering: boolean = false;
    private readonly touchPoint = new Vec3();
    private readonly origin = new Vec3();

    onLoad() {
        this.surface = this.node.getComponent(UITransform);
        this.opacity = this.indicator.getComponent(UIOpacity);
        this.radius = this.indicator.getComponent(UITransform).width / 2;
        this.travel = this.radius - this.thumb.getComponent(UITransform).width / 2 - edgePadding;
        this.node.on(Node.EventType.TOUCH_START, this.startTouch, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.moveTouch, this);
        this.node.on(Node.EventType.TOUCH_END, this.endTouch, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.endTouch, this);
    }

    bindBusiness(business: BattleBll) {
        this.business = business;
    }

    onEnable() {
        this.resetTouch();
        game.on(Game.EVENT_HIDE, this.resetTouch, this);
    }

    onDisable() {
        game.off(Game.EVENT_HIDE, this.resetTouch, this);
        this.touchId = -1;
        this.steering = false;
    }

    private resetTouch() {
        this.touchId = -1;
        this.steering = false;
        Tween.stopAllByTarget(this.thumb);
        Tween.stopAllByTarget(this.opacity);
        this.thumb.setPosition(Vec3.ZERO);
        this.indicator.active = false;
    }

    private updateTouchPoint(event: EventTouch) {
        const point = event.getUILocation();
        this.touchPoint.set(point.x, point.y, 0);
        this.surface.convertToNodeSpaceAR(this.touchPoint, this.touchPoint);
    }

    private startTouch(event: EventTouch) {
        if (this.touchId >= 0 || !this.business.canSteer()) {
            return;
        }
        this.touchId = event.getID();
        this.steering = false;
        this.updateTouchPoint(event);
        this.origin.set(this.touchPoint);
        const margin = this.radius + edgePadding;
        const limitX = Math.max(0, this.surface.width / 2 - margin);
        const limitY = Math.max(0, this.surface.height / 2 - margin);

        Tween.stopAllByTarget(this.opacity);
        Tween.stopAllByTarget(this.thumb);
        this.indicator.setPosition(
            Math.max(-limitX, Math.min(limitX, this.origin.x)),
            Math.max(-limitY, Math.min(limitY, this.origin.y)),
            0
        );
        this.thumb.setPosition(Vec3.ZERO);
        this.opacity.opacity = 255;
        this.indicator.active = true;
        event.propagationStopped = true;
    }

    private moveTouch(event: EventTouch) {
        if (event.getID() !== this.touchId || !this.business.canSteer()) {
            return;
        }
        this.updateTouchPoint(event);
        const x = this.touchPoint.x - this.origin.x;
        const y = this.touchPoint.y - this.origin.y;
        const distance = Math.hypot(x, y);
        const scale = distance > this.travel ? this.travel / distance : 1;
        this.thumb.setPosition(x * scale, y * scale, 0);
        this.steering = distance >= (this.steering ? exitDeadZone : enterDeadZone);
        if (this.steering) {
            this.business.steerDirection(x, y);
        }
        event.propagationStopped = true;
    }

    private endTouch(event: EventTouch) {
        if (event.getID() !== this.touchId) {
            return;
        }
        this.touchId = -1;
        this.steering = false;
        tween(this.thumb).to(0.13, { position: Vec3.ZERO }, { easing: "quadOut" }).start();
        tween(this.opacity)
            .to(0.16, { opacity: 0 }, { easing: "quadOut" })
            .call(() => {
                this.indicator.active = false;
            })
            .start();
        event.propagationStopped = true;
    }
}

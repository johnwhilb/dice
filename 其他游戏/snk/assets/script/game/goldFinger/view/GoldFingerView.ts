import { _decorator, EditBox, EventTouch, Label, Node, UITransform, Vec3 } from "cc";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCView } from "db://oops-framework/module/common/CCView";
import { ShopEvent } from "../../shop/ShopEvent";
import type { GoldFinger } from "../GoldFinger";
import { GoldFingerBll } from "../bll/GoldFingerBll";
import { GoldFingerEvent } from "../GoldFingerEvent";

const { ccclass } = _decorator;

@ccclass("GoldFingerView")
@ecs.register("GoldFingerView", false)
export class GoldFingerView extends CCView<GoldFinger> {
    private touchId: number = -1;
    private dragged: boolean = false;
    private startPoint: Vec3 = new Vec3();
    private startPosition: Vec3 = new Vec3();

    private get business() {
        return this.ent.getBusiness<GoldFingerBll>(GoldFingerBll);
    }

    // 悬浮层只自动绑定子按钮，避免全屏根节点监听触摸后阻挡底层界面。
    protected setButton() {
        super.setButton(false);
    }

    start() {
        this.on(GoldFingerEvent.UpdatePanel, this.refresh, this);
        this.on(ShopEvent.UpdateShopContent, this.refresh, this);
        const button = this.getNode("btnGoldFinger");
        button.on(Node.EventType.TOUCH_START, this.startDrag, this);
        button.on(Node.EventType.TOUCH_MOVE, this.moveDrag, this);
        button.on(Node.EventType.TOUCH_END, this.endDrag, this);
        button.on(Node.EventType.TOUCH_CANCEL, this.cancelDrag, this);
        this.refresh();
    }

    private refresh() {
        const model = this.ent.GoldFingerModel;
        const shop = this.ent.game.shop.ShopModel;
        this.node.active = model.visible;
        this.getNode("panelRoot").active = model.panelOpen;
        this.getNode("lbtStatus").getComponent(Label).string = `金币 ${shop.gold}    队伍 ${shop.team.length} 人    第 ${shop.battleLevel} 关`;
        this.getNode("lbtMessage").getComponent(Label).string = model.message;
    }

    private startDrag(event: EventTouch) {
        if (this.touchId >= 0) {
            return;
        }
        this.touchId = event.getID();
        this.dragged = false;
        const point = event.getUILocation();
        this.startPoint = this.node.getComponent(UITransform).convertToNodeSpaceAR(new Vec3(point.x, point.y, 0));
        this.startPosition.set(this.getNode("btnGoldFinger").position);
        event.propagationStopped = true;
    }

    private moveDrag(event: EventTouch) {
        if (event.getID() !== this.touchId) {
            return;
        }
        const transform = this.node.getComponent(UITransform);
        const point = event.getUILocation();
        const local = transform.convertToNodeSpaceAR(new Vec3(point.x, point.y, 0));
        const offsetX = local.x - this.startPoint.x;
        const offsetY = local.y - this.startPoint.y;
        this.dragged = this.dragged || Math.hypot(offsetX, offsetY) >= 8;
        if (this.dragged) {
            const button = this.getNode("btnGoldFinger");
            const size = button.getComponent(UITransform);
            const limitX = (transform.width - size.width) / 2;
            const limitY = (transform.height - size.height) / 2;
            button.setPosition(
                Math.max(-limitX, Math.min(limitX, this.startPosition.x + offsetX)),
                Math.max(-limitY, Math.min(limitY, this.startPosition.y + offsetY)),
                0
            );
        }
        event.propagationStopped = true;
    }

    private endDrag(event: EventTouch) {
        if (event.getID() === this.touchId) {
            this.touchId = -1;
        }
    }

    private cancelDrag(event: EventTouch) {
        if (event.getID() === this.touchId) {
            this.touchId = -1;
            this.dragged = true;
        }
    }

    reset() {
        this.touchId = -1;
        this.dragged = false;
    }

    btnGoldFinger() {
        if (this.dragged) {
            return;
        }
        this.business.setPanelOpen(true);
    }

    btnCloseGoldFinger() {
        this.business.setPanelOpen(false);
    }

    btnAddGold() {
        this.business.addGold(this.getNode("goldInput").getComponent(EditBox).string);
    }

    btnAddRole() {
        this.business.addRole(this.getNode("roleInput").getComponent(EditBox).string);
    }

    btnJumpLevel() {
        this.business.jumpLevel(this.getNode("levelInput").getComponent(EditBox).string);
    }
}

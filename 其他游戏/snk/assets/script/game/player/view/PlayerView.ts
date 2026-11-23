import { _decorator, Color, Node, Sprite, UITransform } from "cc";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import { ColorConst } from "../../common/config/ColorConst";
import type { IPlayerData } from "../model/PlayerModel";
import type { IPlayerPose } from "../PlayerEvent";

const { ccclass } = _decorator;

@ccclass("PlayerView")
export class PlayerView extends GameComponent {
    private body: Node;
    private shadow: Node;
    private bodyColor: Color;

    setData(player: IPlayerData) {
        this.body = this.getNode("body");
        this.shadow = this.getNode("shadow");
        this.bodyColor = ColorConst.getPlayerColor(player.roleId);
        this.body.getComponent(Sprite).color = this.bodyColor;
        this.shadow.getComponent(Sprite).color = this.bodyColor;
        const size = player.config.bodySize;
        this.node.getComponent(UITransform).setContentSize(size, size);
        this.body.getComponent(UITransform).setContentSize(size, size);
        this.shadow.getComponent(UITransform).setContentSize(size, size);
        this.setPose(player.pose);
    }

    setPose(pose: IPlayerPose) {
        this.node.setPosition(pose.x, pose.y, 0);
        this.body.angle = pose.angle;
        this.shadow.angle = pose.angle;
    }

    setFeedback(recoil: number, hurt: number) {
        const progress = hurt || recoil;
        const pulse = Math.cos((1 - progress) * Math.PI * 2) * progress ** 2;
        const scale = 1 + (hurt > 0 ? 0.25 : 0.19) * pulse;
        this.body.setScale(scale, scale, 1);
        this.body.getComponent(Sprite).color = hurt > 0.55 ? ColorConst.WHITE : this.bodyColor;
    }
}

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

    setFeedback(recoil: number, hurt: number, lowHpPulse: number = 0, ghost: boolean = false) {
        let scaleX = 1;
        let scaleY = 1;
        if (hurt > 0) {
            const wave = Math.cos((1 - hurt) * Math.PI * 2.5) * hurt * hurt;
            scaleX = 1 + 0.34 * wave;
            scaleY = 1 - 0.22 * wave;
        } else if (recoil > 0) {
            const wave = Math.cos((1 - recoil) * Math.PI * 2) * recoil * recoil;
            scaleX = 1 - 0.16 * wave;
            scaleY = 1 + 0.24 * wave;
        } else if (lowHpPulse > 0) {
            const pulse = 1 + 0.06 * lowHpPulse;
            scaleX = pulse;
            scaleY = pulse;
        }
        this.body.setScale(scaleX, scaleY, 1);
        this.shadow.setScale(scaleX, scaleY, 1);
        const sprite = this.body.getComponent(Sprite);
        if (hurt > 0.45) {
            sprite.color = ColorConst.WHITE;
        } else if (ghost) {
            const translucent = this.bodyColor.clone().lerp(ColorConst.WHITE, 0.35);
            translucent.a = 155;
            sprite.color = translucent;
        } else if (lowHpPulse > 0.5) {
            sprite.color = this.bodyColor.clone().lerp(ColorConst.battleDangerRed, (lowHpPulse - 0.5) * 0.7);
        } else {
            sprite.color = this.bodyColor;
        }
    }
}

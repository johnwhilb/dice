import { _decorator, Node, Sprite, UITransform } from "cc";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import { ColorConst } from "../../common/config/ColorConst";
import type { IPlayerData } from "../model/PlayerModel";
import type { IPlayerPose } from "../PlayerEvent";

const { ccclass } = _decorator;

@ccclass("PlayerView")
export class PlayerView extends GameComponent {
    private body: Node;
    private shadow: Node;

    setData(player: IPlayerData) {
        this.nodeTreeInfoLite();
        this.body = this.getNode("body");
        this.shadow = this.getNode("shadow");
        const color = ColorConst.getPlayerColor(player.roleId);
        this.body.getComponent(Sprite).color = color;
        this.shadow.getComponent(Sprite).color = color;
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
}

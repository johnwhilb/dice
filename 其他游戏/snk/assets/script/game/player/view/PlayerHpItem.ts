import { _decorator, Sprite } from "cc";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import { ColorConst } from "../../common/config/ColorConst";
import type { IPlayerData } from "../model/PlayerModel";

const { ccclass } = _decorator;

@ccclass("PlayerHpItem")
export class PlayerHpItem extends GameComponent {
    // 血条仅用于展示，关闭根节点触摸监听，避免阻挡战场触摸。
    protected setButton() {
        super.setButton(false);
    }

    setData(player: IPlayerData) {
        this.nodeTreeInfoLite();
        const color = ColorConst.getPlayerColor(player.roleId);
        this.getNode("hpFrame").getComponent(Sprite).color = player.hp > 0 ? color : ColorConst.shopMuted;
        const fill = this.getNode("hpFill");
        fill.active = player.hp > 0;
        const sprite = fill.getComponent(Sprite);
        sprite.color = color;
        sprite.fillRange = player.hp / player.stats.hp;
    }
}

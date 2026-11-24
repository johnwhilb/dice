import { _decorator, Color, Sprite } from "cc";
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

    private roleColor: Color = ColorConst.WHITE;
    private currentRatio: number = 1;
    private trailRatio: number = 1;
    private hurtFlash: number = 0;
    private pulseElapsed: number = 0;
    private alive: boolean = true;
    private initialized: boolean = false;

    setData(player: IPlayerData) {
        const color = ColorConst.getPlayerColor(player.roleId);
        const nextRatio = player.stats.hp > 0 ? Math.max(0, Math.min(1, player.hp / player.stats.hp)) : 0;
        const damaged = this.initialized && nextRatio < this.currentRatio - 0.001;
        this.roleColor = color;
        this.alive = player.hp > 0;
        if (!this.initialized) {
            this.trailRatio = nextRatio;
            this.initialized = true;
        } else if (nextRatio > this.trailRatio) {
            this.trailRatio = nextRatio;
        }
        this.currentRatio = nextRatio;
        if (damaged) {
            this.hurtFlash = 0.22;
        }
        this.applyVisuals();
    }

    update(deltaTime: number) {
        let dirty = false;
        if (this.trailRatio > this.currentRatio) {
            const speed = Math.max(0.55, (this.trailRatio - this.currentRatio) * 3.2);
            this.trailRatio = Math.max(this.currentRatio, this.trailRatio - speed * deltaTime);
            dirty = true;
        }
        if (this.hurtFlash > 0) {
            this.hurtFlash = Math.max(0, this.hurtFlash - deltaTime);
            dirty = true;
        }
        if (this.alive && this.currentRatio > 0 && this.currentRatio <= 0.3) {
            this.pulseElapsed += deltaTime;
            dirty = true;
        } else if (this.pulseElapsed > 0) {
            this.pulseElapsed = 0;
            dirty = true;
        }
        if (dirty) {
            this.applyVisuals();
        }
    }

    private applyVisuals() {
        const frame = this.getNode("hpFrame").getComponent(Sprite);
        const trail = this.getNode("hpTrail");
        const fill = this.getNode("hpFill");
        const trailSprite = trail.getComponent(Sprite);
        const fillSprite = fill.getComponent(Sprite);

        const bounce = this.hurtFlash > 0 ? 1 + 0.16 * Math.sin((this.hurtFlash / 0.22) * Math.PI) : 1;
        this.node.setScale(bounce, bounce, 1);

        const lowHp = this.alive && this.currentRatio > 0 && this.currentRatio <= 0.3;
        if (!this.alive) {
            frame.color = ColorConst.shopMuted;
        } else if (this.hurtFlash > 0.11) {
            frame.color = ColorConst.WHITE;
        } else if (lowHp) {
            const blink = 0.5 + 0.5 * Math.sin(this.pulseElapsed * 14);
            frame.color = this.roleColor.clone().lerp(ColorConst.battleDangerRed, blink);
        } else {
            frame.color = this.roleColor;
        }

        trail.active = this.trailRatio > 0.001;
        if (trail.active) {
            trailSprite.color = ColorConst.battleHpTrail;
            trailSprite.fillRange = this.trailRatio;
        }

        fill.active = this.alive;
        if (fill.active) {
            fillSprite.color = this.hurtFlash > 0.11 ? ColorConst.WHITE : this.roleColor;
            fillSprite.fillRange = this.currentRatio;
        }
    }
}

import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import type { Player } from "../Player";
import { PlayerBattleBll } from "./PlayerBattleBll";
import { TableBattleRule } from "../../common/table/TableBattleRule";
import { PlayerEvent } from "../PlayerEvent";
import { EffectBll } from "../../effect/bll/EffectBll";
import { ArenaWallSide } from "../../effect/EffectEvent";

export class PlayerMoveBll extends CCBusiness<Player> {
    /** 根据当前阵容重新计算跟随间距、转向速度、角色半径与平均移速。 */
    refreshMovementStats() {
        const model = this.ent.PlayerModel;
        const players = model.players.filter((player) => {
            return player.hp > 0;
        });
        if (!players.length) {
            model.speed = 0;
            return;
        }
        model.spacing = players[0].config.followSpacing;
        model.turnSpeed = players[0].config.turnSpeed;
        model.radius = Math.max(...players.map((player) => {
            return player.config.bodySize * Math.SQRT2 / 2;
        }));
        model.speed = Math.floor(players.reduce((total, player) => {
            return total + this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll).stats(model.players.indexOf(player)).moveSpeed;
        }, 0) / players.length) * players[0].config.movementScale;
    }

    /** 根据战场局部触摸坐标 x、y 更新队首目标方向。 */
    steer(x: number, y: number) {
        const model = this.ent.PlayerModel;
        const head = model.players.find((player) => {
            return player.hp > 0;
        });
        if (!head) {
            return;
        }
        if (x !== head.pose.x || y !== head.pose.y) {
            model.targetHeading = Math.atan2(y - head.pose.y, x - head.pose.x);
        }
    }

    /** 推进 deltaTime 秒移动，width、height 为战场尺寸；分步积分保持低帧率下的跟随轨迹。 */
    updateMovement(deltaTime: number, width: number, height: number) {
        const model = this.ent.PlayerModel;
        if (!model.speed || deltaTime <= 0) {
            return;
        }
        this.refreshMovementStats();
        let remaining = deltaTime;
        while (remaining > 0) {
            const delta = Math.min(remaining, TableBattleRule.getCurrent().simulationStep);
            this.moveHead(delta, width, height);
            this.followHistory();
            remaining -= delta;
        }
        this.dispatchEvent(PlayerEvent.UpdatePose);
    }

    /** 按 delta 秒转向并移动队首，使用 width、height 进行边界反弹。 */
    private moveHead(delta: number, width: number, height: number) {
        const model = this.ent.PlayerModel;
        const headUnit = model.players.find((player) => {
            return player.hp > 0;
        });
        const head = headUnit.pose;
        const difference = Math.atan2(Math.sin(model.targetHeading - model.heading), Math.cos(model.targetHeading - model.heading));
        model.heading += Math.max(-model.turnSpeed * delta, Math.min(model.turnSpeed * delta, difference));
        head.x += Math.cos(model.heading) * model.speed * delta;
        head.y += Math.sin(model.heading) * model.speed * delta;
        const halfWidth = width / 2 - model.radius;
        const halfHeight = height / 2 - model.radius;
        const hitHorizontal = Math.abs(head.x) > halfWidth;
        const hitVertical = Math.abs(head.y) > halfHeight;
        if (hitHorizontal || hitVertical) {
            const effects = this.ent.game.effect.getBusiness<EffectBll>(EffectBll);
            effects.showPlayerWallShake(model.heading);
            const aliveIndices = model.players
                .map((player, index) => {
                    return player.hp > 0 ? index : -1;
                })
                .filter((index) => {
                    return index >= 0;
                });
            effects.showWallRipple(aliveIndices, model.speed);
            if (hitHorizontal) {
                const side = head.x < 0 ? ArenaWallSide.Left : ArenaWallSide.Right;
                effects.showWallImpact(Math.sign(head.x) * (width / 2), head.y, side, headUnit.roleId, false);
            }
            if (hitVertical) {
                const side = head.y < 0 ? ArenaWallSide.Bottom : ArenaWallSide.Top;
                effects.showWallImpact(head.x, Math.sign(head.y) * (height / 2), side, headUnit.roleId, false);
            }
        }
        if (hitHorizontal) {
            head.x = Math.max(-halfWidth, Math.min(halfWidth, head.x));
            model.heading = Math.PI - model.heading;
            model.targetHeading = model.heading;
        }
        if (hitVertical) {
            head.y = Math.max(-halfHeight, Math.min(halfHeight, head.y));
            model.heading = -model.heading;
            model.targetHeading = model.heading;
        }
        head.angle = model.heading * 180 / Math.PI;
        model.history.unshift({ ...head });
    }

    /** 沿队首历史轨迹按配置间距插值跟随，并裁剪超出队尾的历史数据。 */
    private followHistory() {
        const model = this.ent.PlayerModel;
        const players = model.players.filter((player) => {
            return player.hp > 0;
        });
        let distance = 0;
        let previous = model.history[0];
        let followerIndex = 1;
        const retained = [previous];
        for (const point of model.history.slice(1)) {
            const length = Math.hypot(point.x - previous.x, point.y - previous.y);
            while (followerIndex < players.length && distance + length >= followerIndex * model.spacing) {
                if (!length) {
                    break;
                }
                const weight = (followerIndex * model.spacing - distance) / length;
                const follower = players[followerIndex].pose;
                follower.x = previous.x + (point.x - previous.x) * weight;
                follower.y = previous.y + (point.y - previous.y) * weight;
                const angleDelta = Math.atan2(Math.sin((point.angle - previous.angle) * Math.PI / 180), Math.cos((point.angle - previous.angle) * Math.PI / 180));
                follower.angle = previous.angle + angleDelta * weight * 180 / Math.PI;
                followerIndex += 1;
            }
            retained.push(point);
            distance += length;
            previous = point;
            if (distance > players.length * model.spacing) {
                break;
            }
        }
        model.history = retained;
    }
}

import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import { TableRole } from "../../common/table/TableRole";
import { TableRoleLevel } from "../../common/table/TableRoleLevel";
import { TableBattleRule } from "../../common/table/TableBattleRule";
import type { Player } from "../Player";
import { PlayerEvent } from "../PlayerEvent";
import type { IPlayerUnit } from "../PlayerEvent";
import type { IPlayerData } from "../model/PlayerModel";

export class PlayerBll extends CCBusiness<Player> {
    /** 将商店 team 转为独立战场角色快照，按等级职业配置生成属性。 */
    prepare(team: IPlayerUnit[]) {
        const players = team.map((unit) => {
            return this.createPlayer(unit);
        });
        const model = this.ent.PlayerModel;
        model.reset();
        model.players = players;
        this.refreshMovementStats();
        players.forEach((player, index) => {
            player.pose.x = -index * model.spacing;
        });
        model.history = players.map((player) => {
            return { ...player.pose };
        });
        this.dispatchEvent(PlayerEvent.UpdatePlayers);
    }

    /** 将角色快照 unit 追加到战场队尾，保留原队员位置、朝向和跟随历史。 */
    append(unit: IPlayerUnit) {
        const model = this.ent.PlayerModel;
        const player = this.createPlayer(unit);
        if (model.history.length) {
            player.pose = { ...model.history[model.history.length - 1] };
        }
        model.players.push(player);
        model.history.push({ ...player.pose });
        this.refreshMovementStats();
        this.dispatchEvent(PlayerEvent.UpdatePlayers);
    }

    /** 将招募数据 unit 转为带配置、等级职业属性和初始位置的战场角色。 */
    private createPlayer(unit: IPlayerUnit) {
        const config = TableRole.getConfigById<TableRole>(unit.roleId);
        const level = TableRoleLevel.getConfigByLevel(unit.level);
        const stats = config.getBaseStats(level.id);
        const player: IPlayerData = {
            roleId: unit.roleId,
            level: unit.level,
            copies: unit.copies,
            config,
            stats,
            hp: stats.hp,
            pose: { x: 0, y: 0, angle: 0 },
        };
        return player;
    }

    /** 设置队伍下标 index 对应角色的当前血量 hp，限制在零到最大血量之间并通过事件刷新血条。 */
    setHp(index: number, hp: number) {
        const player = this.ent.PlayerModel.players[index];
        const wasAlive = player.hp > 0;
        const value = Math.max(0, Math.min(player.stats.hp, hp));
        if (player.hp === value) {
            return;
        }
        player.hp = value;
        this.dispatchEvent(PlayerEvent.UpdateHp, index);
        if (wasAlive !== (value > 0)) {
            const model = this.ent.PlayerModel;
            const alive = model.players.filter((entry) => {
                return entry.hp > 0;
            });
            model.history = alive.map((entry) => {
                return { ...entry.pose };
            });
            if (alive.length) {
                model.heading = alive[0].pose.angle * Math.PI / 180;
                model.targetHeading = model.heading;
            }
            this.refreshMovementStats();
            this.dispatchEvent(PlayerEvent.UpdatePlayers);
        }
    }

    /** 对下标 index 的存活队员施加原版防御减伤后的 damage，死亡由血量事件同步。 */
    hit(index: number, damage: number) {
        const player = this.ent.PlayerModel.players[index];
        if (player.hp <= 0) {
            return;
        }
        const base = TableBattleRule.getCurrent().defenseBase;
        const defense = player.stats.defense;
        const actualDamage = damage * (defense >= 0 ? base / (base + defense) : 2 - base / (base + defense));
        this.setHp(index, player.hp - Math.max(0, actualDamage));
    }

    /** 根据当前阵容重新计算跟随间距、转向速度、角色半径与平均移速。 */
    private refreshMovementStats() {
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
            return total + player.stats.moveSpeed;
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
        let remaining = deltaTime;
        while (remaining > 0) {
            const delta = Math.min(remaining, 1 / 60);
            this.moveHead(delta, width, height);
            this.followHistory();
            remaining -= delta;
        }
        this.dispatchEvent(PlayerEvent.UpdatePose);
    }

    /** 按 delta 秒转向并移动队首，使用 width、height 进行边界反弹。 */
    private moveHead(delta: number, width: number, height: number) {
        const model = this.ent.PlayerModel;
        const head = model.players.find((player) => {
            return player.hp > 0;
        }).pose;
        const difference = Math.atan2(Math.sin(model.targetHeading - model.heading), Math.cos(model.targetHeading - model.heading));
        model.heading += Math.max(-model.turnSpeed * delta, Math.min(model.turnSpeed * delta, difference));
        head.x += Math.cos(model.heading) * model.speed * delta;
        head.y += Math.sin(model.heading) * model.speed * delta;
        const halfWidth = width / 2 - model.radius;
        const halfHeight = height / 2 - model.radius;
        if (Math.abs(head.x) > halfWidth) {
            head.x = Math.max(-halfWidth, Math.min(halfWidth, head.x));
            model.heading = Math.PI - model.heading;
            model.targetHeading = model.heading;
        }
        if (Math.abs(head.y) > halfHeight) {
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

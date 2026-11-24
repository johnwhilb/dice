import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import { TableRole } from "../../common/table/TableRole";
import { TableRoleLevel } from "../../common/table/TableRoleLevel";
import type { Player } from "../Player";
import { PlayerEvent } from "../PlayerEvent";
import type { IPlayerUnit } from "../PlayerEvent";
import type { IPlayerData } from "../model/PlayerModel";
import { TablePlayerSkill } from "../../common/table/TablePlayerSkill";
import { SkillTypeKeyEnum } from "../../common/table/SkillTypeKeyEnum";
import { CombatBll } from "../../combat/bll/CombatBll";
import { PlayerMoveBll } from "./PlayerMoveBll";
import { RoleKeyEnum } from "../../common/table/RoleKeyEnum";

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
        const skill = TablePlayerSkill.getForRole(unit.roleId, unit.level);
        if (unit.roleId === RoleKeyEnum.Flagellant && skill.extraPower > 0) {
            stats.hp *= skill.extraPower;
        }
        const quickSupport =
            skill.interval >= 6 &&
            (skill.kind === SkillTypeKeyEnum.ChainBuff ||
                skill.kind === SkillTypeKeyEnum.Shield ||
                skill.kind === SkillTypeKeyEnum.Fairy ||
                skill.kind === SkillTypeKeyEnum.Sacrifice);
        const initialTimer = skill.follow ? 0 : quickSupport ? Math.min(2, skill.interval) : skill.interval;
        const player: IPlayerData = {
            roleId: unit.roleId,
            level: unit.level,
            copies: unit.copies,
            config,
            stats,
            hp: stats.hp,
            pose: { x: 0, y: 0, angle: 0 },
            skill,
            attackTimer: initialTimer,
            castCount: 0,
            repeatCount: 0,
            auxiliaryTimer: 0,
            storedDamage: 0,
            initialized: false,
            lastStand: false,
            lasting: false,
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
        this.ent.game.combat.getBusiness<CombatBll>(CombatBll).hitPlayer(index, damage);
    }

    /** 根据当前存活阵容刷新队伍移动参数。 */
    private refreshMovementStats() {
        this.ent.getBusiness<PlayerMoveBll>(PlayerMoveBll).refreshMovementStats();
    }

    /** 将战场触摸坐标 x、y 交给移动业务转向。 */
    steer(x: number, y: number) {
        this.ent.getBusiness<PlayerMoveBll>(PlayerMoveBll).steer(x, y);
    }

    /** 推进 deltaTime 秒的队伍移动，width、height 为战场尺寸。 */
    updateMovement(deltaTime: number, width: number, height: number) {
        this.ent.getBusiness<PlayerMoveBll>(PlayerMoveBll).updateMovement(deltaTime, width, height);
    }
}

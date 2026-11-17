import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import type { Player } from "../Player";
import { TableBattlePassive } from "../../common/table/TableBattlePassive";
import { TableRoleClass } from "../../common/table/TableRoleClass";
import { TableClassEffect } from "../../common/table/TableClassEffect";
import { RoleClassKeyEnum } from "../../common/table/RoleClassKeyEnum";
import { RoleKeyEnum } from "../../common/table/RoleKeyEnum";
import { ShopContentKeyEnum } from "../../common/table/ShopContentKeyEnum";
import { BuffBll } from "../../buff/bll/BuffBll";
import { BuffKind } from "../../buff/BuffEvent";
import { CombatCamp } from "../../combat/CombatEvent";
import type { Game } from "../../game/Game";
import { TableCombatRule } from "../../common/table/TableCombatRule";

export class PlayerBattleBll extends CCBusiness<Player> {
    /** 返回所属游戏，实体装配时注入。 */
    private get game(): Game {
        return this.ent.game;
    }

    /** 返回已持有道具 contentId 的等级，零表示未持有。 */
    itemLevel(contentId: number) {
        const item = this.game.shop.ShopModel.items.find((entry) => {
            return entry.contentId === contentId;
        });
        return item ? item.level : 0;
    }

    /** 从战斗配置读取已持有道具 contentId 的数值，未持有不提供加成。 */
    item(contentId: number) {
        const level = this.itemLevel(contentId);
        return level ? TableBattlePassive.getForItem(contentId, level).value : 0;
    }

    /** 判断角色 index 是否拥有 classId 职业。 */
    hasClass(index: number, classId: number) {
        return this.ent.PlayerModel.players[index].config.getClasses().some((entry) => {
            return entry.id === classId;
        });
    }

    /** 统计存活队员对 classId 的贡献，和商店阵容统计保持一致。 */
    classCount(classId: number) {
        return this.ent.PlayerModel.players.filter((player) => {
            return player.hp > 0 && player.config.getClasses().some((entry) => {
                return entry.id === classId;
            });
        }).length;
    }

    /** 按职业配置的激活阈值计算 classId 羁绊等级。 */
    classLevel(classId: number) {
        const config = TableRoleClass.getConfigById<TableRoleClass>(classId);
        const count = this.classCount(classId);
        return config.getActivationCounts().filter((threshold) => {
            return count >= threshold;
        }).length;
    }

    /** 返回 classId 当前羁绊的战斗效果数值。 */
    classValue(classId: number) {
        return TableClassEffect.getForClass(classId, this.classLevel(classId)).value;
    }

    /** 统计当前激活的职业集合数量。 */
    activeClassCount() {
        return TableRoleClass.getAllConfig<TableRoleClass>().filter((entry) => {
            return this.classLevel(entry.id) > 0;
        }).length;
    }

    /** 按当前阵容、血量、状态和道具计算 index 的实时战斗属性，不覆盖基础属性。 */
    stats(index: number) {
        const model = this.ent.PlayerModel;
        const rule = TableCombatRule.getCurrent();
        const player = model.players[index];
        const base = player.stats;
        const buff = this.game.buff.getBusiness<BuffBll>(BuffBll);
        const data = { ...base };
        const alive = model.players.filter((entry) => {
            return entry.hp > 0;
        });
        const position = alive.indexOf(player);
        const edge = position === 0 || position === alive.length - 1;
        let damage = 1 + this.classValue(RoleClassKeyEnum.Enchanter);
        let speed = 1;
        let defense = 1;
        let movement = 1 + this.item(ShopContentKeyEnum.ItemCentipede);
        alive.forEach((ally) => {
            if (ally.roleId === RoleKeyEnum.Squire) {
                damage *= 1 + ally.skill.power;
                defense *= 1 + ally.skill.power;
                speed *= 1 + ally.skill.extraPower;
                movement *= 1 + ally.skill.extraPower;
            }
            if (ally.roleId === RoleKeyEnum.Chronomancer) {
                speed *= 1 + ally.skill.power;
            }
        });
        if (this.classCount(RoleClassKeyEnum.Enchanter)) {
            const reinforce = 1 + this.item(ShopContentKeyEnum.ItemReinforce);
            damage *= reinforce;
            defense *= reinforce;
            speed *= reinforce;
        }
        if (edge) {
            damage *= 1 + this.item(ShopContentKeyEnum.ItemOffensiveStance);
            defense *= 1 + this.item(ShopContentKeyEnum.ItemDefensiveStance);
        }
        if (position + 1 === rule.attackSpeedPosition) {
            speed *= 1 + this.item(ShopContentKeyEnum.ItemSpeed3);
        }
        if (position + 1 === rule.damagePosition) {
            damage *= 1 + this.item(ShopContentKeyEnum.ItemDamage4);
        }
        if (this.hasClass(index, RoleClassKeyEnum.Warrior)) {
            data.defense += this.classValue(RoleClassKeyEnum.Warrior);
            speed *= 1 + this.item(ShopContentKeyEnum.ItemBerserking) * (1 - player.hp / base.hp);
            defense *= 1 + this.item(ShopContentKeyEnum.ItemUnwaveringStance) * Math.floor(this.game.combat.CombatModel.elapsed / rule.stanceInterval);
        }
        if (this.hasClass(index, RoleClassKeyEnum.Mage)) {
            speed *= 1 + this.item(ShopContentKeyEnum.ItemChronomancy);
        }
        if (this.hasClass(index, RoleClassKeyEnum.Explorer) || player.roleId === RoleKeyEnum.Vagrant && player.level === 3) {
            const power = this.hasClass(index, RoleClassKeyEnum.Explorer) ? this.classValue(RoleClassKeyEnum.Explorer) : player.skill.power;
            damage *= 1 + power * this.activeClassCount();
            speed *= 1 + power * this.activeClassCount();
        }
        if (this.hasClass(index, RoleClassKeyEnum.Mercenary)) {
            damage *= 1 + this.item(ShopContentKeyEnum.ItemDividends) * this.game.shop.ShopModel.gold;
        }
        if (player.roleId === RoleKeyEnum.Magician && player.skill.extraEvery > 0 && this.game.combat.CombatModel.elapsed % player.skill.extraEvery < player.skill.extraDelay) {
            speed *= player.skill.extraPower;
        }
        if (alive.length === 1) {
            const last = 1 + this.item(ShopContentKeyEnum.ItemLastStand);
            damage *= last;
            speed *= last;
            defense *= last;
            movement *= last;
        }
        const area = this.hasClass(index, RoleClassKeyEnum.Nuker) ? this.classValue(RoleClassKeyEnum.Nuker) : 0;
        const unleash = this.hasClass(index, RoleClassKeyEnum.Nuker) ? this.item(ShopContentKeyEnum.ItemUnleash) * this.game.combat.CombatModel.elapsed : 0;
        data.damage *= damage * (1 + buff.get(CombatCamp.Player, index, BuffKind.Damage));
        data.defense *= defense * (1 + buff.get(CombatCamp.Player, index, BuffKind.Defense));
        data.attackSpeedMultiplier *= speed * (1 + buff.get(CombatCamp.Player, index, BuffKind.AttackSpeed));
        data.moveSpeed *= movement * (1 + buff.get(CombatCamp.Player, index, BuffKind.MoveSpeed));
        data.areaDamageMultiplier *= (1 + area) * (1 + unleash) * (1 + this.item(ShopContentKeyEnum.ItemAmplify));
        data.areaSizeMultiplier *= (1 + area) * (1 + unleash) * (1 + this.item(ShopContentKeyEnum.ItemMagnify));
        return data;
    }
}

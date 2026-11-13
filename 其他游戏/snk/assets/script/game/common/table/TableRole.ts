import { BaseRole } from './BaseRole';
import { RoleLevelKeyEnum } from './RoleLevelKeyEnum';
import { TableRoleClass } from './TableRoleClass';
import { TableRoleLevel } from './TableRoleLevel';

export interface RoleBaseStats {
    hp: number;
    damage: number;
    defense: number;
    moveSpeed: number;
    attackSpeedMultiplier: number;
    cooldownMultiplier: number;
    areaDamageMultiplier: number;
    areaSizeMultiplier: number;
}

/**
 * Role 配置扩展类。
 *
 * 此文件只会自动创建一次。
 * 可以在这里安全编写项目自己的方法。
 */
export class TableRole extends BaseRole {
    static getRecruitableByTier(tier: number) {
        return this.getAllConfig<TableRole>().filter((config) => {
            return config.shopEnabled && config.tier === tier;
        });
    }

    getClasses() {
        return [this.classId1, this.classId2, this.classId3].filter((id) => {
            return id > 0;
        }).map((id) => {
            return TableRoleClass.getConfigById(id);
        }).filter((config): config is TableRoleClass => {
            return !!config;
        });
    }

    getBaseStats(levelId: number = RoleLevelKeyEnum.Level1) {
        const level = TableRoleLevel.getConfigById(levelId);
        if (!level) {
            return null;
        }
        const stats: RoleBaseStats = {
            hp: level.hp,
            damage: level.damage,
            defense: level.defense,
            moveSpeed: level.moveSpeed,
            attackSpeedMultiplier: level.attackSpeedMultiplier,
            cooldownMultiplier: 1,
            areaDamageMultiplier: level.areaDamageMultiplier,
            areaSizeMultiplier: level.areaSizeMultiplier
        };
        this.getClasses().forEach((roleClass) => {
            stats.hp *= roleClass.hpMultiplier;
            stats.damage *= roleClass.damageMultiplier;
            stats.defense *= roleClass.defenseMultiplier;
            stats.moveSpeed *= roleClass.moveSpeedMultiplier;
            stats.attackSpeedMultiplier *= roleClass.attackSpeedMultiplier;
            stats.areaDamageMultiplier *= roleClass.areaDamageMultiplier;
            stats.areaSizeMultiplier *= roleClass.areaSizeMultiplier;
        });
        stats.cooldownMultiplier = 1 / stats.attackSpeedMultiplier;
        return stats;
    }
}

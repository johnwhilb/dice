import { BasePlayerSkill } from "./BasePlayerSkill";

export class TablePlayerSkill extends BasePlayerSkill {
    static getForRole(roleId: number, level: number) {
        const config = this.getAllConfig<TablePlayerSkill>().find((entry) => {
            return entry.roleId === roleId && entry.level === level;
        });
        if (!config) {
            throw new Error(`战斗配置 PlayerSkill 缺失：${roleId}，等级 ${level}`);
        }
        return config;
    }
}

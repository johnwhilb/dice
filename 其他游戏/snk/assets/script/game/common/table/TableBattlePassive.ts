import { BaseBattlePassive } from "./BaseBattlePassive";

export class TableBattlePassive extends BaseBattlePassive {
    private static configs: Map<string, TableBattlePassive> = new Map();

    static getForItem(contentId: number, level: number) {
        const key = `${contentId}:${level}`;
        if (this.configs.has(key)) {
            return this.configs.get(key);
        }
        const config = this.getAllConfig<TableBattlePassive>().find((entry) => {
            return entry.contentId === contentId && entry.level === level;
        });
        if (!config) {
            throw new Error(`战斗配置 BattlePassive 缺失：${contentId}，等级 ${level}`);
        }
        this.configs.set(key, config);
        return config;
    }
}

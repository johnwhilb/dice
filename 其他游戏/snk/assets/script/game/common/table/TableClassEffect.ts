import { BaseClassEffect } from "./BaseClassEffect";

export class TableClassEffect extends BaseClassEffect {
    private static configs: Map<string, TableClassEffect> = new Map();

    static getForClass(classId: number, level: number) {
        const key = `${classId}:${level}`;
        if (this.configs.has(key)) {
            return this.configs.get(key);
        }
        const config = this.getAllConfig<TableClassEffect>().find((entry) => {
            return entry.classId === classId && entry.level === level;
        });
        if (!config) {
            throw new Error(`战斗配置 ClassEffect 缺失：${classId}，等级 ${level}`);
        }
        this.configs.set(key, config);
        return config;
    }
}

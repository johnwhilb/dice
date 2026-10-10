import { BaseEnemy } from "./BaseEnemy";
import { EnemyBehaviorNode, EnemyBehaviorNodeType, EnemyMechanics } from '../../battle/model/BattleTypes';

/**
 * Enemy 配置扩展类。
 *
 * 此文件只会自动创建一次。
 * 可以在这里安全编写项目自己的方法。
 */
export class TableEnemy extends BaseEnemy {
    getMechanics(): EnemyMechanics {
        const raw = this.mechanics;
        if (!raw || !Array.isArray(raw.initialStatuses) || !Array.isArray(raw.phases) || !Array.isArray(raw.triggers)) {
            throw new Error(`敌人机制配置无效：${this.id}`);
        }
        const config: EnemyMechanics = { initialStatuses: raw.initialStatuses, phases: raw.phases, triggers: raw.triggers };
        return config;
    }

    getBehavior(): EnemyBehaviorNode {
        const raw = this.behavior;
        if (!raw || !Object.values(EnemyBehaviorNodeType).includes(raw.type)) {
            throw new Error(`敌人行为树配置无效：${this.id}`);
        }
        const config: EnemyBehaviorNode = { ...raw, type: raw.type, children: raw.children };
        return config;
    }
}

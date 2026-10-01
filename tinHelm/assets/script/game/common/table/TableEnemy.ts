import { BaseEnemy } from "./BaseEnemy";
import { EnemyBehaviorNode, EnemyBehaviorNodeType } from '../../battle/model/BattleTypes';

/**
 * Enemy 配置扩展类。
 *
 * 此文件只会自动创建一次。
 * 可以在这里安全编写项目自己的方法。
 */
export class TableEnemy extends BaseEnemy {
    getBehavior(): EnemyBehaviorNode | undefined {
        const value: unknown = this.behavior;
        if (this.isBehaviorNode(value)) {
            return value;
        }
        return undefined;
    }

    private isBehaviorNode(value: unknown): value is EnemyBehaviorNode {
        if (!value || typeof value !== 'object' || !('type' in value)) {
            return false;
        }
        return typeof value.type === 'string' && Object.values(EnemyBehaviorNodeType).some(type => type === value.type);
    }
}

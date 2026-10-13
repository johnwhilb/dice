import { BaseClimbLevel } from './BaseClimbLevel';
import { HoldTypeKindEnum } from './HoldTypeKindEnum';
import { TableClimbHold } from './TableClimbHold';

/**
 * ClimbLevel 配置扩展类。
 *
 * 此文件只会自动创建一次。
 * 可以在这里安全编写项目自己的方法。
 */
export class TableClimbLevel extends BaseClimbLevel {
    static getOrdered() {
        return this.getAllConfig().sort((first, second) => {
            return first.level - second.level;
        });
    }

    getHolds() {
        return TableClimbHold.getAllConfig().filter((point) => {
            return point.levelId === this.id;
        });
    }

    getDangerCount() {
        return this.getHolds().filter((point) => {
            return point.typeId === HoldTypeKindEnum.Danger;
        }).length;
    }

}

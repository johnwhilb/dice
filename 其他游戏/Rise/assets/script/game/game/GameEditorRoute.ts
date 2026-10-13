import { ClimbLevelNameEnum } from '../common/table/ClimbLevelNameEnum';
import { HoldTypeKindEnum } from '../common/table/HoldTypeKindEnum';
import { TableClimbHold } from '../common/table/TableClimbHold';
import { TableClimbLevel } from '../common/table/TableClimbLevel';
import { TableHoldType } from '../common/table/TableHoldType';

import { ClimbHold, ClimbSetting, LimbSetting, LimbId } from './TableClimbRoute';

export class GameEditorRoute {
    private static levelId = ClimbLevelNameEnum.Lv1;

    static get width() {
        return this.getLevel()?.width || 0;
    }

    static get height() {
        return this.getLevel()?.height || 0;
    }

    static get viewHeight() {
        return this.getLevel()?.viewHeight || 0;
    }

    static get snapRange() {
        return this.getLevel()?.snapRange || 0;
    }

    static get startHeight() {
        return this.getLevel()?.startHeight || 0;
    }

    static get finishHeight() {
        return this.getLevel()?.finishHeight || 0;
    }

    static get spawn() {
        const level = this.getLevel();
        return { x: level?.bodyX || 0, y: level?.bodyY || 0 };
    }

    static get limbs(): LimbSetting[] {
        const level = this.getLevel();
        return [
            { id: LimbId.LeftHand, name: '左手', hand: true, side: -1, start: TableClimbHold.getConfigById(level?.leftHandStart || 0)?.point || '' },
            { id: LimbId.RightHand, name: '右手', hand: true, side: 1, start: TableClimbHold.getConfigById(level?.rightHandStart || 0)?.point || '' },
            { id: LimbId.LeftFoot, name: '左脚', hand: false, side: -1, start: TableClimbHold.getConfigById(level?.leftFootStart || 0)?.point || '' },
            { id: LimbId.RightFoot, name: '右脚', hand: false, side: 1, start: TableClimbHold.getConfigById(level?.rightFootStart || 0)?.point || '' }
        ];
    }

    static getLevel() {
        return TableClimbLevel.getConfigById(this.levelId);
    }

    static selectLevel(id: number) {
        const level = TableClimbLevel.getConfigById(id);
        if (!level || level.width <= 0 || level.height <= level.viewHeight || level.scaleMin <= 0 || level.scaleMax < level.scaleMin) {
            return false;
        }
        const points = TableClimbHold.getAllConfig().filter((point) => {
            return point.levelId === id;
        });
        const starts = [level.leftHandStart, level.rightHandStart, level.leftFootStart, level.rightFootStart];
        const validStarts = new Set(starts).size === starts.length && starts.every((start) => {
            return points.some((point) => {
                return point.id === start;
            });
        });
        const validPoints = points.every((point) => {
            return !!TableHoldType.getConfigById(point.typeId) && point.x >= 0 && point.x <= level.width && point.y >= 0 && point.y <= level.height;
        });
        const validFinish = [HoldTypeKindEnum.FinishLeft, HoldTypeKindEnum.FinishRight].every((type) => {
            return points.some((point) => {
                return point.typeId === type;
            });
        });
        if (!validStarts || !validPoints || !validFinish || new Set(points.map((point) => {
            return point.point;
        })).size !== points.length) {
            return false;
        }
        this.levelId = id;
        return true;
    }

    static get() {
        const level = this.getLevel();
        const setting: ClimbSetting = {
            arm: level?.arm || 0,
            leg: level?.leg || 0,
            brittle: level?.brittle || 0,
            drain: [level?.drain0 || 0, level?.drain1 || 0, level?.drain2 || 0, level?.drain3 || 0, level?.drain4 || 0],
            scaleMin: level?.scaleMin || 1,
            scaleMax: level?.scaleMax || 1
        };
        return setting;
    }

    static isFinish(type: HoldTypeKindEnum) {
        return type === HoldTypeKindEnum.FinishLeft || type === HoldTypeKindEnum.FinishRight;
    }

    static createHolds() {
        const setting = this.get();
        return TableClimbHold.getAllConfig().filter((point) => {
            return point.levelId === this.levelId;
        }).sort((first, second) => {
            return first.order - second.order;
        }).map((point): ClimbHold => {
            return { id: point.point, x: point.x, y: point.y, type: point.typeId, durability: setting.brittle, broken: false, scale: setting.scaleMin };
        });
    }
}

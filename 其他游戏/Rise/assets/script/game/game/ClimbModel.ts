import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { ClimbLevelNameEnum } from '../common/table/ClimbLevelNameEnum';
import { ClimbHold, ClimbPoint, ClimbState, LimbId, TableClimbRoute } from './TableClimbRoute';

export interface LimbTravel {
    start: ClimbPoint;
    targetId: string;
    age: number;
    duration: number;
}

export interface ClimbLimb extends ClimbPoint {
    id: LimbId;
    hand: boolean;
    side: number;
    holdId: string;
    travel: LimbTravel | null;
}

export interface ClimbBody extends ClimbPoint {
    vx: number;
    vy: number;
    tilt: number;
}

export interface ClimbDrag {
    limb: LimbId | null;
    touchId: number;
    start: ClimbPoint;
    startLean: number;
    active: boolean;
}

@ecs.register('ClimbModel')
export class ClimbModel extends ecs.Comp {
    state = ClimbState.Playing;
    levelId: number = ClimbLevelNameEnum.Lv1;
    selectedLevelId: number = ClimbLevelNameEnum.Lv1;
    holds: ClimbHold[] = [];
    limbs: ClimbLimb[] = [];
    body: ClimbBody = { x: 0, y: 0, vx: 0, vy: 0, tilt: 0 };
    selected: LimbId | null = null;
    drag: ClimbDrag | null = null;
    stamina = 100;
    camera = TableClimbRoute.height - TableClimbRoute.viewHeight;
    peak = TableClimbRoute.startHeight;
    moves = 0;
    elapsed = 0;
    time = 0;
    fallAge = 0;
    balanceX = 0;
    paused = true;
    hasRun = false;
    message = '';
    messageAge = 0;
    failReason = '';

    /** 按肢体标识获取位置、抓点及移动数据，标识来自固定四肢配置。 */
    getLimb(id: LimbId) {
        return this.limbs.find((limb) => {
            return limb.id === id;
        })!;
    }

    /** 清除本局四肢、岩点和交互数据，恢复未开始状态。 */
    reset() {
        this.holds = [];
        this.limbs = [];
        this.selected = null;
        this.drag = null;
        this.hasRun = false;
        this.paused = true;
    }
}

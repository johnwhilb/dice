export enum LimbId {
    LeftHand = 'lh',
    RightHand = 'rh',
    LeftFoot = 'lf',
    RightFoot = 'rf'
}

export enum ClimbState {
    Playing,
    Falling,
    Lost,
    Won
}

export enum HoldType {
    Normal,
    Crumble,
    Finish
}

export interface ClimbPoint {
    x: number;
    y: number;
}

export interface ClimbHold extends ClimbPoint {
    id: string;
    type: HoldType;
    durability: number;
    broken: boolean;
}

export interface ClimbSetting {
    arm: number;
    leg: number;
    brittle: number;
    drain: number[];
}

export interface LimbSetting {
    id: LimbId;
    name: string;
    hand: boolean;
    side: number;
    start: string;
}

export class TableClimbRoute {
    static readonly width = 760;
    static readonly height = 2220;
    static readonly viewHeight = 1180;
    static readonly snapRange = 51;
    static readonly startHeight = 1792;
    static readonly finishHeight = 195;

    static readonly limbs: LimbSetting[] = [
        { id: LimbId.LeftHand, name: '左手', hand: true, side: -1, start: 'S1' },
        { id: LimbId.RightHand, name: '右手', hand: true, side: 1, start: 'S2' },
        { id: LimbId.LeftFoot, name: '左脚', hand: false, side: -1, start: 'P1' },
        { id: LimbId.RightFoot, name: '右脚', hand: false, side: 1, start: 'P2' }
    ];

    private static readonly setting: ClimbSetting = {
        arm: 182, leg: 176, brittle: 6.1, drain: [24, 12, 4.1, 1.2, 0]
    };

    private static readonly points: [string, number, number][] = [
        ['S1', 336, 1792], ['S2', 491, 1814], ['P1', 322, 1970], ['P2', 493, 1970],
        ['h01', 315, 1690], ['h02', 505, 1634], ['h03', 385, 1562], ['h04', 516, 1481],
        ['h05', 340, 1427], ['h06', 418, 1321], ['h07', 485, 1250], ['h08', 348, 1165],
        ['h09', 445, 1080], ['h10', 495, 995], ['h11', 343, 910], ['h12', 440, 825],
        ['h13', 344, 740], ['h14', 480, 655], ['h15', 398, 570], ['h16', 485, 475],
        ['h17', 405, 393], ['h18', 467, 305], ['F1', 370, 220], ['F2', 486, 220]
    ];

    static get() {
        return this.setting;
    }

    static createHolds() {
        const crumble = new Set(['h03', 'h07', 'h11', 'h14', 'h17']);
        return this.points.map(([id, x, y]): ClimbHold => {
            const type = id.startsWith('F') ? HoldType.Finish : crumble.has(id) ? HoldType.Crumble : HoldType.Normal;
            return { id, x, y, type, durability: this.get().brittle, broken: false };
        });
    }
}

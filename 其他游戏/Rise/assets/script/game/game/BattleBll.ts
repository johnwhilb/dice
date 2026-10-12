import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import type { Battle } from './Battle';
import { ClimbLimb } from './BattleModel';
import { ClimbHold, ClimbPoint, ClimbState, HoldType, LimbId, TableClimbRoute } from './TableClimbRoute';

export class BattleBll extends CCBusiness<Battle> {
    /** 按挑战 V6 的固定规则初始化新一局。 */
    restart() {
        const model = this.ent.model;
        model.state = ClimbState.Playing;
        model.holds = TableClimbRoute.createHolds();
        model.limbs = TableClimbRoute.limbs.map((setting): ClimbLimb => {
            const hold = model.holds.find((item) => {
                return item.id === setting.start;
            })!;
            return { id: setting.id, hand: setting.hand, side: setting.side, x: hold.x, y: hold.y, holdId: hold.id, travel: null };
        });
        model.body = { x: 412, y: 1885, vx: 0, vy: 0, tilt: 0 };
        model.selected = null;
        model.drag = null;
        model.stamina = 100;
        model.camera = TableClimbRoute.height - TableClimbRoute.viewHeight;
        model.peak = TableClimbRoute.startHeight;
        model.moves = 0;
        model.elapsed = 0;
        model.time = 0;
        model.fallAge = 0;
        model.balanceX = 0;
        model.hasRun = true;
        model.failReason = '';
        model.message = '';
        model.messageAge = 0;
    }

    /** 暂停并取消拖动，悬空肢体保留状态供继续游戏恢复。 */
    pause() {
        this.ent.model.paused = true;
        this.ent.model.drag = null;
    }

    /** 选择肢体，id 为固定四肢标识；再次选择取消选中。 */
    select(id: LimbId) {
        const model = this.ent.model;
        if (model.state !== ClimbState.Playing || model.paused || model.getLimb(id).travel) {
            return;
        }
        model.selected = model.selected === id ? null : id;
    }

    /** 获取已固定手的数量，至少保留一只手才能继续攀爬。 */
    handCount() {
        return this.ent.model.limbs.filter((limb) => {
            return limb.hand && !!limb.holdId;
        }).length;
    }

    /** 获取固定支撑数量，移动途中的目标预占不算支撑。 */
    supportCount() {
        return this.ent.model.limbs.filter((limb) => {
            return !!limb.holdId;
        }).length;
    }

    /** 按当前支撑数量读取每秒体力消耗。 */
    currentDrain() {
        return TableClimbRoute.get().drain[this.supportCount()] || 0;
    }

    /** 获取岩点占用者，exclude 可排除正在操作的肢体，预占目标同样受保护。 */
    holderOf(holdId: string, exclude?: LimbId) {
        return this.ent.model.limbs.find((limb) => {
            return limb.id !== exclude && (limb.holdId === holdId || limb.travel?.targetId === holdId);
        });
    }

    /** 获取肢体根部世界坐标，id 为肢体标识，计入身体侧倾。 */
    rootOf(id: LimbId) {
        const model = this.ent.model;
        const limb = model.getLimb(id);
        const x = (limb.hand ? 29 : 20) * limb.side;
        const y = limb.hand ? -42 : 42;
        const angle = model.body.tilt;
        return {
            x: model.body.x + x * Math.cos(angle) - y * Math.sin(angle),
            y: model.body.y + x * Math.sin(angle) + y * Math.cos(angle)
        };
    }

    /** 获取肢体伸展限制，id 为手或脚的标识。 */
    maxReach(id: LimbId) {
        const setting = TableClimbRoute.get();
        return this.ent.model.getLimb(id).hand ? setting.arm : setting.leg;
    }

    /** 判断指定肢体 id 能否抓住 hold，包括距离、独占、破碎和终点限制。 */
    canReach(id: LimbId, hold: ClimbHold) {
        const model = this.ent.model;
        const limb = model.getLimb(id);
        if (model.state !== ClimbState.Playing || hold.broken || limb.travel || (!limb.hand && hold.type === HoldType.Finish)) {
            return false;
        }
        return !this.holderOf(hold.id, id) && this.distance(this.rootOf(id), hold) <= this.maxReach(id) + 2;
    }

    /** 获取目标 point 附近可达岩点，id 用于距离与占用判断。 */
    findHold(id: LimbId, point: ClimbPoint) {
        let nearest: ClimbHold | null = null;
        let distance = TableClimbRoute.snapRange;
        for (const hold of this.ent.model.holds) {
            const next = this.distance(point, hold);
            if (next < distance && this.canReach(id, hold)) {
                nearest = hold;
                distance = next;
            }
        }
        return nearest;
    }

    /** 执行抓点；id 为肢体，hold 为目标，instant 表示拖动释放时立即固定。 */
    takeHold(id: LimbId, hold: ClimbHold, instant = false) {
        const model = this.ent.model;
        const limb = model.getLimb(id);
        if (model.paused || model.state !== ClimbState.Playing || limb.travel) {
            return false;
        }
        const occupant = this.holderOf(hold.id, id);
        if (occupant) {
            this.showMessage('该岩点已被占用，每个岩点只能固定一只手或脚');
            return false;
        }
        if (!this.canReach(id, hold)) {
            this.showMessage(hold.broken ? '岩点已碎裂' : '够不到，先换支撑点或拖动身体侧倾');
            return false;
        }
        if (limb.holdId === hold.id) {
            model.selected = null;
            return true;
        }
        limb.holdId = '';
        if (limb.hand && this.handCount() === 0) {
            this.fail('双手全部松开，失去支撑');
            return false;
        }
        model.moves += 1;
        if (instant) {
            this.completeMove(limb, hold);
        }
        else {
            limb.travel = {
                start: { x: limb.x, y: limb.y }, targetId: hold.id, age: 0,
                duration: this.clamp(0.22 + this.distance(limb, hold) / 550, 0.28, 0.48)
            };
            model.selected = null;
        }
        return true;
    }

    /** 将 limb 固定到 hold，并更新最高进度与登顶结果。 */
    private completeMove(limb: ClimbLimb, hold: ClimbHold) {
        const model = this.ent.model;
        limb.travel = null;
        if (model.state !== ClimbState.Playing || hold.broken || this.holderOf(hold.id, limb.id)) {
            this.showMessage('目标岩点已不可用');
            return;
        }
        limb.x = hold.x;
        limb.y = hold.y;
        limb.holdId = hold.id;
        model.selected = null;
        if (limb.hand) {
            model.peak = Math.min(model.peak, hold.y);
        }
        if (hold.type === HoldType.Crumble) {
            this.showMessage('易碎岩点开始倒计时，尽快转移');
        }
        if (hold.type === HoldType.Finish) {
            this.showMessage('抓住终点！另一只手需要抓住另一个金色终点');
        }
        const hands = model.limbs.filter((item) => {
            return item.hand;
        });
        const finished = hands.every((hand) => {
            return model.holds.some((item) => {
                return item.id === hand.holdId && item.type === HoldType.Finish;
            });
        });
        if (finished) {
            model.state = ClimbState.Won;
            model.peak = TableClimbRoute.finishHeight;
            model.drag = null;
        }
    }

    /** 开始触摸，point 为世界坐标，touchId 用于过滤多点触控。 */
    pointerDown(point: ClimbPoint, touchId: number) {
        const model = this.ent.model;
        if (model.state !== ClimbState.Playing || model.paused || model.drag) {
            return;
        }
        const limb = model.limbs.find((item) => {
            return this.distance(item, point) < 32;
        });
        if (limb) {
            if (limb.travel) {
                this.showMessage('这只手或脚正在移动');
                return;
            }
            model.selected = limb.id;
            model.drag = { limb: limb.id, touchId, start: point, startLean: model.balanceX, active: false };
            return;
        }
        const hold = model.holds.find((item) => {
            return this.distance(item, point) < TableClimbRoute.snapRange;
        });
        if (hold && model.selected) {
            this.takeHold(model.selected, hold);
            return;
        }
        if (Math.abs(point.x - model.body.x) < 55 && point.y > model.body.y - 142 && point.y < model.body.y + 73) {
            model.drag = { limb: null, touchId, start: point, startLean: model.balanceX, active: false };
        }
        else {
            model.selected = null;
        }
    }

    /** 更新拖动，point 为世界坐标，touchId 必须匹配起始触摸。 */
    pointerMove(point: ClimbPoint, touchId: number) {
        const model = this.ent.model;
        const drag = model.drag;
        if (!drag || drag.touchId !== touchId || model.state !== ClimbState.Playing) {
            return;
        }
        if (!drag.active) {
            if (this.distance(drag.start, point) < 8) {
                return;
            }
            drag.active = true;
            if (drag.limb) {
                const limb = model.getLimb(drag.limb);
                limb.holdId = '';
                if (limb.hand && this.handCount() === 0) {
                    this.fail('双手全部松开，失去支撑');
                    return;
                }
            }
        }
        if (!drag.limb) {
            model.balanceX = this.clamp(drag.startLean + (point.x - drag.start.x) * 0.85, -76, 76);
            return;
        }
        const limb = model.getLimb(drag.limb);
        const root = this.rootOf(limb.id);
        const factor = Math.min(1, this.maxReach(limb.id) / Math.max(0.01, this.distance(root, point)));
        limb.x = this.clamp(root.x + (point.x - root.x) * factor, 148, 615);
        limb.y = this.clamp(root.y + (point.y - root.y) * factor, 170, 2043);
    }

    /** 结束触摸并尝试吸附；cancelled 为系统取消，此时不执行抓点。 */
    pointerUp(touchId: number, cancelled = false) {
        const model = this.ent.model;
        const drag = model.drag;
        if (!drag || drag.touchId !== touchId) {
            return;
        }
        model.drag = null;
        if (model.state !== ClimbState.Playing || !drag.limb || !drag.active || cancelled) {
            return;
        }
        const limb = model.getLimb(drag.limb);
        const hold = this.findHold(limb.id, limb);
        if (hold) {
            this.takeHold(limb.id, hold, true);
        }
        else {
            model.selected = limb.id;
            this.showMessage('没有抓稳，靠近发光岩点后松手');
        }
    }

    /** 调整身体侧倾，direction 为左右方向的 -1 或 1。 */
    lean(direction: number) {
        if (this.ent.model.state === ClimbState.Playing && !this.ent.model.paused) {
            this.ent.model.balanceX = direction * 70;
        }
    }

    /** 显示限时提示，message 为业务校验结果。 */
    private showMessage(message: string) {
        this.ent.model.message = message;
        this.ent.model.messageAge = 1.7;
    }

    /** 触发坠落，reason 说明双手失去支撑或体力耗尽。 */
    private fail(reason: string) {
        const model = this.ent.model;
        if (model.state !== ClimbState.Playing) {
            return;
        }
        model.state = ClimbState.Falling;
        model.failReason = reason;
        model.fallAge = 0;
        model.drag = null;
        model.selected = null;
        model.limbs.forEach((limb) => {
            limb.holdId = '';
            limb.travel = null;
        });
    }

    /** 推进 dt 秒的攀爬模拟，暂停期间不计算体力和易碎岩点倒计时。 */
    update(dt: number) {
        const model = this.ent.model;
        if (model.paused || !model.hasRun) {
            return;
        }
        const step = this.clamp(dt, 0, 0.043);
        model.time += step;
        model.messageAge = Math.max(0, model.messageAge - step);
        if (model.state === ClimbState.Playing) {
            model.elapsed += step;
            this.updateHolds(step);
            if (model.state === ClimbState.Playing) {
                model.stamina = Math.max(0, model.stamina - this.currentDrain() * step);
                if (model.stamina <= 0) {
                    this.fail('体力耗尽');
                }
            }
            if (model.state === ClimbState.Playing) {
                this.updateBody(step);
                this.updateLimbs(step);
            }
        }
        if (model.state === ClimbState.Falling) {
            model.fallAge += step;
            model.body.vy += 1050 * step;
            model.body.y += model.body.vy * step;
            model.body.tilt += 1.3 * step;
            model.limbs.forEach((limb) => {
                const root = this.rootOf(limb.id);
                limb.x += (root.x + limb.side * 30 - limb.x) * Math.min(1, step * 5);
                limb.y += (root.y + 115 - limb.y) * Math.min(1, step * 5);
            });
            if (model.fallAge > 0.8) {
                model.state = ClimbState.Lost;
            }
        }
        const target = this.clamp(model.body.y - TableClimbRoute.viewHeight * 0.67, 0, TableClimbRoute.height - TableClimbRoute.viewHeight);
        model.camera += (target - model.camera) * Math.min(1, step * 4.8);
    }

    /** 更新已占用易碎点的剩余寿命，dt 为模拟步长。 */
    private updateHolds(dt: number) {
        const model = this.ent.model;
        for (const hold of model.holds) {
            if (model.state !== ClimbState.Playing) {
                return;
            }
            if (hold.type !== HoldType.Crumble || hold.broken) {
                continue;
            }
            const occupied = model.limbs.some((limb) => {
                return limb.holdId === hold.id;
            });
            if (occupied) {
                hold.durability -= dt;
            }
            if (hold.durability <= 0) {
                hold.broken = true;
                model.limbs.forEach((limb) => {
                    if (limb.holdId === hold.id) {
                        limb.holdId = '';
                        limb.travel = null;
                    }
                });
                this.showMessage('岩点崩裂，赶紧换支撑');
                if (this.handCount() === 0) {
                    this.fail('易碎岩点崩裂，双手失去支撑');
                }
            }
        }
    }

    /** 根据支撑点求解身体位置和侧倾，dt 为模拟步长。 */
    private updateBody(dt: number) {
        const model = this.ent.model;
        const body = model.body;
        let x = 0;
        let y = 0;
        let weights = 0;
        for (const limb of model.limbs) {
            if (!limb.holdId) {
                continue;
            }
            const weight = limb.hand ? 1 : this.clamp((body.y + 195 - limb.y) / 115, 0, 1) * 0.2;
            x += (limb.x - limb.side * (limb.hand ? 70 : 22)) * weight;
            y += (limb.y + (limb.hand ? 76 : -85)) * weight;
            weights += weight;
        }
        if (!weights) {
            this.fail('双手全部松开，失去支撑');
            return;
        }
        const targetX = this.clamp(x / weights + model.balanceX, 220, 550);
        const targetY = this.clamp(y / weights + (this.handCount() === 1 ? 14 : 0), 250, 2020);
        if (!model.drag?.active || model.drag.limb) {
            model.balanceX += (0 - model.balanceX) * Math.min(1, dt * 0.5);
        }
        body.vx = (body.vx + (targetX - body.x) * 32 * dt) * Math.exp(-9 * dt);
        body.vy = (body.vy + (targetY - body.y) * 32 * dt) * Math.exp(-9 * dt);
        body.x += body.vx * dt;
        body.y += body.vy * dt;
        for (const pass of [0, 1, 2, 3]) {
            void pass;
            for (const limb of model.limbs) {
                if (!limb.hand || !limb.holdId) {
                    continue;
                }
                const root = this.rootOf(limb.id);
                const distance = this.distance(root, limb);
                const limit = this.maxReach(limb.id) - 3;
                if (distance > limit) {
                    const correction = (distance - limit) * 0.72 / distance;
                    body.x += (limb.x - root.x) * correction;
                    body.y += (limb.y - root.y) * correction;
                    body.vx *= 0.8;
                    body.vy *= 0.8;
                }
            }
        }
        body.x = this.clamp(body.x, 211, 555);
        body.y = this.clamp(body.y, 230, 2045);
        const hands = model.limbs.filter((limb) => {
            return limb.hand && !!limb.holdId;
        });
        const handX = hands.reduce((sum, hand) => {
            return sum + hand.x;
        }, 0) / Math.max(1, hands.length);
        const lean = this.clamp((handX - body.x) * (hands.length === 2 ? 0.0011 : 0.0016), -0.2, 0.2);
        body.tilt += (this.clamp(lean + body.vx * 0.00025, -0.24, 0.24) - body.tilt) * Math.min(1, dt * 4);
    }

    /** 更新肢体插值、悬空摆动及脚滑脱，dt 为模拟步长。 */
    private updateLimbs(dt: number) {
        const model = this.ent.model;
        for (const limb of model.limbs) {
            if (model.state !== ClimbState.Playing) {
                return;
            }
            const travel = limb.travel;
            if (travel) {
                travel.age += dt;
                const progress = this.clamp(travel.age / travel.duration, 0, 1);
                const hold = model.holds.find((item) => {
                    return item.id === travel.targetId;
                });
                if (hold) {
                    const ease = 1 - Math.pow(1 - progress, 3);
                    limb.x = travel.start.x + (hold.x - travel.start.x) * ease;
                    limb.y = travel.start.y + (hold.y - travel.start.y) * ease;
                    if (progress >= 1) {
                        this.completeMove(limb, hold);
                    }
                }
                else {
                    limb.travel = null;
                }
            }
            if (model.drag?.active && model.drag.limb === limb.id) {
                continue;
            }
            const root = this.rootOf(limb.id);
            if (!limb.holdId && !limb.travel) {
                const targetX = root.x + limb.side * (limb.hand ? 54 : 33) + Math.sin(model.time * 2.2 + limb.side) * 4;
                limb.x += (targetX - limb.x) * Math.min(1, dt * 7);
                limb.y += (root.y + (limb.hand ? 90 : 123) - limb.y) * Math.min(1, dt * 7);
            }
            if (!limb.hand && limb.holdId && this.distance(root, limb) > this.maxReach(limb.id) + 17) {
                limb.holdId = '';
                limb.travel = null;
                this.showMessage('脚伸得太远，失去一处支撑');
            }
        }
    }

    /** 计算点 a、b 的世界距离。 */
    private distance(a: ClimbPoint, b: ClimbPoint) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    /** 将 value 限制在 min 与 max 之间。 */
    private clamp(value: number, min: number, max: number) {
        return Math.min(max, Math.max(min, value));
    }
}

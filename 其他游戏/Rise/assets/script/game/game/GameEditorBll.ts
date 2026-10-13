import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { JsonUtil } from 'db://oops-framework/core/utils/JsonUtil';
import { GameEditorRoute } from './GameEditorRoute';
import { EditorPoint } from './GameEditorModel';
import { TableClimbHold } from '../common/table/TableClimbHold';
import { TableHoldType } from '../common/table/TableHoldType';
import type { GameEditor } from './GameEditor';
import { HoldTypeKindEnum } from '../common/table/HoldTypeKindEnum';
import { TableClimbLevel } from '../common/table/TableClimbLevel';
import { ClimbLimb } from './GameEditorModel';
import { ClimbHold, ClimbPoint, ClimbState, LimbId } from './TableClimbRoute';

export class GameEditorBll extends CCBusiness<GameEditor> {
    /** 从关卡表载入独立编辑副本，levelId 是关卡主键，不改变正式游戏数据。 */
    loadLevel(levelId: number) {
        if (!GameEditorRoute.selectLevel(levelId)) {
            return false;
        }
        const model = this.ent.model;
        model.levelId = levelId;
        model.points = TableClimbHold.getAllConfig().filter((point) => {
            return point.levelId === levelId;
        }).sort((first, second) => {
            return first.order - second.order;
        }).map((point): EditorPoint => {
            return { id: point.id, levelId, point: point.point, x: point.x, y: point.y, typeId: point.typeId, order: point.order };
        });
        model.editing = true;
        model.infiniteStamina = true;
        model.selectedPoint = 0;
        model.dirty = false;
        model.status = '点击岩点选中；拖动岩点改位置，拖动空白移动墙壁';
        model.revision += 1;
        const result = this.restart();
        model.paused = true;
        return result;
    }

    /** 获取关卡的四个初始抓点主键，这些点不能删除。 */
    private startIds() {
        const level = GameEditorRoute.getLevel();
        return [level?.leftHandStart || 0, level?.rightHandStart || 0, level?.leftFootStart || 0, level?.rightFootStart || 0];
    }

    /** 判断配置主键 id 是否为关卡的初始四肢支撑点。 */
    isStartPoint(id: number) {
        return this.startIds().includes(id);
    }

    /** 根据名称或主键查询岩点，并将镜头移到目标附近。 */
    findPoint(query: string) {
        const model = this.ent.model;
        const point = model.points.find((item) => {
            return item.point === query.trim() || String(item.id) === query.trim();
        });
        if (!point) {
            model.status = '未找到岩点，可输入名称或配置主键';
            return false;
        }
        model.selectedPoint = point.id;
        model.camera = this.clamp(point.y - GameEditorRoute.viewHeight / 2, 0, GameEditorRoute.height - GameEditorRoute.viewHeight);
        model.revision += 1;
        return true;
    }

    /** 选择鼠标附近的岩点，point 使用墙壁坐标。 */
    selectPoint(point: ClimbPoint) {
        const model = this.ent.model;
        const target = model.points.filter((item) => {
            return this.distance(item, point) <= GameEditorRoute.snapRange;
        }).sort((first, second) => {
            return this.distance(first, point) - this.distance(second, point);
        })[0];
        model.selectedPoint = target?.id || 0;
        model.revision += 1;
        return !!target;
    }

    /** 在当前镜头中央增加普通岩点，并分配未使用的全表主键。 */
    addPoint() {
        const model = this.ent.model;
        if (!model.editing || model.saving) {
            return false;
        }
        const occupied = new Set(TableClimbHold.getAllConfig().map((point) => {
            return point.id;
        }).concat(model.points.map((point) => {
            return point.id;
        })));
        const id = Array.from({ length: TableClimbHold.LocalIdBase - 1 }, (value, index) => {
            return TableClimbHold.TableId * TableClimbHold.LocalIdBase + index + 1;
        }).find((value) => {
            return !occupied.has(value);
        });
        if (!id) {
            model.status = '岩点表主键已用完';
            return false;
        }
        const names = new Set(model.points.map((point) => {
            return point.point;
        }));
        let name = `h${id}`;
        while (names.has(name)) {
            name += 'n';
        }
        model.points.push({ id, levelId: model.levelId, point: name, x: GameEditorRoute.width / 2, y: model.camera + GameEditorRoute.viewHeight / 2, typeId: HoldTypeKindEnum.Normal, order: model.points.length + 1 });
        model.selectedPoint = id;
        this.refreshDraft();
        model.status = '已新增岩点，可拖动或输入坐标调整';
        return true;
    }

    /** 删除选中的非初始岩点，初始四肢支撑点受保护。 */
    deletePoint() {
        const model = this.ent.model;
        if (!model.editing || model.saving || !model.selectedPoint) {
            return false;
        }
        if (this.startIds().includes(model.selectedPoint)) {
            model.status = '初始四肢抓点不能删除，可修改位置';
            return false;
        }
        model.points = model.points.filter((point) => {
            return point.id !== model.selectedPoint;
        });
        model.selectedPoint = 0;
        this.refreshDraft();
        model.status = '岩点已删除，保存前需保留左右两个终点';
        return true;
    }

    /** 更新选中岩点的名称、坐标和类型；名称唯一，坐标位于墙壁内。 */
    changePoint(name: string, x: number, y: number, typeId: HoldTypeKindEnum) {
        const model = this.ent.model;
        const point = model.points.find((item) => {
            return item.id === model.selectedPoint;
        });
        if (!model.editing || model.saving || !point) {
            model.status = '请先选中岩点并切换到编辑模式';
            return false;
        }
        const key = name.trim();
        if (!key || model.points.some((item) => {
            return item.id !== point.id && item.point === key;
        })) {
            model.status = '岩点名称不能为空或重复';
            return false;
        }
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > GameEditorRoute.width || y < 0 || y > GameEditorRoute.height || !TableHoldType.getConfigById(typeId)) {
            model.status = '坐标超出墙壁范围，或岩点类型无效';
            return false;
        }
        if ((GameEditorRoute.getLevel()?.level || 0) <= 3 && typeId === HoldTypeKindEnum.Danger) {
            model.status = '前3关不能配置危险岩点';
            return false;
        }
        if (this.startIds().includes(point.id) && typeId !== HoldTypeKindEnum.Normal) {
            model.status = '初始抓点必须保持普通岩点';
            return false;
        }
        point.point = key;
        point.x = Math.round(x * 100) / 100;
        point.y = Math.round(y * 100) / 100;
        point.typeId = typeId;
        this.refreshDraft();
        model.status = '已修改，尚未保存到 Excel';
        return true;
    }

    /** 切换编辑和试爬模式；试爬按当前草稿重新初始化，不覆盖配置。 */
    toggleMode() {
        const model = this.ent.model;
        if (model.saving) {
            return;
        }
        if (!model.editing && this.restart()) {
            model.editing = true;
            model.paused = true;
            model.status = model.dirty ? '已返回编辑，当前草稿尚未保存' : '已返回编辑模式';
            return;
        }
        if (!this.validateDraft()) {
            return;
        }
        if (this.restart()) {
            model.editing = false;
            model.paused = false;
            model.status = '试爬中：拖动四肢换点，或拖动身体调整姿态';
        }
    }

    /** 拖动选中的岩点到墙壁坐标，自动限制在墙壁范围。 */
    movePoint(position: ClimbPoint) {
        const point = this.ent.model.points.find((item) => {
            return item.id === this.ent.model.selectedPoint;
        });
        if (point) {
            this.changePoint(point.point, this.clamp(position.x, 0, GameEditorRoute.width), this.clamp(position.y, 0, GameEditorRoute.height), point.typeId);
        }
    }

    /** 按镜头偏移上下浏览整面墙，offset 使用墙壁坐标单位。 */
    panCamera(offset: number) {
        if (this.ent.model.editing && !this.ent.model.saving) {
            this.ent.model.camera = this.clamp(this.ent.model.camera + offset, 0, GameEditorRoute.height - GameEditorRoute.viewHeight);
        }
    }

    /** 重建草稿显示与初始支撑位置，保留镜头和各岩点随机缩放。 */
    private refreshDraft() {
        const model = this.ent.model;
        const camera = model.camera;
        const scales = new Map(model.holds.map((hold) => {
            return [hold.id, hold.scale];
        }));
        this.restart();
        model.holds.forEach((hold) => {
            hold.scale = scales.get(hold.id) || hold.scale;
        });
        model.camera = camera;
        model.paused = true;
        model.dirty = true;
        model.revision += 1;
    }

    /** 校验试爬和保存的草稿，左右终点各保留一个，初始点均为普通石头。 */
    private validateDraft() {
        const model = this.ent.model;
        const validFinish = [HoldTypeKindEnum.FinishLeft, HoldTypeKindEnum.FinishRight].every((typeId) => {
            return model.points.filter((point) => {
                return point.typeId === typeId;
            }).length === 1;
        });
        const validStarts = this.startIds().every((id) => {
            return model.points.some((point) => {
                return point.id === id && point.typeId === HoldTypeKindEnum.Normal;
            });
        });
        if (!validFinish || !validStarts) {
            model.status = '需保留4个普通初始抓点，以及左右终点各1个';
            return false;
        }
        return true;
    }

    /** 通过本地配表插件保存当前关卡；使用回调等待磁盘写入和配置生成。 */
    saveExcel() {
        const model = this.ent.model;
        if (model.saving || !this.validateDraft()) {
            return;
        }
        model.saving = true;
        model.status = '正在写入 Excel 并生成配置…';
        const request = new XMLHttpRequest();
        request.open('POST', 'http://127.0.0.1:17381/climb-editor/save');
        request.setRequestHeader('Content-Type', 'application/json');
        request.responseType = 'json';
        request.timeout = 30000;
        request.onload = () => {
            const result: { success?: boolean; message?: string } | null = request.response;
            model.saving = false;
            if (request.status !== 200 || !result?.success) {
                model.status = result?.message || '保存失败，请检查配表插件控制台';
                return;
            }
            const data: Record<string, EditorPoint> = JsonUtil.get(TableClimbHold.TableName) || {};
            Object.keys(data).forEach((key) => {
                if (data[key].levelId === model.levelId) {
                    delete data[key];
                }
            });
            model.points.forEach((point, index) => {
                point.order = index + 1;
                data[String(point.id)] = { ...point };
            });
            model.dirty = false;
            model.status = '已保存到 3_ClimbHold.xlsx，并同步生成客户端配置';
        };
        const failure = () => {
            model.saving = false;
            model.status = '无法连接配表插件：请在 Creator 扩展管理器重载 Excel To Json 后重试';
        };
        request.onerror = failure;
        request.ontimeout = failure;
        request.send(JSON.stringify({ levelId: model.levelId, points: model.points }));
    }

    /** 按 Model 的关卡 ID 读取坐标、初始抓点和攀爬参数，初始化新一局。 */
    restart() {
        const model = this.ent.model;
        if (!GameEditorRoute.selectLevel(model.levelId)) {
            model.paused = true;
            this.showMessage('关卡配置缺失或岩点配置无效');
            return false;
        }
        const setting = GameEditorRoute.get();
        model.state = ClimbState.Playing;
        model.holds = model.points.map((point): ClimbHold => {
            return { id: point.point, x: point.x, y: point.y, type: point.typeId, durability: setting.brittle, broken: false, scale: setting.scaleMin };
        });
        model.holds.forEach((hold) => {
            hold.scale = setting.scaleMin + Math.random() * (setting.scaleMax - setting.scaleMin);
        });
        const starts = this.startIds();
        model.limbs = GameEditorRoute.limbs.map((setting, index): ClimbLimb => {
            const point = model.points.find((item) => {
                return item.id === starts[index];
            })!;
            const hold = model.holds.find((item) => {
                return item.id === point.point;
            })!;
            return { id: setting.id, hand: setting.hand, side: setting.side, x: hold.x, y: hold.y, holdId: hold.id, travel: null };
        });
        model.body = { ...GameEditorRoute.spawn, vx: 0, vy: 0, tilt: 0 };
        model.selected = null;
        model.drag = null;
        model.stamina = 100;
        model.camera = GameEditorRoute.height - GameEditorRoute.viewHeight;
        model.peak = GameEditorRoute.startHeight;
        model.moves = 0;
        model.elapsed = 0;
        model.time = 0;
        model.fallAge = 0;
        model.balanceX = 0;
        model.hasRun = true;
        model.failReason = '';
        model.message = '';
        model.messageAge = 0;
        return true;
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
        return this.ent.model.infiniteStamina ? 0 : GameEditorRoute.get().drain[this.supportCount()] || 0;
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
        const setting = GameEditorRoute.get();
        return this.ent.model.getLimb(id).hand ? setting.arm : setting.leg;
    }

    /** 判断指定肢体 id 能否抓住 hold，包括距离、独占、破碎和终点限制。 */
    canReach(id: LimbId, hold: ClimbHold) {
        const model = this.ent.model;
        const limb = model.getLimb(id);
        if (model.state !== ClimbState.Playing || hold.broken || limb.travel || (!limb.hand && GameEditorRoute.isFinish(hold.type))) {
            return false;
        }
        return !this.holderOf(hold.id, id) && this.distance(this.rootOf(id), hold) <= this.maxReach(id) + 2;
    }

    /** 获取目标 point 附近可达岩点，id 用于距离与占用判断。 */
    findHold(id: LimbId, point: ClimbPoint) {
        let nearest: ClimbHold | null = null;
        let distance = GameEditorRoute.snapRange;
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
        if (hold.type === HoldTypeKindEnum.Danger) {
            this.showMessage('易碎岩点开始倒计时，尽快转移');
        }
        if (GameEditorRoute.isFinish(hold.type)) {
            this.showMessage('抓住终点！另一只手需要抓住另一个金色终点');
        }
        const hands = model.limbs.filter((item) => {
            return item.hand;
        });
        const finished = [HoldTypeKindEnum.FinishLeft, HoldTypeKindEnum.FinishRight].every((type) => {
            return hands.some((hand) => {
                return model.holds.some((item) => {
                    return item.id === hand.holdId && item.type === type;
                });
            });
        });
        if (finished) {
            model.state = ClimbState.Won;
            model.status = '试爬登顶成功，可返回编辑继续调整路线';
            model.peak = GameEditorRoute.finishHeight;
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
            return this.distance(item, point) < GameEditorRoute.snapRange;
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
        limb.y = this.clamp(root.y + (point.y - root.y) * factor, 170, GameEditorRoute.height - 177);
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
        if (!this.ent.model.editing) {
            this.ent.model.status = message;
        }
    }

    /** 触发坠落，reason 说明双手失去支撑或体力耗尽。 */
    private fail(reason: string) {
        const model = this.ent.model;
        if (model.state !== ClimbState.Playing) {
            return;
        }
        model.state = ClimbState.Falling;
        model.failReason = reason;
        model.status = `试爬失败：${reason}，可重开或返回编辑`;
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
        if (this.ent.model.infiniteStamina) {
            this.ent.model.stamina = 100;
        }
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
        const target = this.clamp(model.body.y - GameEditorRoute.viewHeight * 0.67, 0, GameEditorRoute.height - GameEditorRoute.viewHeight);
        model.camera += (target - model.camera) * Math.min(1, step * 4.8);
    }

    /** 更新已占用易碎点的剩余寿命，dt 为模拟步长。 */
    private updateHolds(dt: number) {
        const model = this.ent.model;
        for (const hold of model.holds) {
            if (model.state !== ClimbState.Playing) {
                return;
            }
            if (hold.type !== HoldTypeKindEnum.Danger || hold.broken) {
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
        const targetY = this.clamp(y / weights + (this.handCount() === 1 ? 14 : 0), 250, GameEditorRoute.height - 200);
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
        body.y = this.clamp(body.y, 230, GameEditorRoute.height - 175);
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

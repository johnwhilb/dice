import { ShopEvent } from "../../shop/ShopEvent";
import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import type { Game } from "../Game";
import { GamePhase } from "../model/GameModel";

export class GameBll extends CCBusiness<Game> {
    /** 注册新局、读档、结算与出战成功后的流程事件。 */
    protected init() {
        this.on(ShopEvent.OpenShop, this.ent.showShop, this.ent);
        this.on(ShopEvent.RoundCompleted, this.ent.returnShop, this.ent);
        this.on(ShopEvent.OpenArena, this.ent.showArena, this.ent);
    }

    /** 界面加载成功后切换本局阶段，参数 phase 为商店或竞技场。 */
    setPhase(phase: GamePhase) {
        this.ent.GameModel.phase = phase;
    }

    /** 校验队伍并复制独立的竞技场队伍与初始位置，不改动商店中的角色。 */
    prepareArena() {
        const model = this.ent.GameModel;
        if (!this.ent.shop.ShopModel.team.length) {
            this.toast("shop_team_empty");
            return;
        }
        model.battleTeam = this.ent.shop.ShopModel.team.map((unit) => {
            return { ...unit };
        });
        model.poses = model.battleTeam.map((unit, index) => {
            return { x: -index * model.spacing, y: 0, angle: 0 };
        });
        model.history = model.poses.map((pose) => {
            return { ...pose };
        });
        model.heading = 0;
        model.targetHeading = 0;
        this.dispatchEvent(ShopEvent.OpenArena);
    }

    /** 根据竞技场局部坐标设置蛇头目标方向，参数 x/y 为触摸位置。 */
    steer(x: number, y: number) {
        const head = this.ent.GameModel.poses[0];
        if (head) {
            this.ent.GameModel.targetHeading = Math.atan2(y - head.y, x - head.x);
        }
    }

    /** 更新蛇头移动、边界反弹和按历史路程跟随的蛇身。参数 deltaTime 为帧间隔秒数。 */
    updateMovement(deltaTime: number) {
        const model = this.ent.GameModel;
        const head = model.poses[0];
        if (model.phase !== GamePhase.Arena || !head) {
            return;
        }
        const delta = Math.min(deltaTime, 0.05);
        const difference = Math.atan2(
            Math.sin(model.targetHeading - model.heading),
            Math.cos(model.targetHeading - model.heading)
        );
        model.heading += Math.max(-model.turnSpeed * delta, Math.min(model.turnSpeed * delta, difference));
        head.x += Math.cos(model.heading) * model.speed * delta;
        head.y += Math.sin(model.heading) * model.speed * delta;
        const halfWidth = model.arenaWidth / 2 - model.spacing / 2;
        const halfHeight = model.arenaHeight / 2 - model.spacing / 2;
        if (Math.abs(head.x) > halfWidth) {
            head.x = Math.max(-halfWidth, Math.min(halfWidth, head.x));
            model.heading = Math.PI - model.heading;
            model.targetHeading = model.heading;
        }
        if (Math.abs(head.y) > halfHeight) {
            head.y = Math.max(-halfHeight, Math.min(halfHeight, head.y));
            model.heading = -model.heading;
            model.targetHeading = model.heading;
        }
        head.angle = (model.heading * 180) / Math.PI;
        if (!delta) {
            return;
        }
        model.history.unshift({ ...head });
        let distance = 0;
        let previous = model.history[0];
        let followerIndex = 1;
        const retained = [previous];
        for (const point of model.history.slice(1)) {
            const length = Math.hypot(point.x - previous.x, point.y - previous.y);
            while (followerIndex < model.poses.length && distance + length >= followerIndex * model.spacing) {
                if (!length) {
                    break;
                }
                const weight = (followerIndex * model.spacing - distance) / length;
                const follower = model.poses[followerIndex];
                follower.x = previous.x + (point.x - previous.x) * weight;
                follower.y = previous.y + (point.y - previous.y) * weight;
                follower.angle = (Math.atan2(previous.y - point.y, previous.x - point.x) * 180) / Math.PI;
                followerIndex += 1;
            }
            retained.push(point);
            distance += length;
            previous = point;
            if (distance > model.poses.length * model.spacing) {
                break;
            }
        }
        model.history = retained;
    }
}

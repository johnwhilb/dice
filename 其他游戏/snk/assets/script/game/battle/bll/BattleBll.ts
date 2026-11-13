import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import type { Battle } from '../Battle';
import { BattlePhase } from '../model/BattleModel';
import { TableRole } from '../../common/table/TableRole';
import { TableRoleLevel } from '../../common/table/TableRoleLevel';
import { TableShopRule } from '../../common/table/TableShopRule';

export class BattleBll extends CCBusiness<Battle> {
    /** 界面加载成功后切换本局阶段，参数 phase 为商店或竞技场。 */
    setPhase(phase: BattlePhase) {
        this.ent.BattleModel.phase = phase;
    }

    /** 根据开局配置创建新一局；配置不完整时返回提示键。 */
    newRun() {
        const rule = TableShopRule.getInitial();
        if (!rule || !rule.getInitialShopLevel() || !TableRoleLevel.getConfigByLevel(1)) {
            return 'shop_config_missing';
        }
        const offers = this.rollOffers();
        if (!offers.length) {
            return 'shop_config_missing';
        }
        const model = this.ent.BattleModel;
        model.reset();
        model.gold = rule.startingGold;
        model.offers = offers;
        return '';
    }

    /** 按阶级权重和可招募角色池生成商品，保证至少存在一名攻击角色。 */
    private rollOffers() {
        const rule = TableShopRule.getInitial();
        const weights = rule?.getInitialShopLevel()?.getTierWeights() || [];
        const pools = weights.map((weight, index) => {
            return { weight, roles: TableRole.getRecruitableByTier(index + 1) };
        }).filter((pool) => {
            return pool.weight > 0 && pool.roles.length > 0;
        });
        const total = pools.reduce((sum, pool) => {
            return sum + pool.weight;
        }, 0);
        const hasAttacker = pools.some((pool) => {
            return pool.roles.some((role) => {
                return role.canAttack;
            });
        });
        if (!rule || !total || (rule.requireAttacker && !hasAttacker)) {
            return [];
        }
        const pick = () => {
            let value = Math.random() * total;
            for (const pool of pools) {
                value -= pool.weight;
                if (value < 0) {
                    return pool.roles[Math.floor(Math.random() * pool.roles.length)]!;
                }
            }
            return pools[0]!.roles[0]!;
        };
        let roles = Array.from({ length: rule.cardSlots }, pick);
        let attempts = 0;
        while (rule.requireAttacker && roles.every((role) => {
            return !role.canAttack;
        })) {
            attempts += 1;
            if (attempts >= 64) {
                return [];
            }
            roles = Array.from({ length: rule.cardSlots }, pick);
        }
        return roles.map((role) => {
            return role.id;
        });
    }

    /** 刷新当前商店；仅在成功生成商品后扣除配置中的刷新费用。 */
    refreshOffers() {
        const model = this.ent.BattleModel;
        const rule = TableShopRule.getInitial();
        if (model.transitioning || model.phase !== BattlePhase.Shop || !rule) {
            return 'shop_config_missing';
        }
        if (model.gold < rule.refreshCost) {
            return 'shop_gold_missing';
        }
        const offers = this.rollOffers();
        if (!offers.length) {
            return 'shop_config_missing';
        }
        model.gold -= rule.refreshCost;
        model.offers = offers;
        return '';
    }

    /** 购买指定商品槽位；同角色计入储备，达到合成份数后升级。参数 index 为零起始槽位。 */
    buy(index: number) {
        const model = this.ent.BattleModel;
        const rule = TableShopRule.getInitial();
        const role = TableRole.getConfigById(model.offers[index] || 0);
        if (model.transitioning || model.phase !== BattlePhase.Shop || !role || !role.shopEnabled || !rule) {
            return 'shop_offer_missing';
        }
        if (model.gold < role.price) {
            return 'shop_gold_missing';
        }
        const owned = model.team.find((unit) => {
            return unit.roleId === role.id;
        });
        const levels = TableRoleLevel.getAllConfig().sort((left, right) => {
            return left.level - right.level;
        });
        const maxLevel = levels[levels.length - 1]?.level || 1;
        if (owned && owned.level >= maxLevel) {
            return 'shop_max_level';
        }
        if (!owned && model.team.length >= rule.baseTeamSize) {
            return 'shop_team_full';
        }
        model.gold -= role.price;
        model.offers[index] = 0;
        if (owned) {
            owned.copies += 1;
            owned.level = levels.filter((level) => {
                return owned.copies >= Math.pow(rule.copiesPerUpgrade, level.level - 1);
            }).length;
        }
        else {
            model.team.push({ roleId: role.id, level: 1, copies: 1 });
        }
        return '';
    }

    /** 计算整名角色及其储备的原版出售价格。参数 index 为队伍槽位。 */
    getSalePrice(index: number) {
        const unit = this.ent.BattleModel.team[index];
        const rule = TableShopRule.getInitial();
        if (!unit || !rule) {
            return 0;
        }
        const role = TableRole.getConfigById(unit.roleId);
        const level = TableRoleLevel.getConfigByLevel(unit.level);
        const reserve = unit.copies - Math.pow(rule.copiesPerUpgrade, unit.level - 1);
        const reserveLevel = TableRoleLevel.getConfigByLevel(2);
        const reserveValue = Math.floor(reserve / rule.copiesPerUpgrade) * (reserveLevel?.saleValueMultiplier || 0)
            + reserve % rule.copiesPerUpgrade;
        return (role?.price || 0) * ((level?.saleValueMultiplier || 0) + reserveValue);
    }

    /** 出售整个队伍槽位及其储备。参数 index 为零起始队伍槽位。 */
    sell(index: number) {
        const model = this.ent.BattleModel;
        if (model.transitioning || model.phase !== BattlePhase.Shop || !model.team[index]) {
            return 'shop_offer_missing';
        }
        model.gold += this.getSalePrice(index);
        model.team.splice(index, 1);
        return '';
    }

    /** 校验队伍并复制独立的竞技场队伍与初始位置，不改动商店中的角色。 */
    prepareArena() {
        const model = this.ent.BattleModel;
        if (!model.team.length) {
            return 'shop_team_empty';
        }
        model.battleTeam = model.team.map((unit) => {
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
        return '';
    }

    /** 根据竞技场局部坐标设置蛇头目标方向，参数 x/y 为触摸位置。 */
    steer(x: number, y: number) {
        const head = this.ent.BattleModel.poses[0];
        if (head) {
            this.ent.BattleModel.targetHeading = Math.atan2(y - head.y, x - head.x);
        }
    }

    /** 更新蛇头移动、边界反弹和按历史路程跟随的蛇身。参数 deltaTime 为帧间隔秒数。 */
    updateMovement(deltaTime: number) {
        const model = this.ent.BattleModel;
        const head = model.poses[0];
        if (model.phase !== BattlePhase.Arena || !head) {
            return;
        }
        const delta = Math.min(deltaTime, 0.05);
        const difference = Math.atan2(Math.sin(model.targetHeading - model.heading), Math.cos(model.targetHeading - model.heading));
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
        head.angle = model.heading * 180 / Math.PI;
        if (!delta) {
            return;
        }
        model.history.unshift({ ...head });
        let distance = 0;
        let previous = model.history[0]!;
        let followerIndex = 1;
        const retained = [previous];
        for (const point of model.history.slice(1)) {
            const length = Math.hypot(point.x - previous.x, point.y - previous.y);
            while (length > 0 && followerIndex < model.poses.length && distance + length >= followerIndex * model.spacing) {
                const weight = (followerIndex * model.spacing - distance) / length;
                const follower = model.poses[followerIndex]!;
                follower.x = previous.x + (point.x - previous.x) * weight;
                follower.y = previous.y + (point.y - previous.y) * weight;
                follower.angle = Math.atan2(previous.y - point.y, previous.x - point.x) * 180 / Math.PI;
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

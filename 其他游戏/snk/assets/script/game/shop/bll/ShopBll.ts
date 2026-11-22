import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import type { Shop } from "../Shop";
import { ShopEvent } from "../ShopEvent";
import { GamePhase } from "../../game/model/GameModel";
import { ShopModel } from "../model/ShopModel";
import type { IShopClassProgress, IShopSave } from "../model/ShopModel";
import type { IPlayerUnit } from "../../player/PlayerEvent";
import { oops } from "db://oops-framework/core/Oops";
import { TableRole } from "../../common/table/TableRole";
import { TableRoleLevel } from "../../common/table/TableRoleLevel";
import { TableShopRule } from "../../common/table/TableShopRule";
import { TableShopLevel } from "../../common/table/TableShopLevel";
import { TableShopContent } from "../../common/table/TableShopContent";
import { TableRoundReward } from "../../common/table/TableRoundReward";
import { RoleKeyEnum } from "../../common/table/RoleKeyEnum";
import { CommonStorageConfig } from "../../common/config/GameStorageConfig";
import { TableBattleRule } from "../../common/table/TableBattleRule";

export class ShopBll extends CCBusiness<Shop> {
    /** 根据开局配置创建新一局，restart 表示已在商店遮罩内重开。 */
    newRun(restart: boolean = false) {
        const rule = TableShopRule.getInitial();
        if (this.ent.game.GameModel.transitioning && !restart) {
            this.toast("shop_config_missing");
            return false;
        }
        const initialLevel = rule.getInitialShopLevel();
        const offers = this.rollOffers(initialLevel.level);
        if (!offers.length) {
            this.toast("shop_config_missing");
            return false;
        }
        const model = this.ent.ShopModel;
        const newGamePlus = model.newGamePlus;
        model.reset();
        if (!restart) {
            this.ent.game.GameModel.reset();
        }
        model.newGamePlus = newGamePlus;
        model.gold = rule.startingGold;
        model.shopLevel = initialLevel.level;
        model.shopXp = rule.initialShopXp;
        model.battleLevel = rule.initialBattleLevel;
        model.loop = rule.initialLoop;
        model.itemPool = TableShopContent.getItems().map((item) => {
            return item.id;
        });
        model.offers = offers;
        this.saveRun();
        this.dispatchEvent(ShopEvent.UpdateShopContent);
        if (!restart) {
            this.dispatchEvent(ShopEvent.OpenShop);
        }
        return true;
    }

    /** 按阶级权重和可招募角色池生成商品，保证至少存在一名攻击角色。 */
    private rollOffers(shopLevel: number = this.ent.ShopModel.shopLevel) {
        const rule = TableShopRule.getInitial();
        const weights = TableShopLevel.getConfigByLevel(shopLevel).getTierWeights();
        const pools = weights
            .map((weight, index) => {
                return { weight, roles: TableRole.getRecruitableByTier(index + 1) };
            })
            .filter((pool) => {
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
        if (!total || (rule.requireAttacker && !hasAttacker)) {
            return [];
        }
        const pick = () => {
            let value = Math.random() * total;
            for (const pool of pools) {
                value -= pool.weight;
                if (value < 0) {
                    return pool.roles[Math.floor(Math.random() * pool.roles.length)];
                }
            }
            return pools[0].roles[0];
        };
        let roles = Array.from({ length: rule.cardSlots }, pick);
        let attempts = 0;
        while (
            rule.requireAttacker &&
            roles.every((role) => {
                return !role.canAttack;
            })
        ) {
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
        const model = this.ent.ShopModel;
        const rule = TableShopRule.getInitial();
        if (this.ent.game.GameModel.transitioning || this.ent.game.GameModel.phase !== GamePhase.Shop) {
            this.toast("shop_config_missing");
            return;
        }
        if (model.gold < rule.refreshCost) {
            this.toast("shop_gold_missing");
            return;
        }
        const offers = this.rollOffers();
        if (!offers.length) {
            this.toast("shop_config_missing");
            return;
        }
        model.gold -= rule.refreshCost;
        model.offers = offers;
        this.saveRun();
        this.dispatchEvent(ShopEvent.ShowOfferRemoval);
        this.dispatchEvent(ShopEvent.UpdateShopContent);
    }

    /** 购买指定商品槽位；同角色计入储备，达到合成份数后升级。参数 index 为零起始槽位。 */
    buy(index: number) {
        const model = this.ent.ShopModel;
        const rule = TableShopRule.getInitial();
        const roleId = model.offers[index];
        if (!roleId) {
            this.toast("shop_config_missing");
            return;
        }
        const role = TableRole.getConfigById(roleId);
        if (
            this.ent.game.GameModel.transitioning ||
            this.ent.game.GameModel.phase !== GamePhase.Shop ||
            !role.shopEnabled
        ) {
            this.toast("shop_config_missing");
            return;
        }
        if (model.gold < role.price) {
            this.toast("shop_gold_missing");
            return;
        }
        const owned = model.team.find((unit) => {
            return unit.roleId === role.id;
        });
        const levels = TableRoleLevel.getAllConfig().sort((left, right) => {
            return left.level - right.level;
        });
        const maxLevel = levels[levels.length - 1].level;
        if (owned && owned.level >= maxLevel) {
            this.toast("shop_max_level");
            return;
        }
        if (!owned && model.team.length >= this.getTeamCapacity()) {
            this.toast("shop_team_full");
            return;
        }
        model.gold -= role.price;
        model.offers[index] = 0;
        if (owned) {
            owned.copies += 1;
            owned.level = levels.filter((level) => {
                return owned.copies >= Math.pow(rule.copiesPerUpgrade, level.level - 1);
            }).length;
        } else {
            model.team.push({ roleId: role.id, level: 1, copies: 1 });
        }
        this.saveRun();
        this.dispatchEvent(ShopEvent.ShowOfferRemoval, index);
        this.dispatchEvent(ShopEvent.UpdateShopContent);
    }

    /** 计算整名角色及其储备的原版出售价格。参数 index 为队伍槽位。 */
    getSalePrice(index: number) {
        const unit = this.ent.ShopModel.team[index];
        const rule = TableShopRule.getInitial();
        if (!unit) {
            return 0;
        }
        const role = TableRole.getConfigById(unit.roleId);
        const level = TableRoleLevel.getConfigByLevel(unit.level);
        const reserve = unit.copies - Math.pow(rule.copiesPerUpgrade, unit.level - 1);
        const reserveLevel = TableRoleLevel.getConfigByLevel(2);
        const reserveValue =
            Math.floor(reserve / rule.copiesPerUpgrade) * reserveLevel.saleValueMultiplier +
            (reserve % rule.copiesPerUpgrade);
        return role.price * (level.saleValueMultiplier + reserveValue);
    }

    /** 出售整个队伍槽位及其储备。参数 index 为零起始队伍槽位。 */
    sell(index: number) {
        const model = this.ent.ShopModel;
        if (
            this.ent.game.GameModel.transitioning ||
            this.ent.game.GameModel.phase !== GamePhase.Shop ||
            !model.team[index]
        ) {
            this.toast("shop_config_missing");
            return;
        }
        model.gold += this.getSalePrice(index);
        model.team.splice(index, 1);
        this.saveRun();
        this.dispatchEvent(ShopEvent.UpdateShopContent);
    }

    /** 获取当前难度和循环对应的队伍容量。 */
    getTeamCapacity() {
        const rule = TableShopRule.getInitial();
        const model = this.ent.ShopModel;
        return Math.min(
            rule.maxTeamSize,
            Math.max(
                rule.baseTeamSize,
                rule.baseTeamSize + model.newGamePlus * rule.teamSizePerNewGamePlus + model.loop
            )
        );
    }

    /** 返回一级与二级储备的数量，index 为队员下标。 */
    getReserves(index: number) {
        const unit = this.ent.ShopModel.team[index];
        const count = TableShopRule.getInitial().copiesPerUpgrade;
        const reserve = unit ? Math.max(0, unit.copies - Math.pow(count, unit.level - 1)) : 0;
        return { level1: reserve % count, level2: Math.floor(reserve / count) };
    }

    /** 出售一个储备，index 为队员下标，level 只能为一级或二级。 */
    sellReserve(index: number, level: number) {
        const model = this.ent.ShopModel;
        const unit = model.team[index];
        const reserves = this.getReserves(index);
        const count = level === 1 ? reserves.level1 : level === 2 ? reserves.level2 : 0;
        if (!unit || !count) {
            this.toast("shop_config_missing");
            return;
        }
        const role = TableRole.getConfigById(unit.roleId);
        const config = TableRoleLevel.getConfigByLevel(level);
        if (!this.canEditShop() || !unit || !count) {
            this.toast("shop_config_missing");
            return;
        }
        unit.copies -= Math.pow(TableShopRule.getInitial().copiesPerUpgrade, level - 1);
        model.gold += role.price * config.saleValueMultiplier;
        this.saveRun();
        this.dispatchEvent(ShopEvent.UpdateShopContent);
    }

    /** 按原版拖动交互交换队员，from 和 to 为队伍下标。 */
    moveUnit(from: number, to: number) {
        const team = this.ent.ShopModel.team;
        if (!this.canEditShop() || !team[from] || !team[to]) {
            this.toast("shop_config_missing");
            return;
        }
        const unit = team[from];
        team[from] = team[to];
        team[to] = unit;
        this.saveRun();
        this.dispatchEvent(ShopEvent.UpdateTeamOrder, from, to);
    }

    /** 切换商品整组锁定；手动刷新不受锁定限制，空槽位跨关保留。 */
    toggleLock() {
        const model = this.ent.ShopModel;
        const rule = TableShopRule.getInitial();
        if (!this.canEditShop()) {
            this.toast("shop_config_missing");
            return;
        }
        if (!model.locked && model.gold < rule.lockCost) {
            this.toast("shop_gold_missing");
            return;
        }
        if (!model.locked) {
            model.gold -= rule.lockCost;
        }
        model.locked = !model.locked;
        this.saveRun();
        this.dispatchEvent(ShopEvent.UpdateShopContent);
    }

    /** 购买一点商店经验，满级不扣费，现有商品不随等级变化。 */
    buyShopXp() {
        const model = this.ent.ShopModel;
        const rule = TableShopRule.getInitial();
        const level = TableShopLevel.getConfigByLevel(model.shopLevel);
        if (!this.canEditShop()) {
            this.toast("shop_config_missing");
            return;
        }
        if (!level.getNextLevel()) {
            return;
        }
        if (model.gold < rule.xpPurchaseCost) {
            this.toast("shop_gold_missing");
            return;
        }
        model.gold -= rule.xpPurchaseCost;
        this.gainShopXp();
        this.saveRun();
        this.dispatchEvent(ShopEvent.UpdateShopContent);
    }

    /** 按原版右键规则付费降一级商店，清空经验且不刷新商品。 */
    downgradeShop() {
        const model = this.ent.ShopModel;
        const rule = TableShopRule.getInitial();
        if (!this.canEditShop()) {
            this.toast("shop_config_missing");
            return;
        }
        if (model.shopLevel <= rule.getInitialShopLevel().level) {
            return;
        }
        if (model.gold < rule.downgradeCost) {
            this.toast("shop_gold_missing");
            return;
        }
        model.gold -= rule.downgradeCost;
        model.shopLevel -= 1;
        model.shopXp = 0;
        this.saveRun();
        this.dispatchEvent(ShopEvent.UpdateShopContent);
    }

    /** 依据 ShopLevel 表增加一点经验并在到达阈值时升级。 */
    private gainShopXp() {
        const model = this.ent.ShopModel;
        const config = TableShopLevel.getConfigByLevel(model.shopLevel);
        const next = config.getNextLevel();
        if (config && next) {
            model.shopXp += 1;
            if (model.shopXp >= config.xpToNextLevel) {
                model.shopLevel = next.level;
                model.shopXp = 0;
            }
        }
    }

    /** 统计不同队员贡献的职业人数、门槛和已激活档位，储备不重复计入。 */
    getClassProgress() {
        const classes = new Map<number, IShopClassProgress>();
        this.ent.ShopModel.team.forEach((unit) => {
            TableRole.getConfigById<TableRole>(unit.roleId)
                .getClasses()
                .forEach((roleClass) => {
                    if (!classes.has(roleClass.id)) {
                        classes.set(roleClass.id, {
                            classId: roleClass.id,
                            count: 0,
                            thresholds: roleClass.getActivationCounts(),
                            activeLevel: 0,
                        });
                    }
                    const progress = classes.get(roleClass.id);
                    progress.count += 1;
                    progress.activeLevel = progress.thresholds.filter((count) => {
                        return progress.count >= count;
                    }).length;
                    classes.set(roleClass.id, progress);
                });
        });
        return Array.from(classes.values()).sort((left, right) => {
            return left.classId - right.classId;
        });
    }

    /** 计算普通利息及商人额外利息，取结算前持有金币。 */
    getInterest() {
        const model = this.ent.ShopModel;
        const rule = TableShopRule.getInitial();
        const merchant = model.team.some((unit) => {
            return unit.roleId === RoleKeyEnum.Merchant;
        });
        return (
            Math.min(Math.floor(model.gold / rule.interestGoldStep), rule.interestCap) +
            (merchant ? Math.min(Math.floor(model.gold / rule.merchantGoldStep), rule.merchantInterestCap) : 0)
        );
    }

    /** 返回道具当前等级升级所需经验，index 为道具下标；不能升级时返回零。 */
    getItemXpNeeded(index: number) {
        const item = this.ent.ShopModel.items[index];
        if (!item) {
            return 0;
        }
        const content = TableShopContent.getConfigById(item.contentId);
        const rule = TableShopRule.getInitial();
        return item && content.canLevel
            ? item.level === 1
                ? rule.itemLevel1Xp
                : item.level === 2
                  ? rule.itemLevel2Xp
                  : 0
            : 0;
    }

    /** 购买一点道具经验，index 为道具下标；不可升级或已满级时不扣费。 */
    buyItemXp(index: number) {
        const model = this.ent.ShopModel;
        const item = model.items[index];
        const required = this.getItemXpNeeded(index);
        const rule = TableShopRule.getInitial();
        if (!this.canEditShop() || !item) {
            this.toast("shop_config_missing");
            return;
        }
        if (!required) {
            return;
        }
        if (model.gold < rule.itemXpCost) {
            this.toast("shop_gold_missing");
            return;
        }
        model.gold -= rule.itemXpCost;
        item.xp += 1;
        if (item.xp >= required) {
            item.level += 1;
            item.xp = 0;
        }
        this.saveRun();
        this.dispatchEvent(ShopEvent.UpdateShopContent);
    }

    /** 出售道具并放回本局奖池，index 为道具下标。 */
    sellItem(index: number) {
        const model = this.ent.ShopModel;
        const item = model.items[index];
        if (!this.canEditShop() || !item) {
            this.toast("shop_config_missing");
            return;
        }
        model.gold += item.level * TableShopRule.getInitial().itemSalePerLevel;
        model.itemPool.push(item.contentId);
        model.items.splice(index, 1);
        this.saveRun();
        this.dispatchEvent(ShopEvent.UpdateShopContent);
    }

    /** 由战斗奖励选择发放道具，contentId 必须来自当前本局奖池。 */
    gainItem(contentId: number) {
        const model = this.ent.ShopModel;
        const poolIndex = model.itemPool.indexOf(contentId);
        if (this.ent.game.GameModel.transitioning || poolIndex < 0) {
            this.toast("shop_config_missing");
            return;
        }
        model.itemPool.splice(poolIndex, 1);
        model.items.push({ contentId, level: 1, xp: 0 });
        this.saveRun();
        this.dispatchEvent(ShopEvent.UpdateShopContent);
    }

    /** 真正获胜后结算奖励、利息与自动经验，pickedUpGold 为战斗实际拾取金币；普通返回不调用。 */
    completeRound(pickedUpGold: number = 0) {
        const model = this.ent.ShopModel;
        const rule = TableShopRule.getInitial();
        if (
            this.ent.game.GameModel.transitioning ||
            this.ent.game.GameModel.phase !== GamePhase.Battle ||
            !Number.isInteger(pickedUpGold) ||
            pickedUpGold < 0
        ) {
            this.toast("shop_config_missing");
            return;
        }
        const round = ((model.battleLevel - 1) % rule.roundsPerLoop) + 1;
        const reward = TableRoundReward.getByLevel(round);
        if (!reward) {
            this.toast("shop_config_missing");
            return;
        }
        const oldLevel = model.shopLevel;
        const oldXp = model.shopXp;
        if (model.battleLevel % rule.autoXpRoundInterval === 0) {
            this.gainShopXp();
        }
        const offers = model.locked ? model.offers.slice() : this.rollOffers();
        if (!offers.length) {
            model.shopLevel = oldLevel;
            model.shopXp = oldXp;
            this.toast("shop_config_missing");
            return;
        }
        const gold = reward.minGold + Math.floor(Math.random() * (reward.maxGold - reward.minGold + 1));
        const roundGold = gold * Math.max(1, Math.floor(model.battleLevel / rule.roundsPerLoop));
        const interest = this.getInterest();
        model.gold += roundGold + pickedUpGold + interest;
        model.offers = offers;
        model.battleLevel = Math.min(model.battleLevel + 1, TableBattleRule.getCurrent().maxLevel);
        model.loop = Math.floor((model.battleLevel - 1) / rule.roundsPerLoop);
        this.saveRun();
        this.dispatchEvent(ShopEvent.UpdateShopContent);
        this.dispatchEvent(ShopEvent.RoundCompleted, { roundGold, pickedUpGold, interest });
    }

    /** 判断商店是否可交易，加载中及竞技场阶段禁止修改。 */
    private canEditShop() {
        return !this.ent.game.GameModel.transitioning && this.ent.game.GameModel.phase === GamePhase.Shop;
    }

    /** 保存本局快照，包含商品空位、队伍顺序、道具与奖池。 */
    saveRun() {
        const model = this.ent.ShopModel;
        const save: IShopSave = {
            version: ShopModel.saveVersion,
            gold: model.gold,
            offers: model.offers.slice(),
            team: model.team.map((unit) => {
                return { ...unit };
            }),
            items: model.items.map((item) => {
                return { ...item };
            }),
            itemPool: model.itemPool.slice(),
            shopLevel: model.shopLevel,
            shopXp: model.shopXp,
            battleLevel: model.battleLevel,
            loop: model.loop,
            newGamePlus: model.newGamePlus,
            locked: model.locked,
            goldFingerEnabled: model.goldFingerEnabled,
        };
        oops.storage.set(CommonStorageConfig.ShopRun, save);
    }

    /** 读取有效快照并恢复本局；缺失及结构错误时不修改当前状态。 */
    loadRun() {
        const data = oops.storage.getJson<IShopSave | null>(CommonStorageConfig.ShopRun, null);
        const rule = TableShopRule.getInitial();
        if (
            !data ||
            data.version !== ShopModel.saveVersion ||
            !Array.isArray(data.offers) ||
            data.offers.length > rule.cardSlots ||
            !Array.isArray(data.team) ||
            !Array.isArray(data.items) ||
            !Array.isArray(data.itemPool) ||
            typeof data.locked !== "boolean" ||
            ![data.gold, data.shopXp, data.loop, data.newGamePlus].every((value) => {
                return Number.isInteger(value) && value >= 0;
            }) ||
            !Number.isInteger(data.battleLevel) ||
            data.battleLevel < 1
        ) {
            this.toast("main_menu_save_unavailable");
            return;
        }
        const goldFingerEnabled = data.goldFingerEnabled === true;
        const shopLevel = TableShopLevel.getConfigByLevel(data.shopLevel);
        const capacity = Math.min(
            rule.maxTeamSize,
            rule.baseTeamSize + data.newGamePlus * rule.teamSizePerNewGamePlus + data.loop
        );
        const itemIds = TableShopContent.getItems().map((item) => {
            return item.id;
        });
        if (
            !shopLevel ||
            (shopLevel.getNextLevel() ? data.shopXp >= shopLevel.xpToNextLevel : data.shopXp !== 0) ||
            (!goldFingerEnabled && data.team.length > capacity) ||
            !data.offers.every((id) => {
                return id === 0 || !!TableRole.getConfigById(id).shopEnabled;
            }) ||
            !data.team.every((unit) => {
                return this.isValidUnit(unit, goldFingerEnabled);
            }) ||
            (!goldFingerEnabled && new Set(
                data.team.map((unit) => {
                    return unit.roleId;
                })
            ).size !== data.team.length) ||
            !data.items.every((item) => {
                const content = TableShopContent.getConfigById(item.contentId);
                const xpNeeded = item.level === 1 ? rule.itemLevel1Xp : item.level === 2 ? rule.itemLevel2Xp : 0;
                return (
                    !!item &&
                    itemIds.includes(item.contentId) &&
                    Number.isInteger(item.level) &&
                    item.level >= 1 &&
                    item.level <= 3 &&
                    (content.canLevel || item.level === 1) &&
                    Number.isInteger(item.xp) &&
                    item.xp >= 0 &&
                    (xpNeeded && content.canLevel ? item.xp < xpNeeded : item.xp === 0)
                );
            }) ||
            !data.itemPool.every((id) => {
                return itemIds.includes(id);
            })
        ) {
            this.toast("main_menu_save_unavailable");
            return;
        }
        const combinedIds = data.itemPool.concat(
            data.items.map((item) => {
                return item.contentId;
            })
        );
        if (combinedIds.length !== itemIds.length || new Set(combinedIds).size !== itemIds.length) {
            this.toast("main_menu_save_unavailable");
            return;
        }
        const model = this.ent.ShopModel;
        model.reset();
        this.ent.game.GameModel.reset();
        model.gold = data.gold;
        model.offers = Array.from({ length: rule.cardSlots }, (value, index) => {
            return data.offers[index] ?? 0;
        });
        model.team = data.team.map((unit) => {
            return { ...unit };
        });
        model.items = data.items.map((item) => {
            return { ...item };
        });
        model.itemPool = data.itemPool.slice();
        model.shopLevel = data.shopLevel;
        model.shopXp = data.shopXp;
        model.battleLevel = data.battleLevel;
        model.loop = data.loop;
        model.newGamePlus = data.newGamePlus;
        model.locked = data.locked;
        model.goldFingerEnabled = goldFingerEnabled;
        this.dispatchEvent(ShopEvent.UpdateShopContent);
        this.dispatchEvent(ShopEvent.OpenShop);
    }

    /** 校验存档队员 unit 的角色、等级与份数，goldFingerEnabled 允许配置中的非招募角色。 */
    private isValidUnit(unit: IPlayerUnit, goldFingerEnabled: boolean) {
        const rule = TableShopRule.getInitial();
        const maxLevel = Math.max(
            ...TableRoleLevel.getAllConfig<TableRoleLevel>().map((config) => {
                return config.level;
            })
        );
        return (
            !!unit &&
            (TableRole.getConfigById(unit.roleId).shopEnabled || goldFingerEnabled) &&
            !!TableRoleLevel.getConfigByLevel(unit.level) &&
            Number.isInteger(unit.copies) &&
            unit.copies >= Math.pow(rule.copiesPerUpgrade, unit.level - 1) &&
            (unit.level === maxLevel
                ? unit.copies === Math.pow(rule.copiesPerUpgrade, maxLevel - 1)
                : unit.copies < Math.pow(rule.copiesPerUpgrade, unit.level))
        );
    }
}

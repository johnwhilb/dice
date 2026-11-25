import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import type { Shop } from "../Shop";
import { ShopDeniedReason, ShopEvent, ShopSound } from "../ShopEvent";
import { ShopAudioBll } from "./ShopAudioBll";
import { GamePhase } from "../../game/model/GameModel";
import { ShopModel } from "../model/ShopModel";
import type { IShopClassProgress, IShopSave } from "../model/ShopModel";
import type { IPlayerUnit } from "../../player/PlayerEvent";
import { oops } from "db://oops-framework/core/Oops";
import { TableRole } from "../../common/table/TableRole";
import { TableRoleLevel } from "../../common/table/TableRoleLevel";
import { TableShopRule } from "../../common/table/TableShopRule";
import { TableShopHexRule } from "../../common/table/TableShopHexRule";
import { TableShopLevel } from "../../common/table/TableShopLevel";
import { TableShopContent } from "../../common/table/TableShopContent";
import { TableRoundReward } from "../../common/table/TableRoundReward";
import { RoleKeyEnum } from "../../common/table/RoleKeyEnum";
import { CommonStorageConfig } from "../../common/config/GameStorageConfig";
import { TableBattleRule } from "../../common/table/TableBattleRule";

export class ShopBll extends CCBusiness<Shop> {
    /** 返回商店音效业务实例。 */
    private get audio() {
        return this.ent.getBusiness<ShopAudioBll>(ShopAudioBll);
    }

    /** 计算指定角色商品 roleId 的可购性、是否已拥有、以及买下后是否触发合成升级。 */
    getOfferState(roleId: number) {
        const model = this.ent.ShopModel;
        const rule = TableShopRule.getInitial();
        const role = TableRole.getConfigById<TableRole>(roleId);
        const owned = model.team.find((unit) => {
            return unit.roleId === roleId;
        });
        const levels = TableRoleLevel.getAllConfig<TableRoleLevel>().sort((left, right) => {
            return left.level - right.level;
        });
        const maxLevel = levels[levels.length - 1].level;
        const isMaxLevel = !!owned && owned.level >= maxLevel;
        const teamFull = !owned && model.team.length >= this.getTeamCapacity();
        const canAfford = model.gold >= role.price;
        let nextLevel = 1;
        let willUpgrade = false;
        if (owned && !isMaxLevel) {
            const nextCopies = owned.copies + 1;
            nextLevel = levels.filter((level) => {
                return nextCopies >= Math.pow(rule.copiesPerUpgrade, level.level - 1);
            }).length;
            willUpgrade = nextLevel > owned.level;
        }
        return { owned: !!owned, nextLevel, willUpgrade, isMaxLevel, teamFull, canAfford };
    }

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
            this.audio.play(ShopSound.Error);
            this.dispatchEvent(ShopEvent.ActionDenied, ShopDeniedReason.GoldMissing);
            return;
        }
        const offers = this.rollOffers();
        if (!offers.length) {
            this.toast("shop_config_missing");
            return;
        }
        model.gold -= rule.refreshCost;
        model.offers = offers;
        this.audio.play(ShopSound.Refresh);
        this.dispatchEvent(ShopEvent.ShowOfferRemoval);
        this.dispatchEvent(ShopEvent.GoldChanged, -rule.refreshCost);
        this.dispatchEvent(ShopEvent.UpdateShopContent);
        this.dispatchEvent(ShopEvent.OffersRefreshed);
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
            this.audio.play(ShopSound.Error);
            this.dispatchEvent(ShopEvent.ActionDenied, ShopDeniedReason.GoldMissing);
            return;
        }
        const ownedIndex = model.team.findIndex((unit) => {
            return unit.roleId === role.id;
        });
        const owned = ownedIndex >= 0 ? model.team[ownedIndex] : undefined;
        const levels = TableRoleLevel.getAllConfig().sort((left, right) => {
            return left.level - right.level;
        });
        const maxLevel = levels[levels.length - 1].level;
        if (owned && owned.level >= maxLevel) {
            this.toast("shop_max_level");
            this.audio.play(ShopSound.Error);
            this.dispatchEvent(ShopEvent.ActionDenied, ShopDeniedReason.MaxLevel);
            return;
        }
        if (!owned && model.team.length >= this.getTeamCapacity()) {
            this.toast("shop_team_full");
            this.audio.play(ShopSound.Error);
            this.dispatchEvent(ShopEvent.ActionDenied, ShopDeniedReason.TeamFull);
            return;
        }
        model.gold -= role.price;
        model.offers[index] = 0;
        let teamIndex = ownedIndex;
        let newLevel = 1;
        let upgraded = false;
        if (owned) {
            const oldLevel = owned.level;
            owned.copies += 1;
            owned.level = levels.filter((level) => {
                return owned.copies >= Math.pow(rule.copiesPerUpgrade, level.level - 1);
            }).length;
            newLevel = owned.level;
            upgraded = newLevel > oldLevel;
        } else {
            model.team.push({ roleId: role.id, level: 1, copies: 1 });
            teamIndex = model.team.length - 1;
        }
        this.audio.play(ShopSound.Buy);
        this.dispatchEvent(ShopEvent.ShowOfferRemoval, index);
        this.dispatchEvent(ShopEvent.GoldChanged, -role.price);
        this.dispatchEvent(ShopEvent.UpdateShopContent);
        this.dispatchEvent(ShopEvent.UnitBought, { teamIndex, roleId: role.id, level: newLevel, upgraded });
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

    /** 出售整个队伍槽位及其储备，index 为零起始队伍槽位，返回是否出售成功。 */
    sell(index: number) {
        const model = this.ent.ShopModel;
        if (
            this.ent.game.GameModel.transitioning ||
            this.ent.game.GameModel.phase !== GamePhase.Shop ||
            !model.team[index]
        ) {
            this.toast("shop_config_missing");
            return false;
        }
        const gain = this.getSalePrice(index);
        model.gold += gain;
        model.team.splice(index, 1);
        this.audio.play(ShopSound.Sell);
        this.dispatchEvent(ShopEvent.GoldChanged, gain);
        this.dispatchEvent(ShopEvent.UpdateShopContent);
        return true;
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

    /** 出售一个储备，index 为队员下标，level 只能为一级或二级，返回是否出售成功。 */
    sellReserve(index: number, level: number) {
        const model = this.ent.ShopModel;
        const unit = model.team[index];
        const reserves = this.getReserves(index);
        const count = level === 1 ? reserves.level1 : level === 2 ? reserves.level2 : 0;
        if (!this.canEditShop() || !unit || !count) {
            this.toast("shop_config_missing");
            return false;
        }
        const role = TableRole.getConfigById(unit.roleId);
        const config = TableRoleLevel.getConfigByLevel(level);
        unit.copies -= Math.pow(TableShopRule.getInitial().copiesPerUpgrade, level - 1);
        const gain = role.price * config.saleValueMultiplier;
        model.gold += gain;
        this.audio.play(ShopSound.Sell);
        this.dispatchEvent(ShopEvent.GoldChanged, gain);
        this.dispatchEvent(ShopEvent.UpdateShopContent);
        return true;
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
            this.audio.play(ShopSound.Error);
            this.dispatchEvent(ShopEvent.ActionDenied, ShopDeniedReason.GoldMissing);
            return;
        }
        let delta = 0;
        if (!model.locked) {
            model.gold -= rule.lockCost;
            delta = -rule.lockCost;
        }
        model.locked = !model.locked;
        this.audio.play(ShopSound.Lock);
        if (delta !== 0) {
            this.dispatchEvent(ShopEvent.GoldChanged, delta);
        }
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
            this.audio.play(ShopSound.Error);
            this.dispatchEvent(ShopEvent.ActionDenied, ShopDeniedReason.GoldMissing);
            return;
        }
        const oldLevel = model.shopLevel;
        model.gold -= rule.xpPurchaseCost;
        this.gainShopXp();
        const leveledUp = model.shopLevel > oldLevel;
        this.audio.play(ShopSound.Experience);
        this.dispatchEvent(ShopEvent.GoldChanged, -rule.xpPurchaseCost);
        this.dispatchEvent(ShopEvent.UpdateShopContent);
        this.dispatchEvent(ShopEvent.ShopLevelChanged, { level: model.shopLevel, leveledUp, downgraded: false });
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
            this.audio.play(ShopSound.Error);
            this.dispatchEvent(ShopEvent.ActionDenied, ShopDeniedReason.GoldMissing);
            return;
        }
        model.gold -= rule.downgradeCost;
        model.shopLevel -= 1;
        model.shopXp = 0;
        this.audio.play(ShopSound.Experience);
        this.dispatchEvent(ShopEvent.GoldChanged, -rule.downgradeCost);
        this.dispatchEvent(ShopEvent.UpdateShopContent);
        this.dispatchEvent(ShopEvent.ShopLevelChanged, { level: model.shopLevel, leveledUp: false, downgraded: true });
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

    /** 拼装指定槽位被动道具的详情描述文本，index 为道具下标；不存在时返回空字符串。 */
    getItemTooltipText(index: number) {
        const item = this.ent.ShopModel.items[index];
        if (!item) {
            return "";
        }
        const content = TableShopContent.getConfigById<TableShopContent>(item.contentId);
        const required = this.getItemXpNeeded(index);
        const rule = TableShopRule.getInitial();
        const xpInfo = required
            ? `，经验 [yellow]${item.xp}/${required}[fg]，每点经验 [yellow]${rule.itemXpCost}[fg] 金币`
            : content.canLevel
              ? "，[yellow]已满级[fg]"
              : "";
        return `${content.name} · [yellow]${item.level}[fg]级${xpInfo}\n${content.getDescription(item.level)}\n[fg]售价：[yellow]${item.level * rule.itemSalePerLevel}[fg] 金币`;
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
            this.audio.play(ShopSound.Error);
            this.dispatchEvent(ShopEvent.ActionDenied, ShopDeniedReason.GoldMissing);
            return;
        }
        model.gold -= rule.itemXpCost;
        item.xp += 1;
        let leveledUp = false;
        if (item.xp >= required) {
            item.level += 1;
            item.xp = 0;
            leveledUp = true;
        }
        this.audio.play(ShopSound.Experience);
        if (leveledUp) {
            this.audio.play(item.level >= 3 ? ShopSound.MaxUpgrade : ShopSound.Upgrade);
        }
        this.dispatchEvent(ShopEvent.GoldChanged, -rule.itemXpCost);
        this.dispatchEvent(ShopEvent.UpdateShopContent);
        this.dispatchEvent(ShopEvent.ItemUpgraded, { index, level: item.level, leveledUp });
    }

    /** 出售道具并放回本局奖池，index 为道具下标。 */
    sellItem(index: number) {
        const model = this.ent.ShopModel;
        const item = model.items[index];
        if (!this.canEditShop() || !item) {
            this.toast("shop_config_missing");
            return false;
        }
        const gain = item.level * TableShopRule.getInitial().itemSalePerLevel;
        model.gold += gain;
        model.itemPool.push(item.contentId);
        model.items.splice(index, 1);
        this.audio.play(ShopSound.Sell);
        this.dispatchEvent(ShopEvent.GoldChanged, gain);
        this.dispatchEvent(ShopEvent.UpdateShopContent);
        return true;
    }

    /** 从本局奖池抽取 count 个候选道具，excluded 为本次抽取应排除的道具 ID。 */
    private drawHexCandidates(count: number, excluded: readonly number[] = []) {
        const pool = this.ent.ShopModel.itemPool.filter((contentId) => {
            return !excluded.includes(contentId);
        });
        const candidates: number[] = [];
        while (candidates.length < count && pool.length) {
            const index = Math.floor(Math.random() * pool.length);
            const [contentId] = pool.splice(index, 1);
            candidates.push(contentId);
        }
        return candidates;
    }

    /** 返回槽位 index 的刷新费用，优先使用该槽位或本轮共享的免费资格。 */
    getHexRerollCost(index: number) {
        const reward = this.ent.ShopModel.hexReward;
        return reward?.slotFreeRerolls?.[index] || reward?.freeReroll ? 0 : TableShopHexRule.getCurrent().rerollCost;
    }

    /** 判断奖池中是否有当前候选以外的强化可用于刷新。 */
    hasHexRerollCandidate() {
        const model = this.ent.ShopModel;
        const reward = model.hexReward;
        return !!reward && model.itemPool.some((contentId) => {
            return !reward.candidates.includes(contentId);
        });
    }

    /** 替换槽位 index 当前显示的强化，成功后结算费用并保存。 */
    rerollHexReward(index: number, contentId: number) {
        const model = this.ent.ShopModel;
        const hexReward = model.hexReward;
        if (!hexReward || !contentId || hexReward.candidates[index] !== contentId || this.ent.game.GameModel.transitioning) {
            return;
        }
        const cost = this.getHexRerollCost(index);
        if (model.gold < cost) {
            this.toast("shop_gold_missing");
            this.audio.play(ShopSound.Error);
            return;
        }
        const [replacement] = this.drawHexCandidates(1, hexReward.candidates);
        if (!replacement) {
            return;
        }
        hexReward.candidates[index] = replacement;
        if (hexReward.slotFreeRerolls?.[index]) {
            hexReward.slotFreeRerolls[index] = false;
        } else {
            hexReward.freeReroll = false;
        }
        model.gold -= cost;
        this.audio.play(ShopSound.Refresh);
        this.dispatchEvent(ShopEvent.UpdateHexReward, index);
        if (cost > 0) {
            this.dispatchEvent(ShopEvent.GoldChanged, -cost);
        }
    }

    /** 领取候选中的一级被动道具，contentId 为选中的道具 ID。 */
    selectHexReward(contentId: number) {
        const model = this.ent.ShopModel;
        if (this.ent.game.GameModel.transitioning || !model.hexReward?.candidates.includes(contentId)) {
            return;
        }
        const poolIndex = model.itemPool.indexOf(contentId);
        if (poolIndex < 0) {
            return;
        }
        model.itemPool.splice(poolIndex, 1);
        model.items.push({ contentId, level: 1, xp: 0 });
        model.hexReward = undefined;
        this.audio.play(ShopSound.Buy);
        this.dispatchEvent(ShopEvent.UpdateShopContent);
        this.dispatchEvent(ShopEvent.HexRewardSelected);
    }

    /** 真正获胜后结算奖励、利息与自动经验，pickedUpGold 为战斗实际拾取金币；普通返回不调用。 */
    completeRound(pickedUpGold: number = 0) {
        const model = this.ent.ShopModel;
        const rule = TableShopRule.getInitial();
        if (
            this.ent.game.GameModel.transitioning ||
            this.ent.game.GameModel.phase !== GamePhase.Battle ||
            model.hexReward ||
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
        const hexRule = TableShopHexRule.getCurrent();
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
        if (hexRule.triggerRounds.includes(round) && model.items.length < hexRule.ownedLimit && model.itemPool.length) {
            const merchantFreeRerolls = model.team.some((unit) => {
                return unit.roleId === RoleKeyEnum.Merchant && unit.level === hexRule.merchantFreeRerollLevel;
            });
            const candidates = this.drawHexCandidates(hexRule.candidateCount);
            model.hexReward = {
                candidates,
                freeReroll: !merchantFreeRerolls && model.battleLevel === hexRule.freeRerollStage,
                slotFreeRerolls: candidates.map(() => {
                    return merchantFreeRerolls;
                }),
            };
        }
        model.gold += roundGold + pickedUpGold + interest;
        model.offers = offers;
        model.battleLevel = Math.min(model.battleLevel + 1, TableBattleRule.getCurrent().maxLevel);
        model.loop = Math.floor((model.battleLevel - 1) / rule.roundsPerLoop);
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
            hexReward: model.hexReward,
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

    /** 判断最近的本地存档是否能恢复到商店或海克斯选择。 */
    static hasSavedRun() {
        return !!this.getSavedRun();
    }

    /** 读取并校验本地存档，缺失或无效时返回空值。 */
    private static getSavedRun() {
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
            return null;
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
                return id === 0 || !!TableRole.getConfigById(id)?.shopEnabled;
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
                if (!item || !itemIds.includes(item.contentId)) {
                    return false;
                }
                const content = TableShopContent.getConfigById(item.contentId);
                const xpNeeded = item.level === 1 ? rule.itemLevel1Xp : item.level === 2 ? rule.itemLevel2Xp : 0;
                return (
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
            return null;
        }
        const combinedIds = data.itemPool.concat(
            data.items.map((item) => {
                return item.contentId;
            })
        );
        const hexReward = data.hexReward;
        if (
            combinedIds.length !== itemIds.length ||
            new Set(combinedIds).size !== itemIds.length ||
            (hexReward !== undefined && (
                !hexReward ||
                typeof hexReward.freeReroll !== "boolean" ||
                !Array.isArray(hexReward.candidates) ||
                !hexReward.candidates.length ||
                (hexReward.slotFreeRerolls !== undefined && (
                    !Array.isArray(hexReward.slotFreeRerolls) ||
                    hexReward.slotFreeRerolls.length !== hexReward.candidates.length ||
                    !hexReward.slotFreeRerolls.every((available) => {
                        return typeof available === "boolean";
                    })
                )) ||
                new Set(hexReward.candidates).size !== hexReward.candidates.length ||
                !hexReward.candidates.every((id) => {
                    return data.itemPool.includes(id);
                })
            ))
        ) {
            return null;
        }
        return data;
    }

    /** 恢复最近一次有效快照并通知游戏进入相应界面。 */
    loadRun() {
        const data = ShopBll.getSavedRun();
        if (!data) {
            this.toast("main_menu_save_unavailable");
            return;
        }
        const rule = TableShopRule.getInitial();
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
        const hexReward = data.hexReward;
        if (hexReward) {
            const hexRule = TableShopHexRule.getCurrent();
            const candidates = hexReward.candidates.slice(0, hexRule.candidateCount);
            const legacyMerchantFreeRerolls = !hexReward.slotFreeRerolls && hexReward.freeReroll && model.team.some((unit) => {
                return unit.roleId === RoleKeyEnum.Merchant && unit.level === hexRule.merchantFreeRerollLevel;
            });
            model.hexReward = {
                candidates,
                freeReroll: hexReward.freeReroll && !legacyMerchantFreeRerolls,
                slotFreeRerolls: candidates.map((contentId, index) => {
                    return hexReward.slotFreeRerolls?.[index] ?? legacyMerchantFreeRerolls;
                }),
            };
        }
        model.shopLevel = data.shopLevel;
        model.shopXp = data.shopXp;
        model.battleLevel = data.battleLevel;
        model.loop = data.loop;
        model.newGamePlus = data.newGamePlus;
        model.locked = data.locked;
        model.goldFingerEnabled = data.goldFingerEnabled === true;
        this.dispatchEvent(ShopEvent.UpdateShopContent);
        this.dispatchEvent(ShopEvent.OpenShop);
    }

    /** 校验存档队员 unit 的角色、等级与份数，goldFingerEnabled 允许配置中的非招募角色。 */
    private static isValidUnit(unit: IPlayerUnit, goldFingerEnabled: boolean) {
        if (!unit) {
            return false;
        }
        const role = TableRole.getConfigById(unit.roleId);
        const rule = TableShopRule.getInitial();
        const maxLevel = Math.max(
            ...TableRoleLevel.getAllConfig<TableRoleLevel>().map((config) => {
                return config.level;
            })
        );
        return (
            !!role &&
            (role.shopEnabled || goldFingerEnabled) &&
            !!TableRoleLevel.getConfigByLevel(unit.level) &&
            Number.isInteger(unit.copies) &&
            unit.copies >= Math.pow(rule.copiesPerUpgrade, unit.level - 1) &&
            (unit.level === maxLevel
                ? unit.copies === Math.pow(rule.copiesPerUpgrade, maxLevel - 1)
                : unit.copies < Math.pow(rule.copiesPerUpgrade, unit.level))
        );
    }
}

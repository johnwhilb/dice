import { oops } from "db://oops-framework/core/Oops";
import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import { lang } from "../../common/Language";
import { TableRole } from "../../common/table/TableRole";
import { TableRoleLevel } from "../../common/table/TableRoleLevel";
import { TableShopContent } from "../../common/table/TableShopContent";
import { TableShopRule } from "../../common/table/TableShopRule";
import { RoleLevelKeyEnum } from "../../common/table/RoleLevelKeyEnum";
import { BattleState } from "../../battle/BattleEvent";
import { TableBattleStage } from "../../common/table/TableBattleStage";
import { TableBattleRule } from "../../common/table/TableBattleRule";
import { GamePhase } from "../../game/model/GameModel";
import { PlayerBll } from "../../player/bll/PlayerBll";
import type { IPlayerUnit } from "../../player/PlayerEvent";
import { ShopEvent } from "../../shop/ShopEvent";
import type { GoldFinger } from "../GoldFinger";
import { GoldFingerEvent } from "../GoldFingerEvent";
import { GoldFingerView } from "../view/GoldFingerView";

export class GoldFingerBll extends CCBusiness<GoldFinger> {
    /** 显示本局悬浮入口，首次显示时等待框架加载预制体，完成后通过事件刷新。 */
    show() {
        const model = this.ent.GoldFingerModel;
        model.visible = true;
        if (this.ent.has(GoldFingerView)) {
            this.dispatchEvent(GoldFingerEvent.UpdatePanel);
            return;
        }
        if (model.opening) {
            return;
        }
        model.opening = true;
        this.ent.addPrefab(GoldFingerView, oops.gui.guide, "gui/goldFinger/GoldFingerView").then(() => {
            model.opening = false;
            this.dispatchEvent(GoldFingerEvent.UpdatePanel);
        }, () => {
            model.opening = false;
            oops.gui.toast(lang("shop_load_failed"));
        });
    }

    /** 返回主菜单时隐藏悬浮入口并关闭面板，保留拖动位置。 */
    hide() {
        const model = this.ent.GoldFingerModel;
        model.visible = false;
        model.panelOpen = false;
        this.dispatchEvent(GoldFingerEvent.UpdatePanel);
    }

    /** 切换金手指面板状态，open 为是否打开。 */
    setPanelOpen(open: boolean) {
        this.ent.GoldFingerModel.panelOpen = open;
        this.ent.GoldFingerModel.message = "";
        this.dispatchEvent(GoldFingerEvent.UpdatePanel);
    }

    /** 将输入 text 作为正整数金币数量加入本局，并通知商店刷新。 */
    addGold(text: string) {
        if (this.ent.game.GameModel.transitioning) {
            this.setMessage("界面切换中，请稍后操作");
            return;
        }
        const value = text.trim();
        const amount = Number(value);
        const shop = this.ent.game.shop;
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(shop.ShopModel.gold + amount)) {
            this.setMessage("请输入有效的正整数金币数量");
            return;
        }
        shop.ShopModel.gold += amount;
        this.dispatchEvent(ShopEvent.UpdateShopContent);
        this.setMessage(`已增加 ${amount} 金币`);
    }

    /** 将输入 text 对应的角色配置以一级追加至队尾，允许重复和超员，战场中同步追加。 */
    addRole(text: string) {
        const game = this.ent.game;
        if (game.GameModel.transitioning) {
            this.setMessage("界面切换中，请稍后操作");
            return;
        }
        const value = text.trim();
        const roleId = Number(value);
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(roleId)) {
            this.setMessage("请输入有效的角色配置 ID");
            return;
        }
        const role = TableRole.getConfigById<TableRole>(roleId);
        if (!role) {
            this.setMessage(`角色配置 ID ${roleId} 不存在`);
            return;
        }
        const level = TableRoleLevel.getConfigById(RoleLevelKeyEnum.Level1);
        const unit: IPlayerUnit = {
            roleId: role.id,
            level: level.level,
            copies: Math.pow(TableShopRule.getInitial().copiesPerUpgrade, level.level - 1),
        };
        if (game.GameModel.phase === GamePhase.Battle) {
            game.player.getBusiness<PlayerBll>(PlayerBll).append(unit);
        }
        game.shop.ShopModel.team.push(unit);
        game.shop.ShopModel.goldFingerEnabled = true;
        this.dispatchEvent(ShopEvent.UpdateShopContent);
        this.setMessage(`已在队尾加入 ${role.name}（${role.id}）`);
    }

    /** 保留原有队员并全部升满，从可招募角色中不重复地随机补齐初始队伍容量。 */
    maxTeam() {
        const game = this.ent.game;
        if (game.GameModel.transitioning) {
            this.setMessage("界面切换中，请稍后操作");
            return;
        }

        const shop = game.shop;
        const model = shop.ShopModel;
        const rule = TableShopRule.getInitial();
        const level = Math.max(...TableRoleLevel.getAllConfig<TableRoleLevel>().map((config) => {
            return config.level;
        }));
        if (!Number.isFinite(level)) {
            throw new Error("角色等级配置缺失");
        }
        const copies = Math.pow(rule.copiesPerUpgrade, level - 1);
        const team = model.team.map((unit) => {
            return { roleId: unit.roleId, level, copies };
        });
        const ownedRoles = new Set(team.map((unit) => {
            return unit.roleId;
        }));
        const pool = TableRole.getAllConfig<TableRole>().filter((role) => {
            return role.shopEnabled && !ownedRoles.has(role.id);
        });
        if (team.length + pool.length < rule.baseTeamSize) {
            this.setMessage("可招募角色不足，无法补齐队伍");
            return;
        }
        while (team.length < rule.baseTeamSize) {
            const index = Math.floor(Math.random() * pool.length);
            const [role] = pool.splice(index, 1);
            team.push({ roleId: role.id, level, copies });
        }

        model.team = team;
        model.goldFingerEnabled = true;
        const state = game.battle.BattleModel.state;
        if (game.GameModel.phase === GamePhase.Battle && (state === BattleState.Countdown || state === BattleState.Running)) {
            game.player.getBusiness<PlayerBll>(PlayerBll).upgradeTeam(team);
        }
        this.dispatchEvent(ShopEvent.UpdateShopContent);
        this.setMessage(`已将 ${team.length} 名队员升至 ${level} 级`);
    }

    /** 将输入 text 对应的海克斯配置加入本局；已拥有且可升级时直接升一级，并同步维护奖池与待选海克斯。 */
    addHex(text: string) {
        const game = this.ent.game;
        if (game.GameModel.transitioning) {
            this.setMessage("界面切换中，请稍后操作");
            return;
        }
        const value = text.trim();
        const contentId = Number(value);
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(contentId)) {
            this.setMessage("请输入有效的海克斯配置 ID");
            return;
        }
        const content = TableShopContent.getConfigById<TableShopContent>(contentId);
        if (!content || content.roleId || content.classId) {
            this.setMessage(`海克斯配置 ID ${contentId} 不存在`);
            return;
        }
        if (!content.enabled) {
            this.setMessage(`海克斯 ${content.name}（${content.id}）未启用`);
            return;
        }
        const shop = game.shop;
        const model = shop.ShopModel;
        const existingIndex = model.items.findIndex((item) => {
            return item.contentId === content.id;
        });
        if (existingIndex >= 0) {
            const existing = model.items[existingIndex];
            if (!content.canLevel) {
                this.setMessage(`海克斯 ${content.name}（${content.id}）已拥有且不可升级`);
                return;
            }
            if (existing.level >= 3) {
                this.setMessage(`海克斯 ${content.name}（${content.id}）已达满级`);
                return;
            }
            existing.level += 1;
            existing.xp = 0;
            model.goldFingerEnabled = true;
            this.dispatchEvent(ShopEvent.UpdateShopContent);
            this.dispatchEvent(ShopEvent.ItemUpgraded, {
                index: existingIndex,
                level: existing.level,
                leveledUp: true,
            });
            this.setMessage(`已将海克斯 ${content.name}（${content.id}）升至 ${existing.level} 级`);
            return;
        }

        const poolIndex = model.itemPool.indexOf(content.id);
        if (poolIndex >= 0) {
            model.itemPool.splice(poolIndex, 1);
        }
        model.items.push({ contentId: content.id, level: 1, xp: 0 });
        model.goldFingerEnabled = true;

        const reward = model.hexReward;
        let hexRewardCleared = false;
        if (reward) {
            const candidateIndex = reward.candidates.indexOf(content.id);
            if (candidateIndex >= 0) {
                const replacements = model.itemPool.filter((id) => {
                    return !reward.candidates.includes(id);
                });
                if (replacements.length) {
                    const replacement = replacements[Math.floor(Math.random() * replacements.length)];
                    reward.candidates[candidateIndex] = replacement;
                } else {
                    reward.candidates.splice(candidateIndex, 1);
                    if (reward.slotFreeRerolls) {
                        reward.slotFreeRerolls.splice(candidateIndex, 1);
                    }
                    if (!reward.candidates.length) {
                        model.hexReward = undefined;
                        hexRewardCleared = true;
                    }
                }
            }
        }

        this.dispatchEvent(ShopEvent.UpdateShopContent);
        if (hexRewardCleared) {
            this.dispatchEvent(ShopEvent.HexRewardSelected);
        } else if (reward) {
            this.dispatchEvent(ShopEvent.UpdateHexReward);
        }
        this.setMessage(`已添加海克斯 ${content.name}（${content.id}）`);
    }

    /** 保存操作反馈 message，并通过事件通知界面更新。 */
    private setMessage(message: string) {
        this.ent.GoldFingerModel.message = message;
        this.dispatchEvent(GoldFingerEvent.UpdatePanel);
    }

    /** 将关卡输入 text 校验后立即跳转，保留本局阵容、金币和道具，清空旧战斗。 */
    jumpLevel(text: string) {
        const game = this.ent.game;
        if (game.GameModel.transitioning) {
            this.setMessage("界面切换中，请稍后操作");
            return;
        }
        const value = text.trim();
        const level = Number(value);
        const max = TableBattleRule.getCurrent().maxLevel;
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(level) || level < 1 || level > max || !TableBattleStage.getByLevel(level)) {
            this.setMessage(`请输入 1–${max} 范围内已配置的关卡`);
            return;
        }
        if (!game.shop.ShopModel.team.length) {
            this.setMessage("请先招募或添加至少一名角色");
            return;
        }
        game.jumpToLevel(level);
        this.dispatchEvent(ShopEvent.UpdateShopContent);
        this.setPanelOpen(false);
    }
}

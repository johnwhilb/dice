import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCEntity } from "db://oops-framework/module/common/CCEntity";
import { oops } from "db://oops-framework/core/Oops";
import { smc } from "../common/SingletonModuleComp";
import { lang } from "../common/Language";
import { MainMenuView } from "../mainManue/view/MainMenuView";
import { GameModel, GamePhase } from "./model/GameModel";
import { GameBll } from "./bll/GameBll";
import { Battle } from "../battle/Battle";
import { BattleBll } from "../battle/bll/BattleBll";
import { BattleView } from "../battle/view/BattleView";
import { ShopView } from "../shop/view/ShopView";
import { ShopHexView } from "../shop/view/ShopHexView";
import { ShopBll } from "../shop/bll/ShopBll";
import { Shop } from "../shop/Shop";
import { Player } from "../player/Player";
import { GoldFinger } from "../goldFinger/GoldFinger";
import { GoldFingerBll } from "../goldFinger/bll/GoldFingerBll";
import { Enemy } from "../enemy/Enemy";
import { TableShopRule } from "../common/table/TableShopRule";
import { Combat } from "../combat/Combat";
import { Projectile } from "../projectile/Projectile";
import { Buff } from "../buff/Buff";
import { Summon } from "../summon/Summon";
import { Effect } from "../effect/Effect";
import { CombatBll } from "../combat/bll/CombatBll";
import type { Vec3 } from "cc";
import { ColorConst } from "../common/config/ColorConst";
import { TransitionView } from "../initialize/view/TransitionView";
import type { ITransitionOptions } from "../initialize/view/TransitionView";
import type { IRoundGoldReward } from "../shop/ShopEvent";
import { GameAudio } from "../common/GameAudio";

@ecs.register("Game")
export class Game extends CCEntity {
    GameModel: GameModel;
    shop: Shop;
    battle: Battle;
    player: Player;
    goldFinger: GoldFinger;
    enemy: Enemy;
    combat: Combat;
    projectile: Projectile;
    buff: Buff;
    summon: Summon;
    effect: Effect;
    private battleTransitionOrigin?: Readonly<Vec3>;
    private pendingRoundReward?: IRoundGoldReward;

    static create() {
        return ecs.getEntity<Game>(Game);
    }

    init() {
        this.add(GameModel);
        this.addBusinesss(GameBll);
        this.player = this.addChildSingleton(Player);
        this.player.game = this;
        this.combat = this.addChildSingleton(Combat);
        this.combat.game = this;
        this.projectile = this.addChildSingleton(Projectile);
        this.projectile.game = this;
        this.buff = this.addChildSingleton(Buff);
        this.buff.game = this;
        this.summon = this.addChildSingleton(Summon);
        this.summon.game = this;
        this.effect = this.addChildSingleton(Effect);
        this.effect.game = this;
        this.enemy = this.addChildSingleton(Enemy);
        this.enemy.game = this;
        this.shop = this.addChildSingleton(Shop);
        this.shop.game = this;
        this.battle = this.addChildSingleton(Battle);
        this.battle.game = this;
        this.goldFinger = this.addChildSingleton(GoldFinger);
        this.goldFinger.game = this;
    }

    openShop(continueRun: boolean = false) {
        if (this.GameModel.transitioning || this.shop.has(ShopView) || oops.gui.has(ShopHexView)) {
            return;
        }
        const bll = this.shop.getBusiness<ShopBll>(ShopBll);
        if (continueRun) {
            bll.loadRun();
        } else {
            bll.newRun();
        }
    }

    showShop() {
        if (this.shop.has(ShopView)) {
            return;
        }
        if (this.shop.ShopModel.hexReward) {
            this.showHexReward();
            return;
        }
        this.transition({ message: "正在开始…" }, () => {
            return this.shop.addUi(ShopView).then((node) => {
                if (!node) {
                    return false;
                }
                this.shop.getBusiness<ShopBll>(ShopBll).saveRun();
                smc.mainMenu.removeUi(MainMenuView);
                this.closeHexReward();
                GameAudio.setMusic(0.2, 1, 1);
                this.goldFinger.getBusiness<GoldFingerBll>(GoldFingerBll).show();
                return true;
            });
        });
    }

    openBattle(origin?: Readonly<Vec3>) {
        if (this.GameModel.transitioning || this.GameModel.phase !== GamePhase.Shop) {
            return;
        }
        this.battleTransitionOrigin = origin;
        this.battle.getBusiness<BattleBll>(BattleBll).prepareBattle(this.shop.ShopModel.team);
    }

    showBattle() {
        const shop = this.shop.ShopModel;
        const origin = this.battleTransitionOrigin;
        this.battleTransitionOrigin = undefined;
        const unit = shop.team[Math.floor(Math.random() * shop.team.length)];
        const color = unit ? ColorConst.getPlayerColor(unit.roleId) : ColorConst.shopText;
        const loopLimit = TableShopRule.getInitial().roundsPerLoop * (shop.loop + 1);
        this.transition({ message: `第 ${shop.battleLevel}/${loopLimit} 关`, origin, color }, () => {
            return this.battle.addUi(BattleView).then((node) => {
                if (!node) {
                    return false;
                }
                this.getBusiness<GameBll>(GameBll).setPhase(GamePhase.Battle);
                GameAudio.setMusic(0.5, 1, 2);
                GameAudio.preloadEffects(["Click", "Buff 13", "Bloody punches 7", "Bloody punches 10", "Body Fall 2", "Body Fall 18"]);
                this.shop.removeUi(ShopView);
                return true;
            });
        });
    }

    returnShop(event?: string, reward?: IRoundGoldReward) {
        if (this.GameModel.transitioning || this.shop.has(ShopView)) {
            return;
        }
        this.pendingRoundReward = reward ?? this.pendingRoundReward;
        if (this.shop.ShopModel.hexReward) {
            this.showHexReward();
            return;
        }
        if (this.pendingRoundReward) {
            GameAudio.playEffect("Wind Bolt 12");
        } else {
            GameAudio.playTransition(false);
        }
        const battleView = this.battle.BattleView;
        const leader = this.player.PlayerModel.players[0];
        const origin = battleView?.getTransitionOrigin();
        const color = leader ? ColorConst.getPlayerColor(leader.roleId) : ColorConst.shopText;
        this.transition({ reward: this.pendingRoundReward, origin, color }, () => {
            return this.shop.addUi(ShopView).then((node) => {
                if (!node) {
                    return false;
                }
                this.getBusiness<GameBll>(GameBll).setPhase(GamePhase.Shop);
                this.shop.getBusiness<ShopBll>(ShopBll).saveRun();
                GameAudio.setMusic(0.2, 1, 1);
                this.battle.removeUi(BattleView);
                this.closeHexReward();
                this.enemy.EnemyModel.reset();
                this.combat.getBusiness<CombatBll>(CombatBll).reset();
                this.pendingRoundReward = undefined;
                return true;
            });
        });
    }

    private showHexReward() {
        if (oops.gui.has(ShopHexView)) {
            return;
        }
        oops.gui.open(ShopHexView).then((node) => {
            if (!node) {
                oops.gui.toast(lang("shop_load_failed"));
                return;
            }
            this.shop.getBusiness<ShopBll>(ShopBll).saveRun();
        });
    }

    finishHexReward() {
        if (this.GameModel.phase === GamePhase.Battle) {
            this.returnShop();
        } else {
            this.showShop();
        }
    }

    private closeHexReward() {
        if (oops.gui.has(ShopHexView)) {
            oops.gui.remove(ShopHexView);
        }
    }

    restartShop() {
        if (this.GameModel.transitioning) {
            return;
        }
        GameAudio.playTransition(false);
        this.transition({ message: "正在重新开始…" }, () => {
            const shopBusiness = this.shop.getBusiness<ShopBll>(ShopBll);
            const ready = shopBusiness.newRun(true);
            if (ready) {
                shopBusiness.saveRun();
                GameAudio.restartMusic();
            }
            return Promise.resolve(ready);
        });
    }

    private transition(options: ITransitionOptions, open: () => Promise<boolean>) {
        if (this.GameModel.transitioning) {
            return;
        }
        this.GameModel.transitioning = true;
        TransitionView.play(options, open).then((ready) => {
            this.GameModel.transitioning = false;
            if (!ready) {
                oops.gui.toast(lang("shop_load_failed"));
            }
        });
    }

    finishBattle(pickedUpGold: number = 0) {
        this.shop.getBusiness<ShopBll>(ShopBll).completeRound(pickedUpGold);
    }

    jumpToLevel(level: number) {
        const activeBattle = this.battle.has(BattleView);
        const width = this.battle.BattleModel.arenaWidth;
        const height = this.battle.BattleModel.arenaHeight;
        const model = this.shop.ShopModel;
        model.battleLevel = level;
        model.loop = Math.floor((level - 1) / TableShopRule.getInitial().roundsPerLoop);
        this.battle.getBusiness<BattleBll>(BattleBll).prepareBattle(model.team, !activeBattle);
        if (activeBattle) {
            this.battle.getBusiness<BattleBll>(BattleBll).setArenaSize(width, height);
        }
    }

    returnMenu() {
        if (this.GameModel.transitioning) {
            return;
        }
        GameAudio.playTransition(false);
        this.transition({}, () => {
            return smc.mainMenu.open().then((node) => {
                if (!node) {
                    return false;
                }
                this.shop.removeUi(ShopView);
                this.goldFinger.getBusiness<GoldFingerBll>(GoldFingerBll).hide();
                return true;
            });
        });
    }
}

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
import { ShopBll } from "../shop/bll/ShopBll";
import { Shop } from "../shop/Shop";
import { Player } from "../player/Player";
import { GoldFinger } from "../goldFinger/GoldFinger";
import { GoldFingerBll } from "../goldFinger/bll/GoldFingerBll";
import { Enemy } from "../enemy/Enemy";
import { TableShopRule } from "../common/table/TableShopRule";

@ecs.register("Game")
export class Game extends CCEntity {
    GameModel: GameModel;
    shop: Shop;
    battle: Battle;
    player: Player;
    goldFinger: GoldFinger;
    enemy: Enemy;

    static create() {
        return ecs.getEntity<Game>(Game);
    }

    init() {
        this.add(GameModel);
        this.addBusinesss(GameBll);
        this.player = this.addChildSingleton(Player);
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
        if (this.GameModel.transitioning || this.shop.has(ShopView)) {
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
        this.GameModel.transitioning = true;
        this.shop.addUi(ShopView).then(
            (node) => {
                this.GameModel.transitioning = false;
                if (node) {
                    smc.mainMenu.removeUi(MainMenuView);
                    this.goldFinger.getBusiness<GoldFingerBll>(GoldFingerBll).show();
                }
            },
            () => {
                this.GameModel.transitioning = false;
                oops.gui.toast(lang("shop_load_failed"));
            }
        );
    }

    openBattle() {
        if (this.GameModel.transitioning || this.GameModel.phase !== GamePhase.Shop) {
            return;
        }
        this.battle.getBusiness<BattleBll>(BattleBll).prepareBattle(this.shop.ShopModel.team);
    }

    showBattle() {
        this.GameModel.transitioning = true;
        this.battle.addUi(BattleView).then(
            (node) => {
                this.GameModel.transitioning = false;
                if (node) {
                    this.getBusiness<GameBll>(GameBll).setPhase(GamePhase.Battle);
                    this.shop.removeUi(ShopView);
                }
            },
            () => {
                this.GameModel.transitioning = false;
                oops.gui.toast(lang("shop_load_failed"));
            }
        );
    }

    returnShop() {
        if (this.GameModel.transitioning) {
            return;
        }
        this.GameModel.transitioning = true;
        this.shop.addUi(ShopView).then(
            (node) => {
                this.GameModel.transitioning = false;
                if (node) {
                    this.getBusiness<GameBll>(GameBll).setPhase(GamePhase.Shop);
                    this.battle.removeUi(BattleView);
                    this.enemy.EnemyModel.reset();
                }
            },
            () => {
                this.GameModel.transitioning = false;
                oops.gui.toast(lang("shop_load_failed"));
            }
        );
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
        this.shop.getBusiness<ShopBll>(ShopBll).saveRun();
    }

    returnMenu() {
        if (this.GameModel.transitioning) {
            return;
        }
        this.GameModel.transitioning = true;
        smc.mainMenu.addUi(MainMenuView).then(
            (node) => {
                this.GameModel.transitioning = false;
                if (node) {
                    this.shop.removeUi(ShopView);
                    this.goldFinger.getBusiness<GoldFingerBll>(GoldFingerBll).hide();
                }
            },
            () => {
                this.GameModel.transitioning = false;
                oops.gui.toast(lang("shop_load_failed"));
            }
        );
    }
}

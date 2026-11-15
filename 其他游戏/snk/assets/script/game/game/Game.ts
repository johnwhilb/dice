import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCEntity } from "db://oops-framework/module/common/CCEntity";
import { oops } from "db://oops-framework/core/Oops";
import { smc } from "../common/SingletonModuleComp";
import { lang } from "../common/Language";
import { MainMenuView } from "../mainManue/view/MainMenuView";
import { GameModel, GamePhase } from "./model/GameModel";
import { GameBll } from "./bll/GameBll";
import { ShopView } from "../shop/view/ShopView";
import { ShopBll } from "../shop/bll/ShopBll";
import { Shop } from "../shop/Shop";
import { ArenaView } from "./view/ArenaView";

@ecs.register("Game")
export class Game extends CCEntity {
    GameModel: GameModel;
    shop: Shop;
    ArenaView: ArenaView;

    static create() {
        return ecs.getEntity<Game>(Game);
    }

    init() {
        this.add(GameModel);
        this.addBusinesss(GameBll);
        this.shop = this.addChildSingleton(Shop);
        this.shop.game = this;
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
                }
            },
            () => {
                this.GameModel.transitioning = false;
                oops.gui.toast(lang("shop_load_failed"));
            }
        );
    }

    openArena() {
        if (this.GameModel.transitioning || this.GameModel.phase !== GamePhase.Shop) {
            return;
        }
        this.getBusiness<GameBll>(GameBll).prepareArena();
    }

    showArena() {
        this.GameModel.transitioning = true;
        this.addUi(ArenaView).then(
            (node) => {
                this.GameModel.transitioning = false;
                if (node) {
                    this.getBusiness<GameBll>(GameBll).setPhase(GamePhase.Arena);
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
                    this.removeUi(ArenaView);
                }
            },
            () => {
                this.GameModel.transitioning = false;
                oops.gui.toast(lang("shop_load_failed"));
            }
        );
    }

    finishArena(pickedUpGold: number = 0) {
        this.shop.getBusiness<ShopBll>(ShopBll).completeRound(pickedUpGold);
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
                }
            },
            () => {
                this.GameModel.transitioning = false;
                oops.gui.toast(lang("shop_load_failed"));
            }
        );
    }
}

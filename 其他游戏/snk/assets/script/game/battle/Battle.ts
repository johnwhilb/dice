import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { oops } from 'db://oops-framework/core/Oops';
import { smc } from '../common/SingletonModuleComp';
import { lang } from '../common/Language';
import { MainMenuView } from '../mainManue/view/MainMenuView';
import { BattleModel, BattlePhase } from './model/BattleModel';
import { BattleBll } from './bll/BattleBll';
import { ShopView } from './view/ShopView';
import { ArenaView } from './view/ArenaView';

@ecs.register('Battle')
export class Battle extends CCEntity {
    BattleModel!: BattleModel;
    ShopView!: ShopView;
    ArenaView!: ArenaView;

    static create() {
        return ecs.getEntity<Battle>(Battle);
    }

    init() {
        this.add(BattleModel);
        this.addBusinesss(BattleBll);
    }

    openShop() {
        if (this.BattleModel.transitioning || this.has(ShopView)) {
            return;
        }
        const message = this.getBusiness<BattleBll>(BattleBll).newRun();
        if (message) {
            oops.gui.toast(lang(message));
            return;
        }
        this.BattleModel.transitioning = true;
        this.addUi(ShopView).then((node) => {
            this.BattleModel.transitioning = false;
            if (node) {
                smc.mainMenu.removeUi(MainMenuView);
            }
        }, () => {
            this.BattleModel.transitioning = false;
            oops.gui.toast(lang('shop_load_failed'));
        });
    }

    openArena() {
        if (this.BattleModel.transitioning || this.BattleModel.phase !== BattlePhase.Shop) {
            return;
        }
        const message = this.getBusiness<BattleBll>(BattleBll).prepareArena();
        if (message) {
            oops.gui.toast(lang(message));
            return;
        }
        this.BattleModel.transitioning = true;
        this.addUi(ArenaView).then((node) => {
            this.BattleModel.transitioning = false;
            if (node) {
                this.getBusiness<BattleBll>(BattleBll).setPhase(BattlePhase.Arena);
                this.removeUi(ShopView);
            }
        }, () => {
            this.BattleModel.transitioning = false;
            oops.gui.toast(lang('shop_load_failed'));
        });
    }

    returnShop() {
        if (this.BattleModel.transitioning) {
            return;
        }
        this.BattleModel.transitioning = true;
        this.addUi(ShopView).then((node) => {
            this.BattleModel.transitioning = false;
            if (node) {
                this.getBusiness<BattleBll>(BattleBll).setPhase(BattlePhase.Shop);
                this.removeUi(ArenaView);
            }
        }, () => {
            this.BattleModel.transitioning = false;
            oops.gui.toast(lang('shop_load_failed'));
        });
    }

    returnMenu() {
        if (this.BattleModel.transitioning) {
            return;
        }
        this.BattleModel.transitioning = true;
        smc.mainMenu.addUi(MainMenuView).then((node) => {
            this.BattleModel.transitioning = false;
            if (node) {
                this.removeUi(ShopView);
            }
        }, () => {
            this.BattleModel.transitioning = false;
            oops.gui.toast(lang('shop_load_failed'));
        });
    }
}

import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCEntity } from "db://oops-framework/module/common/CCEntity";
import { MainMenuBll } from "./bll/MainMenuBll";
import { MainMenuView } from "./view/MainMenuView";
import { smc } from "../common/SingletonModuleComp";

@ecs.register("MainMenu")
export class MainMenu extends CCEntity {
    MainMenuView: MainMenuView;

    static create(): MainMenu {
        return ecs.getEntity<MainMenu>(MainMenu);
    }

    init(): void {
        this.addBusinesss(MainMenuBll);
    }

    open() {
        if (this.has(MainMenuView)) {
            return Promise.resolve(this.MainMenuView.node);
        }
        return this.addUi(MainMenuView);
    }

    entryGame() {
        return this.getBusiness<MainMenuBll>(MainMenuBll).entryGame();
    }

    openOptions() {
        return smc.setting.open();
    }

    continueGame() {
        return this.getBusiness<MainMenuBll>(MainMenuBll).continueGame();
    }
}

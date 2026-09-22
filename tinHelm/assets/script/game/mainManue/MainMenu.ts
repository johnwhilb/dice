import { Node } from "cc";
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { smc } from '../common/SingletonModuleComp';
import { MainMenuBll } from './bll/MainMenuBll';
import { MainMenuView } from './view/MainMenuView';

@ecs.register('MainMenu')
export class MainMenu extends CCEntity {

    MainMenuView!: MainMenuView


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
        this.addUi(MainMenuView);
    }

    hasSave(): boolean {
        return smc.save.hasSave();
    }

    openProfileDialog() {
        this.getBusiness<MainMenuBll>(MainMenuBll).openProfileDialog();
    }

    entryGame() {
        this.getBusiness<MainMenuBll>(MainMenuBll).entryGame();
    }

    continueGame() {
        this.getBusiness<MainMenuBll>(MainMenuBll).continueGame();
    }

}

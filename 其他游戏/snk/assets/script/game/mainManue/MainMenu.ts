import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { MainMenuBll } from './bll/MainMenuBll';
import { MainMenuView } from './view/MainMenuView';
import { MainMenuOptionView } from './view/MainMenuOptionView';
import { MainMenuModel } from './viewModel/MainMenuModel';

@ecs.register('MainMenu')
export class MainMenu extends CCEntity {

    MainMenuView!: MainMenuView;
    MainMenuOptionView!: MainMenuOptionView;
    MainMenuModel!: MainMenuModel;


    static create(): MainMenu {
        return ecs.getEntity<MainMenu>(MainMenu);
    }

    init(): void {
        this.add(MainMenuModel);
        this.addBusinesss(MainMenuBll);
    }

    open() {
        if (this.has(MainMenuView)) {
            return Promise.resolve(this.MainMenuView.node);
        }
        this.addUi(MainMenuView);
    }

    entryGame() {
        return this.getBusiness<MainMenuBll>(MainMenuBll).entryGame();
    }

    openOptions() {
        this.addUi(MainMenuOptionView);
    }

    continueGame() {
        return this.getBusiness<MainMenuBll>(MainMenuBll).continueGame();
    }

}

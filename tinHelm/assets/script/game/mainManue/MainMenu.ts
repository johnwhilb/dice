import { Node } from "cc";
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { M_Save } from '../save/model/M_Save';
import { MainMenuBll } from './bll/MainMenuBll';
import { MainMenuView } from './view/MainMenuView';

@ecs.register('MainMenu')
export class MainMenu extends CCEntity {

    M_Save!: M_Save
    MainMenuView!: MainMenuView


    static create(): MainMenu {
        return ecs.getEntity<MainMenu>(MainMenu);
    }

    init(): void {
        this.addBusinesss(MainMenuBll);
        this.addComponents(M_Save);
    }

    open() {
        if (this.has(MainMenuView)) {
            return Promise.resolve(this.MainMenuView.node);
        }
        this.addUi(MainMenuView);
    }

    hasSave(): boolean {
        return this.M_Save.hasSave;
    }

    openProfileDialog() {
        this.getBusiness<MainMenuBll>(MainMenuBll).openProfileDialog();
    }

    entryGame() {
        this.getBusiness<MainMenuBll>(MainMenuBll).entryGame();
    }

}
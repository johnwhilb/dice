import { CCView } from 'db://oops-framework/module/common/CCView';
import { _decorator, Label } from 'cc';
import { MainMenu } from '../MainMenu';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { smc } from '../../common/SingletonModuleComp';
const { ccclass } = _decorator;

@ccclass("MainMenuView")
@ecs.register("MainMenuView", false)
@gui.register('MainMenuView', { layer: LayerType.UI, prefab: 'gui/mainMenu/ui/MainMenuView' })
export class MainMenuView extends CCView<MainMenu> {



    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.refresh();
    }

    refresh() {
        this.getNode('txtStart')!.getComponent(Label)!.string = '开始攀登';
        this.getNode('txtContinue')!.getComponent(Label)!.string = smc.battle.model.hasRun ? '继续攀登' : '直接进入';
    }

    btnContinue() {
        this.ent.continueGame();
    }

    btnStart() {
        this.ent.entryGame();
    }
    reset() {
    }

}

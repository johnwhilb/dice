import { CCView } from 'db://oops-framework/module/common/CCView';
import { _decorator, Label, Prefab } from 'cc';
import { MainMenu } from '../MainMenu';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { smc } from '../../common/SingletonModuleComp';
const { ccclass, property } = _decorator;

@ccclass("MainMenuView")
@ecs.register("MainMenuView", false)
@gui.register('MainMenuView', { layer: LayerType.UI, prefab: 'gui/mainMenu/ui/MainMenuView' })
export class MainMenuView extends CCView<MainMenu> {
    @property({ type: Prefab, tooltip: '攀岩游戏预制体' })
    gamePrefab!: Prefab;

    @property({ type: Prefab, tooltip: '关卡选择界面预制体' })
    levelSelectPrefab!: Prefab;
    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.refresh();
    }

    refresh() {
        this.getNode('txtStart')!.getComponent(Label)!.string = '开始攀登';
        this.getNode('txtContinue')!.getComponent(Label)!.string = smc.climb.model.hasRun ? '继续攀登' : '选择关卡';
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

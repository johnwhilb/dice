import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { MainMenu } from '../MainMenu';
import { smc } from '../../common/SingletonModuleComp';
import { oops } from 'db://oops-framework/core/Oops';

export class MainMenuBll extends CCBusiness<MainMenu> {

    /** 从主菜单进入关卡选择界面，选择界面打开后隐藏菜单。 */
    entryGame() {
        const view = this.ent.MainMenuView;
        const node = smc.climb.openLevelSelect(view.levelSelectPrefab, view.node.parent!);
        view.node.active = !node;
        if (!node) {
            oops.gui.toast('关卡选择预制体未绑定，请检查配置');
        }
    }

    /** 继续暂停的攀爬进度，无进度时进入关卡选择界面。 */
    continueGame() {
        if (!smc.climb.model.hasRun) {
            this.entryGame();
            return;
        }
        this.openClimb(false);
    }

    /** 打开攀岩界面，newGame 决定重置本局或恢复当前状态。 */
    private openClimb(newGame: boolean) {
        const view = this.ent.MainMenuView;
        const node = smc.climb.open(newGame, view.gamePrefab, view.node.parent!);
        view.node.active = !node;
        if (!node) {
            oops.gui.toast('关卡配置无效或游戏预制体未绑定，请检查配置');
        }
    }
}

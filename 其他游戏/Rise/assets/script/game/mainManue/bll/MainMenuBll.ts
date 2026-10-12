import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { MainMenu } from '../MainMenu';
import { smc } from '../../common/SingletonModuleComp';
import { oops } from 'db://oops-framework/core/Oops';

export class MainMenuBll extends CCBusiness<MainMenu> {

    /** 从主菜单开始新一局，游戏界面打开后隐藏菜单。 */
    entryGame() {
        this.openBattle(true);
    }

    /** 继续暂停的攀爬进度，无进度时直接开始第一局。 */
    continueGame() {
        this.openBattle(false);
    }

    /** 打开战斗界面，newGame 决定重置本局或恢复当前状态。 */
    private openBattle(newGame: boolean) {
        smc.battle.open(newGame).then((node) => {
            this.ent.MainMenuView.node.active = !node;
            if (!node) {
                oops.gui.toast('游戏界面加载失败，请重新进入');
            }
        });
    }
}

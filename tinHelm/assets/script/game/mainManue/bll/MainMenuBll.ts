import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { MainMenu } from '../MainMenu';
import { Profile } from '../../profile/Profile';
import { smc } from '../../common/SingletonModuleComp';

export class MainMenuBll extends CCBusiness<MainMenu> {

    entryGame() {
        smc.gameFlow.GameFlowBll.startNewGame();
    }

    continueGame() {
        if (!smc.save.restoreGame()) {
            return;
        }
        smc.gameFlow.entryGameSceneByGameFlowState();
    }

    openProfileDialog() {
        smc.profile.open();
    }

}

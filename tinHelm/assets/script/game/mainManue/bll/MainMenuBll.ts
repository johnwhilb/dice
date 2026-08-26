import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { MainMenu } from '../MainMenu';
import { Profile } from '../../profile/Profile';
import { smc } from '../../common/SingletonModuleComp';

export class MainMenuBll extends CCBusiness<MainMenu> {

    entryGame() {
        smc.gameFlow.entryGameSceneByGameFlowState();
    }

    continueGame() {
    }

    openProfileDialog() {
        smc.profile.open();
    }

}
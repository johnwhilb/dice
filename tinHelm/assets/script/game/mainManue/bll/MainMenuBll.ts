import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { MainMenu } from '../MainMenu';
import { Profile } from '../../profile/Profile';
import { smc } from '../../common/SingletonModuleComp';

export class MainMenuBll extends CCBusiness<MainMenu> {

    startGame() {
        console.log("startGame");
    }

    continueGame() {
    }

    openProfileDialog() {
        smc.profile.open();
    }

}
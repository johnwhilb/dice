import { _decorator, Label } from 'cc';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { MainMenu } from '../MainMenu';
import { MainMenuBll } from '../bll/MainMenuBll';
import { lang } from '../../common/Language';

const { ccclass } = _decorator;

@ccclass('MainMenuOptionView')
@ecs.register('MainMenuOptionView', false)
@gui.register('MainMenuOptionView', { layer: LayerType.PopUp, prefab: 'gui/mainMenu/ui/MainMenuOptionView', mask: true })
export class MainMenuOptionView extends CCView<MainMenu> {
    start() {
        this.nodeTreeInfoLite();
        this.setButton(false);
        this.getNode('optionsTitle')!.getComponent(Label)!.string = lang('main_menu_options');
        this.getNode('btnBack')!.getComponent(Label)!.string = lang('main_menu_back');
        this.refresh();
    }

    refresh() {
        this.ent.getBusiness<MainMenuBll>(MainMenuBll).refreshAudio();
        const model = this.ent.MainMenuModel;
        this.getNode('btnMusic')!.getComponent(Label)!.string = lang(model.musicEnabled ? 'main_menu_music_on' : 'main_menu_music_off');
        this.getNode('btnEffect')!.getComponent(Label)!.string = lang(model.effectEnabled ? 'main_menu_effect_on' : 'main_menu_effect_off');
    }

    btnMusic() {
        this.ent.getBusiness<MainMenuBll>(MainMenuBll).toggleMusic();
        this.refresh();
    }

    btnEffect() {
        this.ent.getBusiness<MainMenuBll>(MainMenuBll).toggleEffect();
        this.refresh();
    }

    btnBack() {
        this.remove();
    }

    reset() {
    }
}

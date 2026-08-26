import { CCView } from 'db://oops-framework/module/common/CCView';
import { Node, _decorator } from 'cc';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { Player } from '../Player';

const { ccclass } = _decorator;

@ccclass("RoleSelectView")
@ecs.register("RoleSelectView", false)
@gui.register('RoleSelectView', { layer: LayerType.PopUp, prefab: 'gui/player/view/RoleSelectView' })
export class RoleSelectView extends CCView<Player> {
    reset(): void {
    }



}

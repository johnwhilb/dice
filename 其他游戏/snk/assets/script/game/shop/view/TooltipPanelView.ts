import { _decorator, Layout, RichText } from "cc";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import { oops } from "db://oops-framework/core/Oops";
import { UICommon } from "../../ui/UICommon";

const { ccclass } = _decorator;

@ccclass("TooltipPanelView")
@gui.register("TooltipPanelView", { layer: LayerType.PopUp, prefab: "gui/shop/ui/TooltipPanelView", mask: true })
export class TooltipPanelView extends GameComponent {
    onAdded(text: string) {
        const formatted = UICommon.toText(`[fg]${text}`, true);
        this.getNode("lbtTooltip").getComponent(RichText).string = formatted;
        this.node.getComponent(Layout).updateLayout();
    }

    btnCloseTooltip() {
        oops.gui.remove(TooltipPanelView);
    }
}

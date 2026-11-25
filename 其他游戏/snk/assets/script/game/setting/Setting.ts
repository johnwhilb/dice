import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCEntity } from "db://oops-framework/module/common/CCEntity";
import { SettingBll } from "./SettingBll";
import { SettingModel } from "./SettingModel";
import { SettingView } from "./SettingView";

@ecs.register("Setting")
export class Setting extends CCEntity {
    SettingModel: SettingModel;

    init() {
        this.add(SettingModel);
        this.addBusinesss(SettingBll);
    }

    open() {
        return this.addUi(SettingView);
    }
}

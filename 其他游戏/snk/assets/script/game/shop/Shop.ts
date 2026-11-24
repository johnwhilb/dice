import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCEntity } from "db://oops-framework/module/common/CCEntity";
import type { Game } from "../game/Game";
import { ShopBll } from "./bll/ShopBll";
import { ShopAudioBll } from "./bll/ShopAudioBll";
import { ShopModel } from "./model/ShopModel";
import type { ShopView } from "./view/ShopView";

@ecs.register("Shop")
export class Shop extends CCEntity {
    game: Game;
    ShopModel: ShopModel;
    ShopView: ShopView;

    init() {
        this.add(ShopModel);
        this.addBusinesss(ShopBll, ShopAudioBll);
    }
}

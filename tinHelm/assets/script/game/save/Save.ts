import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCEntity } from "db://oops-framework/module/common/CCEntity";
import { SaveBll } from "./bll/B_Save";
import { SaveModel } from "./model/M_Save";


@ecs.register('Save')
export class Save extends CCEntity {
    SaveBll!: SaveBll;
    SaveModel!: SaveModel;

    static create(): Save {
        return ecs.getEntity<Save>(Save);
    }

    protected init(): void {
        this.addComponents(SaveModel);
        this.SaveBll = this.addBusiness<SaveBll>(SaveBll);
    }

    hasSave() {
        return this.SaveBll.hasSave();
    }

    saveGame() {
        this.SaveBll.saveGame();
    }

    restoreGame() {
        return this.SaveBll.restoreGame();
    }

}

import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCEntity } from "db://oops-framework/module/common/CCEntity";
import { B_Save } from "./bll/B_Save";
import { M_Save } from "./model/M_Save";


@ecs.register('Main')
export class Save extends CCEntity {

    static create(): Save {
        return ecs.getEntity<Save>(Save);
    }

    protected init(): void {
        this.addBusinesss(B_Save);
        this.addComponents(M_Save);
    }

}
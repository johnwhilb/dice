import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCEntity } from "db://oops-framework/module/common/CCEntity";
import type { Game } from "../game/Game";
import { ProjectileBll } from "./bll/ProjectileBll";
import { ProjectileModel } from "./model/ProjectileModel";

@ecs.register("Projectile")
export class Projectile extends CCEntity {
    game: Game;
    ProjectileModel: ProjectileModel;

    init() {
        this.add(ProjectileModel);
        this.addBusinesss(ProjectileBll);
    }
}

import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCEntity } from "db://oops-framework/module/common/CCEntity";
import type { Game } from "../game/Game";
import { EnemySpawnBll } from "./bll/EnemySpawnBll";
import { EnemyActionBll } from "./bll/EnemyActionBll";
import { EnemyBll } from "./bll/EnemyBll";
import { EnemyModel } from "./model/EnemyModel";

@ecs.register("Enemy")
export class Enemy extends CCEntity {
    game: Game;
    EnemyModel: EnemyModel;

    init() {
        this.add(EnemyModel);
        this.addBusinesss(EnemyBll);
        this.addBusinesss(EnemySpawnBll);
        this.addBusinesss(EnemyActionBll);
    }
}

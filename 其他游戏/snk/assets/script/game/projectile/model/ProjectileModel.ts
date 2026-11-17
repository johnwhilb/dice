import { ecs } from "db://oops-framework/libs/ecs/ECS";
import type { IProjectileData } from "../ProjectileEvent";
import type { IEnemyObject } from "../../enemy/EnemyEvent";

@ecs.register("ProjectileModel")
export class ProjectileModel extends ecs.Comp {
    projectiles: IProjectileData[] = [];
    enemyProjectiles: IEnemyObject[] = [];

    /** 清空双方弹丸及尚未发射的连射。 */
    reset() {
        this.projectiles = [];
        this.enemyProjectiles = [];
    }
}

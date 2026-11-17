import { ecs } from "db://oops-framework/libs/ecs/ECS";
import type { TableBattleStage } from "../../common/table/TableBattleStage";
import type { TableEnemyLevel } from "../../common/table/TableEnemyLevel";
import type { IEnemyData, IEnemyObject, IEnemySpawn } from "../EnemyEvent";

@ecs.register("EnemyModel")
export class EnemyModel extends ecs.Comp {
    enemies: IEnemyData[] = [];
    objects: IEnemyObject[] = [];
    pending: IEnemySpawn[] = [];
    stage: TableBattleStage;
    levelStats: TableEnemyLevel;
    level: number = 0;
    loop: number = 0;
    newGamePlus: number = 0;
    elapsed: number = 0;
    nextId: number = 1;
    pickedUpGold: number = 0;
    spatial: Map<string, IEnemyData[]> = new Map();

    /** 清空本场敌人、延迟刷怪、弹丸、地雷、金币及计时，不修改商店数据。 */
    reset() {
        this.enemies = [];
        this.objects = [];
        this.pending = [];
        this.elapsed = 0;
        this.nextId = 1;
        this.pickedUpGold = 0;
        this.spatial.clear();
    }
}

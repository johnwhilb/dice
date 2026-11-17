import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import { TableBattleStage } from "../../common/table/TableBattleStage";
import { TableEnemyLevel } from "../../common/table/TableEnemyLevel";
import type { Enemy } from "../Enemy";
import { EnemyEvent } from "../EnemyEvent";
import type { IEnemyData } from "../EnemyEvent";
import { EnemySpawnBll } from "./EnemySpawnBll";
import { EnemyActionBll } from "./EnemyActionBll";

export class EnemyBll extends CCBusiness<Enemy> {
    /** 按关卡 level、循环 loop 和难度 newGamePlus 创建独立敌人管理状态。 */
    prepare(level: number, loop: number, newGamePlus: number) {
        const model = this.ent.EnemyModel;
        model.reset();
        model.stage = TableBattleStage.getByLevel(level);
        model.levelStats = TableEnemyLevel.getByLevel(level);
        model.level = level;
        model.loop = loop;
        model.newGamePlus = newGamePlus;
        this.dispatchEvent(EnemyEvent.UpdateFrame);
    }

    /** 将 wave 波加入生成队列，width、height 为战场尺寸，bossReinforcement 表示首领增援。 */
    scheduleWave(wave: number, width: number, height: number, bossReinforcement: boolean = false) {
        this.ent.getBusiness<EnemySpawnBll>(EnemySpawnBll).scheduleWave(wave, width, height, bossReinforcement);
    }

    /** 将当前关卡首领加入生成队列。 */
    scheduleBoss() {
        this.ent.getBusiness<EnemySpawnBll>(EnemySpawnBll).scheduleBoss();
    }

    /** 在战场局部坐标 x、y 创建 configId 对应的敌人。 */
    spawn(configId: number, x: number, y: number) {
        return this.ent.getBusiness<EnemySpawnBll>(EnemySpawnBll).spawn(configId, x, y);
    }

    /** 按 damage 扣减 enemy 血量，伤害及死亡由行动业务统一处理。 */
    hit(enemy: IEnemyData, damage: number) {
        this.ent.getBusiness<EnemyActionBll>(EnemyActionBll).hit(enemy, damage);
    }

    /** 推进 delta 秒的战场时间，先生成敌人，再更新行动与碰撞。 */
    update(delta: number, width: number, height: number) {
        this.ent.EnemyModel.elapsed += delta;
        this.ent.getBusiness<EnemySpawnBll>(EnemySpawnBll).updatePending();
        this.ent.getBusiness<EnemyActionBll>(EnemyActionBll).update(delta, width, height);
    }

    /** 一帧模拟结束后通过事件同步敌人及对象表现。 */
    refreshView() {
        this.dispatchEvent(EnemyEvent.UpdateFrame);
    }
}

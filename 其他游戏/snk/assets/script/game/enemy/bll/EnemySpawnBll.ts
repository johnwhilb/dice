import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import { TableBattleRule } from "../../common/table/TableBattleRule";
import { TableEnemy } from "../../common/table/TableEnemy";
import { EnemyKeyEnum } from "../../common/table/EnemyKeyEnum";
import type { Enemy } from "../Enemy";
import { EnemyObjectKind } from "../EnemyEvent";
import type { IDistributedSpawn, IEnemyData, IEnemyObject, IEnemySource } from "../EnemyEvent";

export class EnemySpawnBll extends CCBusiness<Enemy> {
    /** 按当前战场时间生成已到期的刷怪队列。 */
    updatePending() {
        const model = this.ent.EnemyModel;
        const due = model.pending.filter((entry) => {
            return entry.at <= model.elapsed;
        });
        model.pending = model.pending.filter((entry) => {
            return entry.at > model.elapsed;
        });
        due.forEach((entry) => {
            this.spawn(entry.configId, entry.x, entry.y);
        });
    }

    /** 将 wave 波的普通或分布式刷怪加入管理队列，width、height 为战场尺寸。 */
    scheduleWave(wave: number, width: number, height: number, bossReinforcement: boolean = false) {
        const model = this.ent.EnemyModel;
        const rule = TableBattleRule.getCurrent();
        const distributed = !bossReinforcement && Math.random() * 100 < model.stage.distributedChance;
        if (distributed) {
            const patterns: IDistributedSpawn[] = rule.distributedPatterns;
            const total = patterns.reduce((sum, pattern) => {
                return sum + pattern.weight;
            }, 0);
            const repeats = Math.ceil((rule.waveEnemyBase + (wave + Math.min(model.loop * rule.distributedLoopGrowth, rule.distributedLoopCap) - 1) * rule.waveEnemyGrowth) / rule.distributedGroupBudget);
            for (let repeat = 0; repeat < repeats; repeat++) {
                let roll = Math.random() * total;
                const pattern = patterns.find((entry) => {
                    roll -= entry.weight;
                    return roll < 0;
                });
                const point = this.spawnPoint(width, height, true);
                pattern.groups.forEach((count, index) => {
                    const location = pattern.samePoint ? point : this.spawnPoint(width, height, true);
                    this.queueGroup(count, location.x, location.y, rule.waveDelay + rule.spawnWarning + repeat * rule.distributedRepeatInterval + pattern.times[index]);
                });
            }
        } else {
            const count = bossReinforcement
                ? rule.bossReinforcementBase + Math.floor(model.level / 2)
                : rule.waveEnemyBase + (wave + Math.min(model.loop * rule.loopWaveGrowth, rule.loopWaveCap) - 1) * rule.waveEnemyGrowth;
            const point = this.spawnPoint(width, height, false);
            this.queueGroup(count, point.x, point.y, rule.waveDelay + rule.spawnWarning);
        }
    }

    /** 将首领加入预警后的生成队列，关卡配置已确定首领类型。 */
    scheduleBoss() {
        const model = this.ent.EnemyModel;
        const rule = TableBattleRule.getCurrent();
        const config = TableEnemy.getConfigById<TableEnemy>(model.stage.bossId);
        model.pending.push({ at: model.elapsed + rule.spawnWarning, configId: config.id, x: 0, y: 0 });
        this.createObject(EnemyObjectKind.SpawnMarker, { id: 0, config, x: 0, y: 0, damage: 0 }, 0, 0, 0, rule.spawnWarning, 0);
    }

    /** 将 count 名敌人按间隔排队，x、y 为局部生成中心，delay 为额外延迟秒数。 */
    private queueGroup(count: number, x: number, y: number, delay: number) {
        const model = this.ent.EnemyModel;
        const rule = TableBattleRule.getCurrent();
        const config = TableEnemy.getConfigById<TableEnemy>(EnemyKeyEnum.Seeker);
        this.createObject(EnemyObjectKind.SpawnMarker, { id: 0, config, x, y, damage: 0 }, 0, 0, 0, rule.spawnWarning, delay - rule.spawnWarning);
        for (let index = 0; index < count; index++) {
            const offset = rule.spawnOffsets[index % rule.spawnOffsets.length];
            model.pending.push({ at: model.elapsed + delay + index * rule.spawnInterval, configId: this.pickEnemy(), x: x + offset.x, y: y + offset.y });
        }
    }

    /** 从当前关卡精英概率中选择配置 ID，未命中精英时返回普通追击者。 */
    private pickEnemy() {
        const stage = this.ent.EnemyModel.stage;
        const weights: number[] = stage.eliteWeights;
        const ids: number[] = stage.eliteIds;
        const total = weights.reduce((sum, weight) => {
            return sum + weight;
        }, 0);
        if (Math.random() * 100 >= total) {
            return EnemyKeyEnum.Seeker;
        }
        let roll = Math.random() * total;
        const index = weights.findIndex((weight) => {
            roll -= weight;
            return roll < 0;
        });
        return ids[index];
    }

    /** 根据战场宽高选取原版中心/左右或四角生成点，distributed 决定候选点集合。 */
    private spawnPoint(width: number, height: number, distributed: boolean) {
        const inset = TableBattleRule.getCurrent().spawnInset;
        const halfWidth = width / 2 - inset;
        const halfHeight = height / 2 - inset;
        const points = distributed
            ? [{ x: -halfWidth, y: -halfHeight }, { x: -halfWidth, y: halfHeight }, { x: halfWidth, y: -halfHeight }, { x: halfWidth, y: halfHeight }, { x: 0, y: 0 }]
            : [{ x: -halfWidth, y: 0 }, { x: 0, y: 0 }, { x: halfWidth, y: 0 }];
        return points[Math.floor(Math.random() * points.length)];
    }

    /** 在局部坐标 x、y 生成 configId 指定的敌人，属性读取关卡和类型配置。 */
    spawn(configId: number, x: number, y: number) {
        const model = this.ent.EnemyModel;
        const config = TableEnemy.getConfigById<TableEnemy>(configId);
        const stats = model.levelStats;
        const ng = model.newGamePlus;
        const rule = TableBattleRule.getCurrent();
        const baseHp = config.boss ? stats.bossHp + ng * stats.bossHpStep : config.critter ? stats.critterHp : ng > 0 ? stats.ngHp + ng * stats.ngHpStep : stats.hp;
        const maxHp = baseHp * config.hpMultiplier * (config.hpBaseMultiplier + config.hpLevelMultiplier * model.level + config.hpNgMultiplier * ng);
        const damage = config.boss ? ng > 0 ? stats.bossNgDamage + ng * stats.bossNgDamageStep : stats.bossDamage : config.critter ? stats.critterDamage : ng > 0 ? stats.ngDamage + ng * stats.ngDamageStep : stats.damage;
        const speed = (config.boss ? ng > 0 ? stats.bossNgSpeed : stats.bossSpeed : config.critter ? stats.critterSpeed : stats.speed) * config.speedMultiplier * config.moveMultiplier * rule.scale;
        const enemy: IEnemyData = {
            id: model.nextId++, config, x, y, angle: 0, hp: maxHp, maxHp, damage, speed, dead: false,
            skillTimer: config.id === EnemyKeyEnum.Shooter ? this.randomRange(config.initialSkillMin, config.initialSkillMax) * Math.max(rule.headbuttNgMin, 1 - ng * (1 - rule.headbuttNgMin) / rule.headbuttNgMax) : this.randomRange(config.skillMin, config.skillMax),
            life: config.selfDestructMax > 0 ? this.randomRange(config.selfDestructMin, config.selfDestructMax) : 0,
            boostRemaining: 0, boostDuration: 0, chargeRemaining: 0, chargeX: 0, chargeY: 0,
            knockbackRemaining: 0, knockbackX: 0, knockbackY: 0, contacts: new Set<number>(), shooting: false,
            forceRemaining: 0, forceX: 0, forceY: 0,
        };
        model.enemies.push(enemy);
        return enemy;
    }

    /** 将战场对象按 kind 创建并加入统一对象列表，life 为剩余秒数，零表示不自动过期。 */
    createObject(kind: EnemyObjectKind, source: IEnemySource, angle: number, speed: number, damage: number, life: number, delay: number) {
        const model = this.ent.EnemyModel;
        const rule = TableBattleRule.getCurrent();
        const object: IEnemyObject = { id: model.nextId++, kind, configId: source.config.id, sourceId: source.id, x: source.x, y: source.y, angle: angle * 180 / Math.PI,
            width: kind === EnemyObjectKind.Projectile ? rule.projectileWidth : rule.projectileHeight,
            height: rule.projectileHeight, speed, damage, life, dead: false, delay };
        model.objects.push(object);
        return object;
    }

    /** 返回 min 到 max 之间的随机数，配置零区间用于无技能普通敌人。 */
    private randomRange(min: number, max: number) {
        return min + Math.random() * (max - min);
    }
}

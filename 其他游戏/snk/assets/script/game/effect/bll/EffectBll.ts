import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import type { Effect } from "../Effect";
import {
    ArenaWallSide,
    BattleSound,
    EffectKind,
    arrowResidueDuration,
    bossDeathDuration,
    bossSlowDuration,
    buffPulseDuration,
    chainDuration,
    coinStrikeDuration,
    criticalDuration,
    enemyDeathDuration,
    hitstopCooldownDuration,
    impactShakeDuration,
    knifeResidueDuration,
    muzzleDuration,
    pickupRippleDuration,
    playerDeathDuration,
    playerDeathSlowDuration,
    playerHurtDuration,
    projectileEndDuration,
    projectileParticleScale,
    recoilDuration,
    screenHurtFlashDuration,
    shieldBlockDuration,
    spawnArrivalDuration,
    spawnRingDuration,
    tagTextDuration,
    wallImpactDuration,
} from "../EffectEvent";
import { TableCombatRule } from "../../common/table/TableCombatRule";
import type { IProjectileData } from "../../projectile/ProjectileEvent";
import { BattleAudioBll } from "./BattleAudioBll";

const collisionShakeDuration = 0.5;
const collisionShakeFrequency = 60;
const collisionShakeAmplitude = 4;
const wallShakeAmplitude = 2;
const wallSpringStiffness = 100;
const wallSpringDamping = 10;
const projectileHitParticleSizeScale = 1.25;
const killStreakWindow = 2.6;

export class EffectBll extends CCBusiness<Effect> {
    /** 返回战斗音效业务实例。 */
    private get audio() {
        return this.ent.getBusiness<BattleAudioBll>(BattleAudioBll);
    }

    /** 记录位置 x、y 的 kind 表现，amount 为飘字数值，roleId 决定动态颜色。 */
    show(kind: EffectKind, x: number, y: number, radius: number, amount: number, roleId: number, endX: number = x, endY: number = y) {
        const rule = TableCombatRule.getCurrent();
        const life = kind === EffectKind.Damage || kind === EffectKind.Heal ? rule.textLife : rule.effectLife;
        this.ent.EffectModel.effects.push({ kind, x, y, endX, endY, radius, amount, roleId, life, duration: life });
    }

    /** 在 x、y 生成带弹性散射轨迹的伤害飘字，critical 标记暴击，playerHurt 区分玩家受伤。 */
    showDamage(x: number, y: number, amount: number, roleId: number, critical: boolean = false, playerHurt: boolean = false) {
        const rule = TableCombatRule.getCurrent();
        const life = critical ? rule.textLife * 1.18 : rule.textLife;
        const spreadX = (Math.random() - 0.5) * (critical ? 84 : 56);
        const speedY = critical ? 128 + Math.random() * 26 : 86 + Math.random() * 24;
        this.ent.EffectModel.effects.push({
            kind: EffectKind.Damage,
            x: x + (Math.random() - 0.5) * 14,
            y: y + 8,
            endX: x,
            endY: y,
            radius: 0,
            amount,
            roleId,
            life,
            duration: life,
            critical,
            playerHurt,
            vx: spreadX,
            vy: speedY,
        });
    }

    /** 在 x、y 生成治疗飘字与治愈涟漪，roleId 决定角色标识色。 */
    showHeal(x: number, y: number, amount: number, roleId: number) {
        const rule = TableCombatRule.getCurrent();
        const life = rule.textLife * 1.05;
        this.ent.EffectModel.effects.push({
            kind: EffectKind.Heal,
            x: x + (Math.random() - 0.5) * 10,
            y: y + 10,
            endX: x,
            endY: y,
            radius: 0,
            amount,
            roleId,
            life,
            duration: life,
            vx: (Math.random() - 0.5) * 24,
            vy: 72,
        });
        this.showPickupRipple(x, y, false);
        this.audio.play(BattleSound.Heal);
    }

    /** 在 x、y 生成特殊短文案飘字 tag（如 +1G、格挡、复活），roleId 为 0 时使用高亮色。 */
    showTagText(x: number, y: number, tag: string, roleId: number = 0) {
        this.ent.EffectModel.effects.push({
            kind: EffectKind.TagText,
            x,
            y: y + 12,
            endX: x,
            endY: y,
            radius: 0,
            amount: 0,
            roleId,
            life: tagTextDuration,
            duration: tagTextDuration,
            vx: (Math.random() - 0.5) * 20,
            vy: 78,
            tag,
        });
    }

    /** 在 x、y 生成拾取涟漪与粒子，gold 为 true 表示金币，false 表示治疗球。 */
    showPickupRipple(x: number, y: number, gold: boolean) {
        this.ent.EffectModel.effects.push({
            kind: EffectKind.PickupRipple,
            x,
            y,
            endX: x,
            endY: y,
            radius: gold ? 24 : 30,
            amount: gold ? 1 : 0,
            roleId: 0,
            life: pickupRippleDuration,
            duration: pickupRippleDuration,
        });
        if (gold) {
            this.showTagText(x, y, "+1G", 0);
            this.audio.play(BattleSound.Gold);
        }
    }

    /** 在 x、y 生成召唤物或治疗球落点汇聚光环与粒子。 */
    showSpawnRing(x: number, y: number, radius: number, roleId: number) {
        this.ent.EffectModel.effects.push({
            kind: EffectKind.SpawnRing,
            x,
            y,
            endX: x,
            endY: y,
            radius,
            amount: 0,
            roleId,
            life: spawnRingDuration,
            duration: spawnRingDuration,
        });
        for (let index = 0; index < 3; index++) {
            this.spawnProjectileParticle(x, y, Math.random() * Math.PI * 2, 45 + Math.random() * 55, roleId);
        }
    }

    /** 在 x、y 生成充能、加速、护盾或献祭扩散光环，plasma 为 true 时使用亮电浆蓝。 */
    showBuffPulse(x: number, y: number, radius: number, roleId: number, plasma: boolean = false, sound?: BattleSound) {
        this.ent.EffectModel.effects.push({
            kind: EffectKind.BuffPulse,
            x,
            y,
            endX: x,
            endY: y,
            radius,
            amount: 0,
            roleId,
            life: buffPulseDuration,
            duration: buffPulseDuration,
            plasma,
        });
        if (sound) {
            this.audio.play(sound);
        }
    }

    /** 从 x、y 到 endX、endY 绘制赌徒金币砸落的金色连线、闪爆与音效。 */
    showCoinStrike(x: number, y: number, endX: number, endY: number) {
        this.ent.EffectModel.effects.push({
            kind: EffectKind.CoinStrike,
            x,
            y,
            endX,
            endY,
            radius: 26,
            amount: 0,
            roleId: 0,
            life: coinStrikeDuration,
            duration: coinStrikeDuration,
        });
        for (let index = 0; index < 4; index++) {
            this.spawnProjectileParticle(endX, endY, Math.random() * Math.PI * 2, 70 + Math.random() * 90, 0);
        }
        this.audio.play(BattleSound.Gold, 1.15);
    }

    /** 在蛇身与敌人接触点 x、y 生成原版双色碰撞碎片与亮斑。 */
    showBodyContact(x: number, y: number, roleId: number, enemyConfigId: number) {
        this.ent.EffectModel.effects.push({
            kind: EffectKind.ProjectileHit,
            x,
            y,
            endX: x,
            endY: y,
            radius: 6 * projectileParticleScale,
            amount: 0,
            roleId: 0,
            life: 0.1,
            duration: 0.1,
        });
        for (let index = 0; index < 2; index++) {
            this.spawnProjectileParticle(x, y, Math.random() * Math.PI * 2, 60 + Math.random() * 90, roleId);
            this.spawnProjectileParticle(x, y, Math.random() * Math.PI * 2, 60 + Math.random() * 90, 0, enemyConfigId);
        }
    }

    /** 蛇头撞墙时为存活队员 aliveIndices 排程原版波浪式依次弹簧回弹。 */
    showWallRipple(aliveIndices: number[], speed: number) {
        const model = this.ent.EffectModel;
        const stepDelay = 32 / Math.max(140, speed);
        aliveIndices.forEach((source, rank) => {
            if (rank === 0) {
                model.recoilLife.set(source, recoilDuration);
            } else {
                model.wallRipples.push({ source, delay: rank * stepDelay });
            }
        });
    }

    /** 在 x、y 生成护盾格挡波纹与音效。 */
    showShieldBlock(x: number, y: number, roleId: number) {
        this.ent.EffectModel.effects.push({
            kind: EffectKind.ShieldBlock,
            x,
            y,
            endX: x,
            endY: y,
            radius: TableCombatRule.getCurrent().shieldRadius * 1.15,
            amount: 0,
            roleId,
            life: shieldBlockDuration,
            duration: shieldBlockDuration,
        });
        this.showTagText(x, y, "BLOCK", roleId);
        this.shake(impactShakeDuration * 0.6, 3.2);
        this.audio.play(BattleSound.Shield);
    }

    /** 在 x、y 生成撞墙冲击光波与墙面边框点亮，side 指定碰撞墙面，heavy 表示猛烈撞击。 */
    showWallImpact(x: number, y: number, side: ArenaWallSide, roleId: number = 0, heavy: boolean = false) {
        const model = this.ent.EffectModel;
        const duration = heavy ? wallImpactDuration * 1.3 : wallImpactDuration;
        model.wallFlashLife.set(side, Math.max(model.wallFlashLife.get(side) ?? 0, duration));
        model.effects.push({
            kind: EffectKind.WallImpact,
            x,
            y,
            endX: x,
            endY: y,
            radius: heavy ? 42 : 26,
            amount: heavy ? 1 : 0,
            roleId,
            life: duration,
            duration,
            wallSide: side,
        });
        const count = heavy ? 6 : 3;
        const baseAngle = side === ArenaWallSide.Left
            ? 0
            : side === ArenaWallSide.Right
                ? Math.PI
                : side === ArenaWallSide.Bottom
                    ? Math.PI / 2
                    : -Math.PI / 2;
        for (let index = 0; index < count; index++) {
            const angle = baseAngle + (Math.random() - 0.5) * Math.PI * 0.78;
            const speed = heavy ? 110 + Math.random() * 140 : 60 + Math.random() * 80;
            this.spawnProjectileParticle(x, y, angle, speed, roleId);
        }
        if (heavy) {
            this.triggerHitstop(0.028);
            this.shake(impactShakeDuration, 6.5);
        }
        this.audio.play(BattleSound.WallHit, heavy ? 1.25 : 0.85);
    }

    /** 在 x、y 生成亮斑和碎片，ended 表示弹丸终止，颜色来自 roleId 和 enemyConfigId。 */
    showProjectileHit(x: number, y: number, ended: boolean, roleId: number, enemyConfigId?: number) {
        const kind = ended ? EffectKind.ProjectileEnd : EffectKind.ProjectileHit;
        const radius = (ended ? 8 : 6) * projectileParticleScale;
        const life = ended ? projectileEndDuration : 0.1;
        this.ent.EffectModel.effects.push({ kind, x, y, endX: x, endY: y, radius, amount: 0, roleId: 0, life, duration: life });
        const count = ended ? 3 + Math.floor(Math.random() * 2) : 2;
        for (let index = 0; index < count; index++) {
            const angle = Math.random() * 2 * Math.PI;
            const particleEnemyId = !ended && index === 1 ? enemyConfigId : undefined;
            this.spawnProjectileParticle(x, y, angle, 55 + Math.random() * 115, roleId, particleEnemyId, undefined, projectileHitParticleSizeScale);
        }
        if (enemyConfigId !== undefined) {
            this.audio.play(BattleSound.Hit);
        }
    }

    /** 在 x、y 沿 angle 绘制角色色发射闪光，有 source 时记录对应角色的出手回弹。 */
    showMuzzle(x: number, y: number, angle: number, roleId: number, source?: number) {
        const model = this.ent.EffectModel;
        model.effects.push({ kind: EffectKind.Muzzle, x, y, endX: x, endY: y, radius: 0, amount: angle, roleId, life: muzzleDuration, duration: muzzleDuration });
        if (source !== undefined) {
            model.recoilLife.set(source, recoilDuration);
            this.shake(impactShakeDuration * 0.55, 2.2);
            this.audio.playShot(roleId);
        }
    }

    /** 记录范围冲击尺寸与可选方形朝向 squareAngle，impact 控制镜头反馈。 */
    showArea(x: number, y: number, radius: number, roleId: number, impact: boolean, squareAngle?: number) {
        const life = TableCombatRule.getCurrent().effectLife;
        this.ent.EffectModel.effects.push({ kind: EffectKind.Area, x, y, endX: x, endY: y, radius, amount: 0, roleId, life, duration: life, squareAngle });
        if (impact) {
            this.shake(impactShakeDuration, 6.5);
            this.triggerHitstop(0.018);
            this.audio.play(BattleSound.Area);
        }
    }

    /** 在两端坐标生成动态锯齿电弧与端点电火花，plasma 为 true 时启用亮蓝电浆辉光与分叉。 */
    showChain(x: number, y: number, endX: number, endY: number, roleId: number, plasma: boolean = false) {
        this.ent.EffectModel.effects.push({
            kind: EffectKind.Chain,
            x,
            y,
            endX,
            endY,
            radius: 0,
            amount: 0,
            roleId,
            life: chainDuration,
            duration: chainDuration,
            plasma,
            seed: Math.random() * 1000,
        });
        const angle = Math.atan2(endY - y, endX - x);
        const sparkRole = plasma ? 0 : roleId;
        this.spawnProjectileParticle(x, y, angle + Math.PI / 2, 75, sparkRole);
        this.spawnProjectileParticle(endX, endY, angle - Math.PI / 2, 95, sparkRole);
        if (plasma) {
            this.spawnProjectileParticle(endX, endY, Math.random() * Math.PI * 2, 110, 0);
        }
        this.audio.play(BattleSound.Chain, plasma ? 1.1 : 0.85);
    }

    /** 在实际刷出敌人的 x、y 生成出场色环，radius 来自敌人体型。 */
    showSpawnArrival(x: number, y: number, radius: number, enemyConfigId: number) {
        this.ent.EffectModel.effects.push({
            kind: EffectKind.SpawnArrival,
            x,
            y,
            endX: x,
            endY: y,
            radius,
            amount: enemyConfigId,
            roleId: 0,
            life: spawnArrivalDuration,
            duration: spawnArrivalDuration,
        });
        this.audio.play(BattleSound.Spawn);
    }

    /** 在 x、y 生成敌人死亡色环和碎片，boss 决定是否触发整场慢放与强顿帧。 */
    showEnemyDeath(x: number, y: number, radius: number, enemyConfigId: number, boss: boolean = false) {
        const model = this.ent.EffectModel;
        const kind = boss ? EffectKind.BossDeath : EffectKind.EnemyDeath;
        const life = boss ? bossDeathDuration : enemyDeathDuration;
        model.effects.push({ kind, x, y, endX: x, endY: y, radius, amount: enemyConfigId, roleId: 0, life, duration: life });
        model.totalKills += 1;
        model.killStreak += 1;
        model.killStreakTimer = killStreakWindow;
        if (boss) {
            model.slowLife = Math.max(model.slowLife, bossSlowDuration);
            this.triggerHitstop(0.085, true);
            this.shake(impactShakeDuration * 1.8, 11);
            this.addCameraShake(6, 0.45);
            this.audio.play(BattleSound.BossDeath);
        } else {
            this.shake(impactShakeDuration * 0.55, 3.2);
            this.audio.play(BattleSound.EnemyDeath);
        }
        const count = boss ? 22 : 5 + Math.floor(Math.random() * 4);
        for (let index = 0; index < count; index++) {
            const speed = boss ? 105 + Math.random() * 190 : 60 + Math.random() * 120;
            this.spawnProjectileParticle(x, y, Math.random() * 2 * Math.PI, speed, 0, enemyConfigId, undefined, boss ? 1.4 : 1.05);
        }
    }

    /** 记录撞墙的 x、y、方向 angle 和墙面种类，knife 表示飞刀。 */
    showWallResidue(x: number, y: number, angle: number, wallAngle: number, roleId: number, knife: boolean, speed: number) {
        const kind = knife ? EffectKind.WallKnife : EffectKind.WallArrow;
        const life = knife ? knifeResidueDuration : arrowResidueDuration;
        this.ent.EffectModel.effects.push({ kind, x, y, endX: wallAngle, endY: speed, radius: 0, amount: angle, roleId, life, duration: life });
    }

    /** 为角色下标 source 记录受击闪白并触发全屏红闪与短顿帧。 */
    showPlayerHurt(source: number) {
        const model = this.ent.EffectModel;
        model.hurtLife.set(source, playerHurtDuration);
        model.screenHurtFlash = screenHurtFlashDuration;
        this.triggerHitstop(0.036, true);
        this.audio.play(BattleSound.PlayerHurt);
    }

    /** 添加一次可叠加的双轴随机受伤震动。 */
    showPlayerHurtShake() {
        this.addCameraShake(collisionShakeAmplitude, collisionShakeDuration);
    }

    /** 每显示一个胜利播报字符，添加一次短震。 */
    showVictoryAnnouncementShake() {
        this.addCameraShake(3, 0.075);
    }

    /** 触发短促打击顿帧 duration 秒，force 为 true 时忽略冷却强制触发。 */
    triggerHitstop(duration: number, force: boolean = false) {
        const model = this.ent.EffectModel;
        if (!force && model.hitstopCooldown > 0) {
            return;
        }
        model.hitstopLife = Math.max(model.hitstopLife, duration);
        model.hitstopCooldown = hitstopCooldownDuration;
    }

    /** 添加双轴随机震动，amplitude 为原版坐标单位，duration 为秒。 */
    private addCameraShake(amplitude: number, duration: number) {
        const sampleCount = Math.floor(duration * collisionShakeFrequency);
        const samplesX = [0];
        const samplesY = [0];
        for (let index = 0; index < sampleCount; index++) {
            samplesX.push(2 * Math.random() - 1);
            samplesY.push(2 * Math.random() - 1);
        }
        samplesX.push(0);
        samplesY.push(0);
        this.ent.EffectModel.collisionShakes.push({ elapsed: 0, amplitude, duration, samplesX, samplesY });
    }

    /** 根据蛇头反弹前的朝向 heading 给镜头弹簧施加初始偏移。 */
    showPlayerWallShake(heading: number) {
        const model = this.ent.EffectModel;
        model.wallShakeX += wallShakeAmplitude * Math.cos(heading);
        model.wallShakeY -= wallShakeAmplitude * Math.sin(heading);
    }

    /** 按现实时间 delta 推进可叠加随机震动、墙面弹簧与全屏反馈。 */
    updateCollisionShake(delta: number) {
        const model = this.ent.EffectModel;
        model.hitstopCooldown = Math.max(0, model.hitstopCooldown - delta);
        model.screenHurtFlash = Math.max(0, model.screenHurtFlash - delta);
        model.wallFlashLife.forEach((life, side) => {
            if (life > delta) {
                model.wallFlashLife.set(side, life - delta);
            } else {
                model.wallFlashLife.delete(side);
            }
        });
        if (model.killStreakTimer > 0) {
            model.killStreakTimer = Math.max(0, model.killStreakTimer - delta);
            if (model.killStreakTimer === 0) {
                model.killStreak = 0;
            }
        }
        model.collisionShakeX = 0;
        model.collisionShakeY = 0;
        model.collisionShakes = model.collisionShakes.filter((shake) => {
            shake.elapsed += delta;
            if (shake.elapsed >= shake.duration) {
                return false;
            }
            const sample = shake.elapsed * collisionShakeFrequency;
            const index = Math.floor(sample);
            const blend = sample - index;
            const amplitude = shake.amplitude * (1 - shake.elapsed / shake.duration);
            model.collisionShakeX += (shake.samplesX[index] * (1 - blend) + shake.samplesX[index + 1] * blend) * amplitude;
            model.collisionShakeY += (shake.samplesY[index] * (1 - blend) + shake.samplesY[index + 1] * blend) * amplitude;
            return true;
        });
        let remaining = Math.min(delta, 0.1);
        while (remaining > 0) {
            const step = Math.min(remaining, 1 / collisionShakeFrequency);
            model.wallVelocityX -= (wallSpringStiffness * model.wallShakeX + wallSpringDamping * model.wallVelocityX) * step;
            model.wallVelocityY -= (wallSpringStiffness * model.wallShakeY + wallSpringDamping * model.wallVelocityY) * step;
            model.wallShakeX += model.wallVelocityX * step;
            model.wallShakeY += model.wallVelocityY * step;
            remaining -= step;
        }
        if (Math.abs(model.wallShakeX) + Math.abs(model.wallShakeY) + Math.abs(model.wallVelocityX) + Math.abs(model.wallVelocityY) < 0.001) {
            model.wallShakeX = 0;
            model.wallShakeY = 0;
            model.wallVelocityX = 0;
            model.wallVelocityY = 0;
        }
    }

    /** 在退场位置生成角色色收束环和碎片，并触发顿帧与短暂慢放。 */
    showPlayerDeath(x: number, y: number, roleId: number) {
        const model = this.ent.EffectModel;
        model.slowLife = Math.max(model.slowLife, playerDeathSlowDuration);
        model.screenHurtFlash = screenHurtFlashDuration * 1.25;
        this.triggerHitstop(0.055, true);
        model.effects.push({ kind: EffectKind.PlayerDeath, x, y, endX: x, endY: y, radius: 40, amount: 0, roleId, life: playerDeathDuration, duration: playerDeathDuration });
        this.shake(playerHurtDuration * 1.3, 7);
        this.audio.play(BattleSound.PlayerDeath);
        const count = 8 + Math.floor(Math.random() * 4);
        for (let index = 0; index < count; index++) {
            this.spawnProjectileParticle(x, y, Math.random() * 2 * Math.PI, 65 + Math.random() * 130, roleId, undefined, undefined, 1.2);
        }
    }

    /** 为 x、y 的暴击生成亮环、星芒、顿帧及攻击方和受击方颜色的碎片。 */
    showCritical(x: number, y: number, roleId: number, enemyConfigId: number) {
        const model = this.ent.EffectModel;
        model.totalCrits += 1;
        model.effects.push({ kind: EffectKind.Critical, x, y, endX: x, endY: y, radius: 40, amount: 0, roleId, life: criticalDuration, duration: criticalDuration });
        this.shake(criticalDuration, 7.5);
        this.triggerHitstop(0.022);
        this.audio.play(BattleSound.Crit);
        for (let index = 0; index < 4; index++) {
            this.spawnProjectileParticle(x, y, Math.random() * 2 * Math.PI, 120 + Math.random() * 280, roleId, undefined, undefined, 1.3);
            this.spawnProjectileParticle(x, y, Math.random() * 2 * Math.PI, 120 + Math.random() * 280, roleId, enemyConfigId, undefined, 1.2);
        }
    }

    /** 触发神圣惩罚全场雷鸣的强镜头震动与音效。 */
    showThunderShake() {
        this.shake(impactShakeDuration * 1.6, 8);
        this.audio.play(BattleSound.BossDeath, 0.6);
    }

    /** 以 duration 秒和 amplitude 战场单位请求镜头震动，保留较强的当前冲击。 */
    private shake(duration: number, amplitude: number) {
        const model = this.ent.EffectModel;
        if (model.shakeLife > 0 && model.shakeAmplitude * (model.shakeLife / model.shakeDuration) ** 2 > amplitude) {
            return;
        }
        model.shakeLife = duration;
        model.shakeDuration = duration;
        model.shakeAmplitude = amplitude;
    }

    /** 从 shot 当前位置发出尾迹，奥术师按弹道反方向散开并跟随主球闪亮。 */
    showProjectileTrail(shot: IProjectileData, roleId: number, arcane: boolean) {
        const angle = arcane ? shot.angle + Math.PI + (Math.random() - 0.5) * Math.PI / 3 : Math.random() * Math.PI * 2;
        const speed = arcane ? 10 + Math.random() * 15 : 50 + Math.random() * 100;
        this.spawnProjectileParticle(shot.x, shot.y, angle, speed, roleId, undefined, arcane ? shot : undefined);
    }

    /** 生成从 x、y 沿 angle 运动的碎片，speed 为原版初速，sizeScale 为额外显示倍率，颜色由角色、敌人或主球状态决定。 */
    private spawnProjectileParticle(x: number, y: number, angle: number, speed: number, roleId: number, enemyConfigId?: number, parentShot?: IProjectileData, sizeScale?: number) {
        const duration = 0.2 + Math.random() * 0.4;
        this.ent.EffectModel.projectileHitParticles.push({
            x,
            y,
            directionX: Math.cos(angle),
            directionY: Math.sin(angle),
            speed: speed * projectileParticleScale,
            width: (3.5 + Math.random() * 3.5) * projectileParticleScale,
            duration,
            life: duration,
            sizeFactor: 1,
            sizeScale,
            roleId,
            enemyConfigId,
            parentShot,
        });
    }

    /** 推进 delta 秒表现时间，更新飘字弹性运动、撞墙波浪并删除过期效果。 */
    update(delta: number) {
        const model = this.ent.EffectModel;
        model.shakeLife = Math.max(0, model.shakeLife - delta);
        model.wallRipples = model.wallRipples.filter((ripple) => {
            ripple.delay -= delta;
            if (ripple.delay <= 0) {
                model.recoilLife.set(ripple.source, recoilDuration);
                this.audio.play(BattleSound.WallHit, 0.55);
                return false;
            }
            return true;
        });
        model.recoilLife.forEach((life, source) => {
            if (life > delta) {
                model.recoilLife.set(source, life - delta);
            } else {
                model.recoilLife.delete(source);
            }
        });
        model.hurtLife.forEach((life, source) => {
            if (life > delta) {
                model.hurtLife.set(source, life - delta);
            } else {
                model.hurtLife.delete(source);
            }
        });
        model.effects.forEach((effect) => {
            effect.life -= delta;
            if (effect.vx !== undefined && effect.vy !== undefined) {
                effect.x += effect.vx * delta;
                effect.y += effect.vy * delta;
                effect.vx *= Math.max(0, 1 - 4.2 * delta);
                effect.vy -= (effect.critical ? 235 : 175) * delta;
            }
        });
        model.effects = model.effects.filter((effect) => {
            return effect.life > 0;
        });
        model.projectileHitParticles = model.projectileHitParticles.filter((particle) => {
            particle.life -= delta;
            if (particle.life <= 0) {
                return false;
            }
            const remaining = particle.life / particle.duration;
            particle.sizeFactor = remaining < 0.5 ? 4 * remaining ** 3 : 1 - 4 * (1 - remaining) ** 3;
            const distance = particle.speed * particle.sizeFactor * delta;
            particle.x += particle.directionX * distance;
            particle.y += particle.directionY * distance;
            return true;
        });
    }
}

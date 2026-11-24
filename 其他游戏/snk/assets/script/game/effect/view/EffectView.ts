import { _decorator, Color, Component, Graphics, Label, Node, UITransform } from "cc";
import type { Game } from "../../game/Game";
import { ColorConst } from "../../common/config/ColorConst";
import { TableCombatRule } from "../../common/table/TableCombatRule";
import { TableBattleRule } from "../../common/table/TableBattleRule";
import {
    ArenaWallSide,
    EffectKind,
    arrowResidueDuration,
    bossDeathDuration,
    buffPulseDuration,
    chainDuration,
    coinStrikeDuration,
    criticalDuration,
    enemyDeathDuration,
    knifeResidueDuration,
    muzzleDuration,
    pickupRippleDuration,
    playerDeathDuration,
    projectileEndDuration,
    projectileParticleEndSize,
    screenHurtFlashDuration,
    shieldBlockDuration,
    spawnArrivalDuration,
    spawnRingDuration,
    summonBlinkDuration,
    tagTextDuration,
    wallImpactDuration,
    wallResidueBlinkDuration,
} from "../EffectEvent";
import type { IEffectData } from "../EffectEvent";
import { CombatCamp } from "../../combat/CombatEvent";
import { BuffKind } from "../../buff/BuffEvent";
import { RoleKeyEnum } from "../../common/table/RoleKeyEnum";
import { EnemyKeyEnum } from "../../common/table/EnemyKeyEnum";
import { SummonTypeKeyEnum } from "../../common/table/SummonTypeKeyEnum";
import { TablePlayerSkill } from "../../common/table/TablePlayerSkill";
import type { IProjectileData } from "../../projectile/ProjectileEvent";
import { spellbladeLength, spellbladeThickness } from "../../projectile/ProjectileEvent";
import type { ICombatArea, ISummonData } from "../../summon/SummonEvent";
import { EnemyObjectKind } from "../../enemy/EnemyEvent";
import type { IEnemyData, IEnemyObject } from "../../enemy/EnemyEvent";

const { ccclass } = _decorator;
const arcCoordinateScale = 3;
const arcReferenceRadius = 32;
const arcRadiusSpan = 256 - arcReferenceRadius;
const illusionOutline = [[11, 0], [0, 7], [-11, 0], [0, -7]];
const summonOutlines = new Map<number, number[][]>([
    [SummonTypeKeyEnum.Sentry, [[12, 2], [3, 3], [2, 12], [-2, 12], [-3, 3], [-12, 2], [-12, -2], [-3, -3], [-2, -12], [2, -12], [3, -3], [12, -2]]],
    [SummonTypeKeyEnum.Turret, [[15, -3], [15, 3], [5, 3], [5, 8], [-8, 8], [-10, 0], [-8, -8], [5, -8], [5, -3]]],
    [SummonTypeKeyEnum.Tree, [[10, 0], [4, 5], [8, 9], [0, 7], [-8, 9], [-5, 0], [-8, -9], [0, -7], [8, -9], [4, -5]]],
    [SummonTypeKeyEnum.Volcano, [[9, 5], [3, 10], [-7, 12], [-10, 0], [-7, -12], [3, -10], [9, -5], [4, 0]]],
    [SummonTypeKeyEnum.Pet, [[12, 0], [4, 5], [-6, 7], [-10, 3], [-7, 0], [-10, -3], [-6, -7], [4, -5]]],
    [SummonTypeKeyEnum.Critter, [[7, 0], [3, 5], [-5, 4], [-7, 0], [-5, -4], [3, -5]]],
    [SummonTypeKeyEnum.Saboteur, [[12, 0], [2, 8], [-9, 5], [-5, 0], [-9, -5], [2, -8]]],
    [SummonTypeKeyEnum.Automaton, [[9, 0], [6, 8], [-7, 8], [-10, 4], [-10, -4], [-7, -8], [6, -8]]],
]);

@ccclass("CombatEffectView")
export class EffectView extends Component {
    private labels: Label[] = [];

    render(game: Game, floorGraphics?: Graphics) {
        const graphics = this.getComponent(Graphics);
        const floor = floorGraphics ?? graphics;
        const arena = this.getComponent(UITransform);
        const rule = TableCombatRule.getCurrent();
        const elapsed = game.combat.CombatModel.elapsed;
        const players = game.player.PlayerModel.players;
        graphics.clear();
        if (floor !== graphics) {
            floor.clear();
        }

        const previousLineCap = graphics.lineCap;
        const previousLineWidth = graphics.lineWidth;
        const previousStrokeColor = graphics.strokeColor.clone();

        this.drawArenaAtmosphere(floor, arena.width, arena.height, game);
        this.drawSnakeFlow(floor, game, elapsed);
        this.drawSteeringGuide(floor, game, elapsed);

        game.summon.SummonModel.areas.forEach((area) => {
            this.drawZone(floor, area, players[area.source].roleId, elapsed);
        });

        this.drawEnemyTelegraphs(floor, game, elapsed);
        this.drawEnemyObjects(floor, game, elapsed);
        this.drawEnemyStatuses(graphics, game, elapsed);

        graphics.lineCap = Graphics.LineCap.ROUND;
        game.projectile.ProjectileModel.projectiles.forEach((shot) => {
            if (shot.delay > 0 || shot.dead) {
                return;
            }
            this.drawProjectile(graphics, shot, players[shot.source].roleId, elapsed);
        });

        game.projectile.ProjectileModel.enemyProjectiles.forEach((shot) => {
            if (shot.delay > 0 || shot.dead) {
                return;
            }
            this.drawEnemyProjectile(graphics, shot, elapsed);
        });

        graphics.lineCap = previousLineCap;
        graphics.lineWidth = previousLineWidth;
        graphics.strokeColor = previousStrokeColor;

        game.summon.SummonModel.summons.forEach((summon) => {
            this.drawSummon(graphics, summon, players[summon.source].roleId, elapsed);
        });

        game.summon.SummonModel.orbs.forEach((orb) => {
            this.drawHealOrb(graphics, orb.x, orb.y, rule.orbRadius, elapsed);
        });

        this.drawPlayerAuras(graphics, game, rule.shieldRadius, elapsed);

        graphics.lineWidth = rule.effectLineWidth;
        const texts = game.effect.EffectModel.effects.filter((effect) => {
            if (effect.kind === EffectKind.Area) {
                const farthestCorner = Math.hypot(arena.width / 2 + Math.abs(effect.x), arena.height / 2 + Math.abs(effect.y));
                const radius = effect.squareAngle === undefined ? Math.min(effect.radius, farthestCorner) : effect.radius;
                this.drawArea(graphics, effect, rule.effectLife, rule.effectLineWidth, radius);
            } else if (effect.kind === EffectKind.Chain) {
                this.drawChain(graphics, effect, elapsed);
            } else if (effect.kind === EffectKind.ProjectileHit || effect.kind === EffectKind.ProjectileEnd) {
                let radius = effect.radius;
                if (effect.kind === EffectKind.ProjectileEnd) {
                    const remaining = effect.life / projectileEndDuration;
                    radius *= remaining < 0.5 ? 4 * remaining ** 3 : 1 - 4 * (1 - remaining) ** 3;
                }
                graphics.fillColor = ColorConst.shopText;
                graphics.circle(effect.x, effect.y, radius);
                graphics.fill();
            } else if (effect.kind === EffectKind.Muzzle) {
                this.drawMuzzle(graphics, effect);
            } else if (effect.kind === EffectKind.EnemyDeath) {
                this.drawEnemyDeath(graphics, effect, rule.effectLineWidth);
            } else if (effect.kind === EffectKind.SpawnArrival || effect.kind === EffectKind.BossDeath) {
                this.drawEnemyBurst(graphics, effect);
            } else if (effect.kind === EffectKind.Critical || effect.kind === EffectKind.PlayerDeath) {
                this.drawCriticalOrPlayerDeath(graphics, effect);
            } else if (effect.kind === EffectKind.WallArrow || effect.kind === EffectKind.WallKnife) {
                this.drawWallResidue(graphics, effect);
            } else if (effect.kind === EffectKind.WallImpact) {
                this.drawWallImpact(graphics, effect);
            } else if (effect.kind === EffectKind.PickupRipple) {
                this.drawPickupRipple(graphics, effect);
            } else if (effect.kind === EffectKind.ShieldBlock) {
                this.drawShieldBlock(graphics, effect);
            } else if (effect.kind === EffectKind.SpawnRing) {
                this.drawSpawnRing(graphics, effect);
            } else if (effect.kind === EffectKind.BuffPulse) {
                this.drawBuffPulse(graphics, effect);
            } else if (effect.kind === EffectKind.CoinStrike) {
                this.drawCoinStrike(graphics, effect);
            }
            return effect.kind === EffectKind.Damage || effect.kind === EffectKind.Heal || effect.kind === EffectKind.TagText;
        });

        this.drawParticles(graphics, game, previousLineCap);
        this.drawWallFlashesAndVignette(graphics, arena.width, arena.height, game, elapsed);
        this.renderFloatingTexts(texts, rule);
    }

    private drawArenaAtmosphere(graphics: Graphics, width: number, height: number, game: Game) {
        const halfW = width / 2;
        const halfH = height / 2;
        graphics.strokeColor = ColorConst.battleArenaGrid;
        graphics.lineWidth = 1.5;

        const step = 120;
        for (let x = -Math.floor(halfW / step) * step; x <= halfW; x += step) {
            graphics.moveTo(x, -halfH);
            graphics.lineTo(x, halfH);
        }
        for (let y = -Math.floor(halfH / step) * step; y <= halfH; y += step) {
            graphics.moveTo(-halfW, y);
            graphics.lineTo(halfW, y);
        }
        graphics.stroke();

        const cross = 16;
        graphics.strokeColor = ColorConst.battleArenaCross;
        graphics.lineWidth = 2;
        graphics.moveTo(-cross, 0);
        graphics.lineTo(cross, 0);
        graphics.moveTo(0, -cross);
        graphics.lineTo(0, cross);
        graphics.stroke();

        const cornerInset = 24;
        const cornerArm = 26;
        const corners = [
            [-halfW + cornerInset, -halfH + cornerInset, 1, 1],
            [halfW - cornerInset, -halfH + cornerInset, -1, 1],
            [-halfW + cornerInset, halfH - cornerInset, 1, -1],
            [halfW - cornerInset, halfH - cornerInset, -1, -1],
        ];
        for (const [cx, cy, sx, sy] of corners) {
            graphics.moveTo(cx, cy + sy * cornerArm);
            graphics.lineTo(cx, cy);
            graphics.lineTo(cx + sx * cornerArm, cy);
        }
        graphics.stroke();

        const streak = game.effect.EffectModel.killStreak;
        if (streak >= 4) {
            const pulse = Math.min(1, (streak - 3) / 10);
            const ringColor = ColorConst.battleCritGold.clone();
            ringColor.a = Math.round(20 + 28 * pulse);
            graphics.strokeColor = ringColor;
            graphics.lineWidth = 2;
            graphics.circle(0, 0, 42 + pulse * 16);
            graphics.stroke();
        }
    }

    private drawSnakeFlow(graphics: Graphics, game: Game, elapsed: number) {
        const playerModel = game.player.PlayerModel;
        const alive = playerModel.players.filter((unit) => {
            return unit.hp > 0;
        });
        if (!alive.length) {
            return;
        }
        const leader = alive[0];
        const leaderColor = ColorConst.getPlayerColor(leader.roleId);
        const history = playerModel.history;
        if (history.length > 2) {
            const sampleLimit = Math.min(history.length, 20);
            graphics.lineCap = Graphics.LineCap.ROUND;
            for (let index = 1; index < sampleLimit; index++) {
                const prev = history[index - 1];
                const curr = history[index];
                const fade = 1 - index / sampleLimit;
                const trailColor = leaderColor.clone();
                trailColor.a = Math.round(75 * fade * fade);
                graphics.strokeColor = trailColor;
                graphics.lineWidth = Math.max(2, 12 * fade);
                graphics.moveTo(prev.x, prev.y);
                graphics.lineTo(curr.x, curr.y);
                graphics.stroke();
            }
        }
        if (alive.length > 1) {
            graphics.lineCap = Graphics.LineCap.ROUND;
            for (let index = 0; index < alive.length - 1; index++) {
                const from = alive[index];
                const to = alive[index + 1];
                const linkColor = ColorConst.getPlayerColor(from.roleId);
                linkColor.a = 95;
                graphics.strokeColor = linkColor;
                graphics.lineWidth = 5;
                graphics.moveTo(from.pose.x, from.pose.y);
                graphics.lineTo(to.pose.x, to.pose.y);
                graphics.stroke();
            }
        }
        const headAngle = playerModel.heading;
        const tipDist = leader.config.bodySize * 0.85 + 2 * Math.sin(elapsed * 10);
        const tipX = leader.pose.x + Math.cos(headAngle) * tipDist;
        const tipY = leader.pose.y + Math.sin(headAngle) * tipDist;
        const leftX = tipX + Math.cos(headAngle + 2.45) * 9;
        const leftY = tipY + Math.sin(headAngle + 2.45) * 9;
        const rightX = tipX + Math.cos(headAngle - 2.45) * 9;
        const rightY = tipY + Math.sin(headAngle - 2.45) * 9;
        const arrowColor = ColorConst.WHITE.clone();
        arrowColor.a = 185;
        graphics.strokeColor = arrowColor;
        graphics.lineWidth = 2.5;
        graphics.moveTo(leftX, leftY);
        graphics.lineTo(tipX, tipY);
        graphics.lineTo(rightX, rightY);
        graphics.stroke();
    }

    private drawSteeringGuide(graphics: Graphics, game: Game, elapsed: number) {
        const battle = game.battle.BattleModel;
        if (battle.steerFade <= 0.01) {
            return;
        }
        const head = game.player.PlayerModel.players.find((unit) => {
            return unit.hp > 0;
        });
        if (!head) {
            return;
        }
        const alpha = battle.steerFade;
        const dx = battle.steerX - head.pose.x;
        const dy = battle.steerY - head.pose.y;
        const distance = Math.hypot(dx, dy);
        const guideColor = ColorConst.battleArenaGuide.clone();
        guideColor.a = Math.round(135 * alpha);
        if (distance > 34) {
            const nx = dx / distance;
            const ny = dy / distance;
            graphics.strokeColor = guideColor;
            graphics.lineWidth = 2;
            const start = 26;
            const end = distance - 18;
            const dash = 12;
            const gap = 10;
            for (let cursor = start; cursor < end; cursor += dash + gap) {
                const segEnd = Math.min(end, cursor + dash);
                graphics.moveTo(head.pose.x + nx * cursor, head.pose.y + ny * cursor);
                graphics.lineTo(head.pose.x + nx * segEnd, head.pose.y + ny * segEnd);
            }
            graphics.stroke();
        }
        const ringRadius = 15 + 3 * Math.sin(elapsed * 12) + (1 - alpha) * 10;
        const ringColor = ColorConst.getPlayerColor(head.roleId);
        ringColor.a = Math.round(190 * alpha);
        graphics.strokeColor = ringColor;
        graphics.lineWidth = 2.5;
        for (let quarter = 0; quarter < 4; quarter++) {
            const base = quarter * Math.PI / 2 + elapsed * 1.8;
            graphics.arc(battle.steerX, battle.steerY, ringRadius, base, base + Math.PI / 4, true);
            graphics.stroke();
        }
        const dotColor = ColorConst.WHITE.clone();
        dotColor.a = Math.round(210 * alpha);
        graphics.fillColor = dotColor;
        graphics.circle(battle.steerX, battle.steerY, 3.5);
        graphics.fill();
    }

    private drawEnemyTelegraphs(graphics: Graphics, game: Game, elapsed: number) {
        const enemies = game.enemy.EnemyModel.enemies;
        for (const enemy of enemies) {
            if (enemy.dead) {
                continue;
            }
            if (enemy.config.id === EnemyKeyEnum.Headbutter && enemy.chargeRemaining > 0) {
                const windup = enemy.chargeRemaining > enemy.config.skillDuration;
                if (windup && enemy.config.skillDelay > 0) {
                    const progress = 1 - Math.min(1, (enemy.chargeRemaining - enemy.config.skillDuration) / enemy.config.skillDelay);
                    const telegraphLength = Math.min(240, enemy.config.skillSpeed * enemy.config.skillDuration * 0.72);
                    const warnColor = ColorConst.battleDangerRed.clone();
                    warnColor.a = Math.round(100 + 145 * progress);
                    graphics.strokeColor = warnColor;
                    graphics.lineWidth = 2 + 2.5 * progress;
                    const step = 18;
                    for (let cursor = 18; cursor < telegraphLength; cursor += step) {
                        const segEnd = Math.min(telegraphLength, cursor + 10);
                        graphics.moveTo(enemy.x + enemy.chargeX * cursor, enemy.y + enemy.chargeY * cursor);
                        graphics.lineTo(enemy.x + enemy.chargeX * segEnd, enemy.y + enemy.chargeY * segEnd);
                    }
                    graphics.stroke();
                    const tipX = enemy.x + enemy.chargeX * telegraphLength;
                    const tipY = enemy.y + enemy.chargeY * telegraphLength;
                    const chargeAngle = Math.atan2(enemy.chargeY, enemy.chargeX);
                    graphics.moveTo(tipX + Math.cos(chargeAngle + 2.5) * 12, tipY + Math.sin(chargeAngle + 2.5) * 12);
                    graphics.lineTo(tipX, tipY);
                    graphics.lineTo(tipX + Math.cos(chargeAngle - 2.5) * 12, tipY + Math.sin(chargeAngle - 2.5) * 12);
                    graphics.stroke();
                    const shrinkRadius = enemy.config.width * (1.25 - 0.55 * progress);
                    graphics.circle(enemy.x, enemy.y, shrinkRadius);
                    graphics.stroke();
                } else {
                    const wakeColor = ColorConst.getEnemyColor(enemy.config.id);
                    wakeColor.a = 170;
                    graphics.strokeColor = wakeColor;
                    graphics.lineWidth = 4;
                    graphics.moveTo(enemy.x, enemy.y);
                    graphics.lineTo(enemy.x - enemy.chargeX * 38, enemy.y - enemy.chargeY * 38);
                    graphics.stroke();
                }
            }
            if (enemy.forceRemaining > 0) {
                const ratio = enemy.config.skillDelay > 0 ? enemy.forceRemaining / enemy.config.skillDelay : 0.5;
                const forceColor = ColorConst.getEnemyColor(enemy.config.id);
                forceColor.a = 150;
                graphics.strokeColor = forceColor;
                graphics.lineWidth = 3;
                const radius = enemy.config.skillRange * (0.25 + 0.75 * ratio);
                this.drawFieldArcs(graphics, enemy.forceX, enemy.forceY, radius, elapsed * 6);
                forceColor.a = 35;
                graphics.fillColor = forceColor;
                graphics.circle(enemy.forceX, enemy.forceY, radius);
                graphics.fill();
            }
        }
    }

    private drawEnemyObjects(graphics: Graphics, game: Game, elapsed: number) {
        const warningDuration = TableBattleRule.getCurrent().spawnWarning;
        for (const object of game.enemy.EnemyModel.objects) {
            if (object.delay > 0 || object.dead) {
                continue;
            }
            if (object.kind === EnemyObjectKind.SpawnMarker && object.life > 0) {
                this.drawSpawnMarker(graphics, object, warningDuration);
            } else if (object.kind === EnemyObjectKind.Mine) {
                this.drawMine(graphics, object, elapsed);
            } else if (object.kind === EnemyObjectKind.Gold) {
                this.drawGold(graphics, object, elapsed);
            }
        }
    }

    private drawSpawnMarker(graphics: Graphics, marker: IEnemyObject, warningDuration: number) {
        const progress = 1 - Math.min(1, marker.life / warningDuration);
        const color = ColorConst.getEnemyColor(marker.configId);
        color.a = Math.round(115 + 140 * progress);
        const radius = 38 - 18 * progress;
        graphics.lineWidth = 2.5 + 2 * progress;
        graphics.strokeColor = color;
        for (const quarter of [0, 1, 2, 3]) {
            const angle = quarter * Math.PI / 2 - progress * Math.PI * 0.75;
            graphics.arc(marker.x, marker.y, radius, angle, angle + Math.PI / 3, true);
            graphics.stroke();
        }
        const innerColor = ColorConst.getCombatColor(0, 145 * progress ** 2);
        graphics.fillColor = innerColor;
        graphics.circle(marker.x, marker.y, 3 + 6 * progress);
        graphics.fill();
    }

    private drawMine(graphics: Graphics, mine: IEnemyObject, elapsed: number) {
        const urgency = Math.max(0, 1 - mine.life / 2.4);
        const pulseRate = 8 + urgency * 18;
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * pulseRate);
        const dangerRadius = 32 + 10 * pulse;
        const ringColor = ColorConst.battleDangerRed.clone();
        ringColor.a = Math.round(65 + 125 * pulse);
        graphics.strokeColor = ringColor;
        graphics.lineWidth = 2 + 1.5 * urgency;
        graphics.circle(mine.x, mine.y, dangerRadius);
        graphics.stroke();

        const fillDanger = ColorConst.battleDangerRed.clone();
        fillDanger.a = Math.round(28 + 38 * pulse);
        graphics.fillColor = fillDanger;
        graphics.circle(mine.x, mine.y, dangerRadius * 0.88);
        graphics.fill();

        const coreSize = 8 + 3 * pulse;
        graphics.fillColor = pulse > 0.65 ? ColorConst.WHITE : ColorConst.getEnemyColor(mine.configId);
        graphics.moveTo(mine.x, mine.y + coreSize);
        graphics.lineTo(mine.x + coreSize, mine.y);
        graphics.lineTo(mine.x, mine.y - coreSize);
        graphics.lineTo(mine.x - coreSize, mine.y);
        graphics.close();
        graphics.fill();
    }

    private drawGold(graphics: Graphics, gold: IEnemyObject, elapsed: number) {
        const spin = elapsed * 4.5 + gold.id * 1.1;
        const widthScale = 0.45 + 0.55 * Math.abs(Math.cos(spin));
        const bobY = Math.sin(elapsed * 6 + gold.id) * 2.5;
        const x = gold.x;
        const y = gold.y + bobY;

        const halo = ColorConst.battleCritGold.clone();
        halo.a = 55;
        graphics.fillColor = halo;
        graphics.circle(x, y, 11);
        graphics.fill();

        const rx = 8.5 * widthScale;
        const ry = 10;
        graphics.fillColor = ColorConst.battleCritGold;
        graphics.moveTo(x, y + ry);
        graphics.lineTo(x + rx, y);
        graphics.lineTo(x, y - ry);
        graphics.lineTo(x - rx, y);
        graphics.close();
        graphics.fill();

        const shine = Math.max(0, Math.sin(elapsed * 7 + gold.id * 2.3) - 0.65) / 0.35;
        if (shine > 0) {
            const glint = ColorConst.WHITE.clone();
            glint.a = Math.round(230 * shine);
            graphics.strokeColor = glint;
            graphics.lineWidth = 2;
            const arm = 6 * shine;
            graphics.moveTo(x - arm, y);
            graphics.lineTo(x + arm, y);
            graphics.moveTo(x, y - arm);
            graphics.lineTo(x, y + arm);
            graphics.stroke();
        }
    }

    private drawEnemyStatuses(graphics: Graphics, game: Game, elapsed: number) {
        const enemies = game.enemy.EnemyModel.enemies;
        const enemyMap = new Map<number, IEnemyData>();
        enemies.forEach((enemy) => {
            if (!enemy.dead) {
                enemyMap.set(enemy.id, enemy);
                if (enemy.config.boss) {
                    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5);
                    const aura = ColorConst.getEnemyColor(enemy.config.id);
                    aura.a = Math.round(80 + 75 * pulse);
                    graphics.strokeColor = aura;
                    graphics.lineWidth = 3;
                    this.drawFieldArcs(graphics, enemy.x, enemy.y, Math.max(enemy.config.width, enemy.config.height) * 0.78, elapsed * 1.4);
                }
                if (enemy.boostRemaining > 0) {
                    const boostColor = ColorConst.battleBoostOrange.clone();
                    boostColor.a = 175;
                    graphics.strokeColor = boostColor;
                    graphics.lineWidth = 2.5;
                    const rad = enemy.angle * Math.PI / 180;
                    graphics.moveTo(enemy.x - Math.cos(rad) * 10, enemy.y - Math.sin(rad) * 10);
                    graphics.lineTo(enemy.x - Math.cos(rad) * 28, enemy.y - Math.sin(rad) * 28);
                    graphics.stroke();
                }
            }
        });
        const drawnSlow = new Set<number>();
        const drawnStun = new Set<number>();
        const drawnDot = new Set<number>();
        game.buff.BuffModel.buffs.forEach((buff) => {
            if (buff.camp !== CombatCamp.Enemy || buff.remaining <= 0) {
                return;
            }
            const enemy = enemyMap.get(buff.target);
            if (!enemy) {
                return;
            }
            const radius = Math.max(enemy.config.width, enemy.config.height) * 0.62;
            if (buff.kind === BuffKind.Slow && !drawnSlow.has(enemy.id)) {
                drawnSlow.add(enemy.id);
                const slowColor = ColorConst.battleSlowBlue.clone();
                slowColor.a = 175;
                graphics.strokeColor = slowColor;
                graphics.lineWidth = 2.5;
                graphics.circle(enemy.x, enemy.y, radius);
                graphics.stroke();
            } else if (buff.kind === BuffKind.Dot && !drawnDot.has(enemy.id)) {
                drawnDot.add(enemy.id);
                const dotColor = ColorConst.battleDotPurple.clone();
                dotColor.a = Math.round(120 + 80 * Math.sin(elapsed * 10));
                graphics.strokeColor = dotColor;
                graphics.lineWidth = 2;
                graphics.circle(enemy.x, enemy.y, radius + 4);
                graphics.stroke();
            } else if (buff.kind === BuffKind.Stun && !drawnStun.has(enemy.id)) {
                drawnStun.add(enemy.id);
                graphics.fillColor = ColorConst.battleCritGold;
                for (let star = 0; star < 3; star++) {
                    const angle = elapsed * 6 + star * Math.PI * 2 / 3;
                    graphics.circle(enemy.x + Math.cos(angle) * (radius * 0.72), enemy.y + radius * 0.75 + Math.sin(angle) * 4, 3);
                    graphics.fill();
                }
            }
        });
    }

    private drawPlayerAuras(graphics: Graphics, game: Game, shieldRadius: number, elapsed: number) {
        const players = game.player.PlayerModel.players;
        const drawnChain = new Set<number>();
        const drawnSpeed = new Set<number>();
        const drawnRevive = new Set<number>();
        const drawnDefense = new Set<number>();

        game.buff.BuffModel.buffs.forEach((buff) => {
            if (buff.camp !== CombatCamp.Player || buff.remaining <= 0) {
                return;
            }
            const player = players[buff.target];
            if (!player || player.hp <= 0) {
                return;
            }
            const half = player.config.bodySize * 0.66;
            const rad = player.pose.angle * Math.PI / 180;
            if (buff.kind === BuffKind.Shield) {
                if (buff.remaining <= 0.4 && Math.floor(buff.remaining / 0.05) % 2 === 0) {
                    return;
                }
                const fresh = buff.duration - buff.remaining < 0.18;
                const pulse = 0.5 + 0.5 * Math.sin(elapsed * 8);
                const color = fresh ? ColorConst.WHITE.clone() : ColorConst.battleWardenGold.clone();
                color.a = Math.round(170 + 75 * pulse);
                graphics.strokeColor = color;
                graphics.lineWidth = 3;
                graphics.circle(player.pose.x, player.pose.y, shieldRadius);
                graphics.stroke();

                const fill = color.clone();
                fill.a = 24;
                graphics.fillColor = fill;
                graphics.circle(player.pose.x, player.pose.y, shieldRadius);
                graphics.fill();

                const accent = ColorConst.battleShieldCyan.clone();
                accent.a = Math.round(125 + 85 * pulse);
                graphics.strokeColor = accent;
                graphics.lineWidth = 2;
                for (let seg = 0; seg < 4; seg++) {
                    const start = elapsed * 2.4 + seg * Math.PI / 2;
                    graphics.arc(player.pose.x, player.pose.y, shieldRadius + 5, start, start + Math.PI / 4, true);
                    graphics.stroke();
                }
            } else if (buff.kind === BuffKind.Chain && !drawnChain.has(buff.target)) {
                drawnChain.add(buff.target);
                this.drawPlasmaAura(graphics, player.pose.x, player.pose.y, player.config.bodySize * 0.72, elapsed + buff.target * 0.7);
            } else if (buff.kind === BuffKind.AttackSpeed && !drawnSpeed.has(buff.target)) {
                drawnSpeed.add(buff.target);
                this.drawRotatedFrame(graphics, player.pose.x, player.pose.y, half, rad, ColorConst.battleFairyBlue, 2.5);
            } else if (buff.kind === BuffKind.Revive && !drawnRevive.has(buff.target)) {
                drawnRevive.add(buff.target);
                this.drawRotatedFrame(graphics, player.pose.x, player.pose.y, half + 3, rad, ColorConst.battleReviveGreen, 2.5);
            } else if (buff.kind === BuffKind.Defense && !drawnDefense.has(buff.target)) {
                drawnDefense.add(buff.target);
                this.drawRotatedFrame(graphics, player.pose.x, player.pose.y, half + 2, rad, ColorConst.battleDefenseGold, 2.5);
            } else if (buff.kind === BuffKind.Invulnerable) {
                const invColor = ColorConst.WHITE.clone();
                invColor.a = Math.round(145 + 100 * Math.abs(Math.sin(elapsed * 16)));
                this.drawRotatedFrame(graphics, player.pose.x, player.pose.y, half + 3, rad, invColor, 3);
            }
        });
        players.forEach((player) => {
            if (player.hp > 0 && player.stats.hp > 0 && player.hp / player.stats.hp <= 0.3) {
                const pulse = 0.5 + 0.5 * Math.sin(elapsed * 12);
                const warn = ColorConst.battleDangerRed.clone();
                warn.a = Math.round(90 + 130 * pulse);
                graphics.strokeColor = warn;
                graphics.lineWidth = 2.5;
                graphics.circle(player.pose.x, player.pose.y, player.config.bodySize * (0.76 + 0.14 * pulse));
                graphics.stroke();
            }
        });
    }

    private drawPlasmaAura(graphics: Graphics, x: number, y: number, radius: number, phase: number) {
        const tick = Math.floor(phase * 20);
        const segments = 10;
        const glow = ColorConst.battlePlasmaGlow.clone();
        graphics.strokeColor = glow;
        graphics.lineWidth = 6;
        for (let step = 0; step <= segments; step++) {
            const angle = (step / segments) * Math.PI * 2 + phase * 2.2;
            const jitter = Math.sin(step * 9.3 + tick * 4.7) * 4.5;
            const px = x + Math.cos(angle) * (radius + jitter);
            const py = y + Math.sin(angle) * (radius + jitter);
            if (step === 0) {
                graphics.moveTo(px, py);
            } else {
                graphics.lineTo(px, py);
            }
        }
        graphics.stroke();

        const core = ColorConst.battlePlasmaBlue.clone();
        core.a = 235;
        graphics.strokeColor = core;
        graphics.lineWidth = 2.2;
        for (let step = 0; step <= segments; step++) {
            const angle = (step / segments) * Math.PI * 2 + phase * 2.2;
            const jitter = Math.sin(step * 9.3 + tick * 4.7) * 4.5;
            const px = x + Math.cos(angle) * (radius + jitter);
            const py = y + Math.sin(angle) * (radius + jitter);
            if (step === 0) {
                graphics.moveTo(px, py);
            } else {
                graphics.lineTo(px, py);
            }
        }
        graphics.stroke();
    }

    private drawRotatedFrame(graphics: Graphics, x: number, y: number, half: number, rad: number, color: Color, lineWidth: number) {
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const corners = [
            [-half, -half],
            [half, -half],
            [half, half],
            [-half, half],
        ];
        graphics.strokeColor = color;
        graphics.lineWidth = lineWidth;
        corners.forEach(([lx, ly], index) => {
            const wx = x + lx * cos - ly * sin;
            const wy = y + lx * sin + ly * cos;
            if (index === 0) {
                graphics.moveTo(wx, wy);
            } else {
                graphics.lineTo(wx, wy);
            }
        });
        graphics.close();
        graphics.stroke();
    }

    private drawHealOrb(graphics: Graphics, x: number, y: number, orbRadius: number, elapsed: number) {
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 9);
        const halo = ColorConst.shopGreen.clone();
        halo.a = Math.round(55 + 55 * pulse);
        graphics.fillColor = halo;
        graphics.circle(x, y, orbRadius * (1.85 + 0.35 * pulse));
        graphics.fill();

        graphics.fillColor = ColorConst.shopGreen;
        graphics.circle(x, y, orbRadius * 1.15);
        graphics.fill();

        graphics.strokeColor = ColorConst.WHITE;
        graphics.lineWidth = 2.2;
        const arm = orbRadius * 0.62;
        graphics.moveTo(x - arm, y);
        graphics.lineTo(x + arm, y);
        graphics.moveTo(x, y - arm);
        graphics.lineTo(x, y + arm);
        graphics.stroke();
    }

    private drawEnemyProjectile(graphics: Graphics, shot: IEnemyObject, elapsed: number) {
        const radius = Math.max(5.5, shot.height / 2);
        const rad = shot.angle * Math.PI / 180;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        const color = ColorConst.getEnemyColor(shot.configId);

        const tail = color.clone();
        tail.a = 120;
        graphics.strokeColor = tail;
        graphics.lineWidth = radius * 1.4;
        graphics.moveTo(shot.x - dx * radius * 2.4, shot.y - dy * radius * 2.4);
        graphics.lineTo(shot.x, shot.y);
        graphics.stroke();

        const glow = color.clone();
        glow.a = Math.round(95 + 45 * Math.sin(elapsed * 20));
        graphics.fillColor = glow;
        graphics.circle(shot.x, shot.y, radius * 1.55);
        graphics.fill();

        graphics.fillColor = color;
        graphics.circle(shot.x, shot.y, radius * 1.05);
        graphics.fill();

        graphics.fillColor = ColorConst.WHITE;
        graphics.circle(shot.x, shot.y, radius * 0.52);
        graphics.fill();
    }

    private drawEnemyDeath(graphics: Graphics, effect: IEffectData, lineWidth: number) {
        const remaining = effect.life / enemyDeathDuration;
        const progress = 1 - remaining;
        const color = ColorConst.getEnemyColor(effect.amount);

        const coreRadius = effect.radius * (remaining < 0.5 ? remaining * 1.6 : 0.8 + (remaining - 0.5) * 0.7);
        if (coreRadius > 0.5) {
            const coreColor = progress < 0.3 ? ColorConst.WHITE.clone() : color.clone();
            coreColor.a = Math.round(235 * remaining);
            graphics.fillColor = coreColor;
            graphics.circle(effect.x, effect.y, coreRadius);
            graphics.fill();
        }

        const ringColor = color.clone();
        ringColor.a = Math.round(230 * remaining);
        graphics.strokeColor = ringColor;
        graphics.lineWidth = lineWidth * (1.2 + remaining * 1.4);
        graphics.circle(effect.x, effect.y, effect.radius * (0.45 + progress * 1.35));
        graphics.stroke();
    }

    private drawCriticalOrPlayerDeath(graphics: Graphics, effect: IEffectData) {
        const critical = effect.kind === EffectKind.Critical;
        const duration = critical ? criticalDuration : playerDeathDuration;
        const remaining = effect.life / duration;
        const progress = 1 - remaining;
        const radius = effect.radius * (0.2 + 0.95 * progress);
        const primaryColor = critical
            ? remaining > 0.65 ? ColorConst.WHITE.clone() : ColorConst.battleCritGold.clone()
            : ColorConst.getCombatColor(remaining > 0.72 ? 0 : effect.roleId, 255);
        primaryColor.a = Math.round(255 * remaining);
        graphics.strokeColor = primaryColor;
        graphics.lineWidth = 2.5 + 4.5 * remaining;
        graphics.circle(effect.x, effect.y, radius);
        graphics.stroke();

        if (critical) {
            const starSize = effect.radius * (0.55 + 0.85 * remaining);
            const starColor = remaining > 0.5 ? ColorConst.WHITE.clone() : ColorConst.battleCritGold.clone();
            starColor.a = Math.round(240 * remaining);
            graphics.strokeColor = starColor;
            graphics.lineWidth = 2 + 3 * remaining;
            graphics.moveTo(effect.x - starSize, effect.y);
            graphics.lineTo(effect.x + starSize, effect.y);
            graphics.moveTo(effect.x, effect.y - starSize);
            graphics.lineTo(effect.x, effect.y + starSize);
            graphics.stroke();

            if (remaining > 0.65) {
                graphics.fillColor = ColorConst.getCombatColor(0, 150 * remaining);
                graphics.circle(effect.x, effect.y, radius * 0.55);
                graphics.fill();
            }
        }
    }

    private drawWallImpact(graphics: Graphics, effect: IEffectData) {
        const duration = effect.duration ?? wallImpactDuration;
        const remaining = effect.life / duration;
        const progress = 1 - remaining;
        const color = effect.roleId > 0 ? ColorConst.getPlayerColor(effect.roleId) : ColorConst.WHITE.clone();
        color.a = Math.round(235 * remaining);
        graphics.strokeColor = color;
        graphics.lineWidth = (effect.amount > 0 ? 5 : 3) * remaining;
        const radius = effect.radius * (0.35 + 0.95 * progress);
        const startAngle = effect.wallSide === ArenaWallSide.Left
            ? -Math.PI / 2
            : effect.wallSide === ArenaWallSide.Right
                ? Math.PI / 2
                : effect.wallSide === ArenaWallSide.Bottom
                    ? 0
                    : Math.PI;
        graphics.arc(effect.x, effect.y, radius, startAngle, startAngle + Math.PI, true);
        graphics.stroke();
    }

    private drawPickupRipple(graphics: Graphics, effect: IEffectData) {
        const remaining = effect.life / pickupRippleDuration;
        const progress = 1 - remaining;
        const color = effect.amount > 0 ? ColorConst.battleCritGold.clone() : ColorConst.shopGreen.clone();
        color.a = Math.round(220 * remaining);
        graphics.strokeColor = color;
        graphics.lineWidth = 2 + 2.5 * remaining;
        graphics.circle(effect.x, effect.y, effect.radius * (0.28 + 0.92 * progress));
        graphics.stroke();
    }

    private drawShieldBlock(graphics: Graphics, effect: IEffectData) {
        const remaining = effect.life / shieldBlockDuration;
        const progress = 1 - remaining;
        const color = ColorConst.battleShieldCyan.clone();
        color.a = Math.round(240 * remaining);
        graphics.strokeColor = color;
        graphics.lineWidth = 3 + 4 * remaining;
        graphics.circle(effect.x, effect.y, effect.radius * (0.65 + 0.55 * progress));
        graphics.stroke();
        const white = ColorConst.WHITE.clone();
        white.a = Math.round(180 * remaining);
        graphics.strokeColor = white;
        graphics.lineWidth = 2;
        graphics.circle(effect.x, effect.y, effect.radius * (0.45 + 0.35 * progress));
        graphics.stroke();
    }

    private drawSpawnRing(graphics: Graphics, effect: IEffectData) {
        const remaining = effect.life / spawnRingDuration;
        const radius = effect.radius * (0.3 + 1.1 * remaining);
        const color = effect.roleId > 0 ? ColorConst.getPlayerColor(effect.roleId) : ColorConst.WHITE.clone();
        color.a = Math.round(210 * remaining);
        graphics.strokeColor = color;
        graphics.lineWidth = 2 + 2.5 * remaining;
        graphics.circle(effect.x, effect.y, radius);
        graphics.stroke();

        const core = ColorConst.WHITE.clone();
        core.a = Math.round(180 * remaining);
        graphics.fillColor = core;
        graphics.circle(effect.x, effect.y, 4 * remaining);
        graphics.fill();
    }

    private drawBuffPulse(graphics: Graphics, effect: IEffectData) {
        const remaining = effect.life / buffPulseDuration;
        const progress = 1 - remaining;
        const color = effect.plasma
            ? ColorConst.battlePlasmaBlue.clone()
            : effect.roleId > 0 ? ColorConst.getPlayerColor(effect.roleId) : ColorConst.WHITE.clone();
        color.a = Math.round(230 * remaining);
        graphics.strokeColor = color;
        graphics.lineWidth = 2.5 + 3.5 * remaining;
        graphics.circle(effect.x, effect.y, effect.radius * (0.35 + 0.9 * progress));
        graphics.stroke();

        const inner = ColorConst.WHITE.clone();
        inner.a = Math.round(160 * remaining);
        graphics.strokeColor = inner;
        graphics.lineWidth = 1.5;
        graphics.circle(effect.x, effect.y, effect.radius * (0.2 + 0.55 * progress));
        graphics.stroke();
    }

    private drawCoinStrike(graphics: Graphics, effect: IEffectData) {
        const remaining = effect.life / coinStrikeDuration;
        const progress = 1 - remaining;
        const gold = ColorConst.battleCritGold.clone();
        gold.a = Math.round(210 * remaining);
        graphics.strokeColor = gold;
        graphics.lineWidth = 2 + 3 * remaining;
        graphics.moveTo(effect.x, effect.y);
        graphics.lineTo(effect.endX, effect.endY);
        graphics.stroke();

        const burstRadius = effect.radius * (0.35 + 0.9 * progress);
        graphics.strokeColor = gold;
        graphics.lineWidth = 2.5 + 2.5 * remaining;
        graphics.circle(effect.endX, effect.endY, burstRadius);
        graphics.stroke();

        const diamond = 10 * remaining;
        graphics.fillColor = remaining > 0.55 ? ColorConst.WHITE : ColorConst.battleCritGold;
        graphics.moveTo(effect.endX, effect.endY + diamond);
        graphics.lineTo(effect.endX + diamond * 0.75, effect.endY);
        graphics.lineTo(effect.endX, effect.endY - diamond);
        graphics.lineTo(effect.endX - diamond * 0.75, effect.endY);
        graphics.close();
        graphics.fill();
    }

    private drawWallFlashesAndVignette(graphics: Graphics, width: number, height: number, game: Game, elapsed: number) {
        const halfW = width / 2;
        const halfH = height / 2;
        const effectModel = game.effect.EffectModel;
        effectModel.wallFlashLife.forEach((life, side) => {
            const ratio = Math.min(1, life / wallImpactDuration);
            const flashColor = ColorConst.battleWallFlash.clone();
            flashColor.a = Math.round(215 * ratio);
            graphics.strokeColor = flashColor;
            graphics.lineWidth = 6 * ratio + 2;
            if (side === ArenaWallSide.Left) {
                graphics.moveTo(-halfW + 3, -halfH);
                graphics.lineTo(-halfW + 3, halfH);
            } else if (side === ArenaWallSide.Right) {
                graphics.moveTo(halfW - 3, -halfH);
                graphics.lineTo(halfW - 3, halfH);
            } else if (side === ArenaWallSide.Top) {
                graphics.moveTo(-halfW, halfH - 3);
                graphics.lineTo(halfW, halfH - 3);
            } else {
                graphics.moveTo(-halfW, -halfH + 3);
                graphics.lineTo(halfW, -halfH + 3);
            }
            graphics.stroke();
        });

        const alive = game.player.PlayerModel.players.filter((player) => {
            return player.hp > 0;
        });
        let lowHpDanger = 0;
        if (alive.length) {
            const ratioSum = alive.reduce((sum, player) => {
                return sum + (player.stats.hp > 0 ? player.hp / player.stats.hp : 0);
            }, 0);
            const averageRatio = ratioSum / alive.length;
            if (averageRatio < 0.32) {
                lowHpDanger = (0.32 - averageRatio) / 0.32 * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(elapsed * 8)));
            }
        }
        const hurtRatio = Math.min(1, effectModel.screenHurtFlash / screenHurtFlashDuration);
        const vignette = Math.max(hurtRatio, lowHpDanger * 0.55);
        if (vignette > 0.01) {
            const edgeColor = ColorConst.battleDangerRed.clone();
            edgeColor.a = Math.round(135 * vignette);
            graphics.strokeColor = edgeColor;
            graphics.lineWidth = 10 + 18 * vignette;
            graphics.rect(-halfW + 5, -halfH + 5, width - 10, height - 10);
            graphics.stroke();
        }
    }

    private drawParticles(graphics: Graphics, game: Game, previousLineCap: number) {
        const particleLineWidth = graphics.lineWidth;
        const particleStrokeColor = graphics.strokeColor.clone();
        graphics.lineCap = Graphics.LineCap.ROUND;
        for (const particle of game.effect.EffectModel.projectileHitParticles) {
            const sizeScale = particle.sizeScale ?? 1;
            const width = (projectileParticleEndSize + (particle.width - projectileParticleEndSize) * particle.sizeFactor) * sizeScale;
            const height = (projectileParticleEndSize + (particle.width / 2 - projectileParticleEndSize) * particle.sizeFactor) * sizeScale;
            const halfSegment = (width - height) / 2;
            const offsetX = particle.directionX * halfSegment;
            const offsetY = particle.directionY * halfSegment;
            const parent = particle.parentShot;
            if (parent && !parent.dead && parent.visual && parent.visual.flashTime > 0) {
                graphics.strokeColor = ColorConst.shopText;
            } else if (particle.enemyConfigId === undefined && particle.roleId === 0) {
                graphics.strokeColor = ColorConst.battlePlasmaBlue;
            } else {
                graphics.strokeColor = particle.enemyConfigId === undefined
                    ? ColorConst.getPlayerColor(particle.roleId)
                    : ColorConst.getEnemyColor(particle.enemyConfigId);
            }
            if (halfSegment > 0) {
                graphics.lineWidth = height;
                graphics.moveTo(particle.x - offsetX, particle.y - offsetY);
                graphics.lineTo(particle.x + offsetX, particle.y + offsetY);
                graphics.stroke();
            } else {
                const fillColor = graphics.fillColor.clone();
                graphics.fillColor = graphics.strokeColor;
                graphics.circle(particle.x, particle.y, height / 2);
                graphics.fill();
                graphics.fillColor = fillColor;
            }
        }
        graphics.lineCap = previousLineCap;
        graphics.lineWidth = particleLineWidth;
        graphics.strokeColor = particleStrokeColor;
    }

    private renderFloatingTexts(texts: IEffectData[], rule: TableCombatRule) {
        for (let index = this.labels.length; index < texts.length; index++) {
            const node = new Node("combatText");
            node.layer = this.node.layer;
            node.parent = this.node;
            node.addComponent(UITransform).setContentSize(rule.textWidth + 40, rule.textFontSize + 10);
            const label = node.addComponent(Label);
            label.fontSize = rule.textFontSize;
            label.lineHeight = rule.textFontSize + 4;
            label.isBold = true;
            label.enableOutline = true;
            label.outlineColor = ColorConst.battleDamageOutline;
            label.outlineWidth = 2;
            this.labels.push(label);
        }
        this.labels.forEach((label, index) => {
            label.node.active = index < texts.length;
            if (!label.node.active) {
                return;
            }
            const effect = texts[index];
            const duration = effect.duration ?? (effect.kind === EffectKind.TagText ? tagTextDuration : rule.textLife);
            const remaining = Math.max(0, Math.min(1, effect.life / duration));
            const progress = 1 - remaining;
            const alpha = remaining < 0.35 ? Math.round(255 * (remaining / 0.35)) : 255;

            let text = "";
            let color: Color;
            let scale = 1;
            if (effect.kind === EffectKind.TagText) {
                text = effect.tag ?? "";
                color = effect.roleId > 0
                    ? ColorConst.getPlayerColor(effect.roleId)
                    : text === "+1G" ? ColorConst.battleCritGold.clone() : ColorConst.WHITE.clone();
                const pop = progress < 0.2 ? 0.8 + 0.55 * (progress / 0.2) : 1.35 - 0.35 * Math.min(1, (progress - 0.2) / 0.35);
                scale = pop;
            } else if (effect.kind === EffectKind.Heal) {
                text = `+${Math.ceil(effect.amount)}`;
                color = ColorConst.shopGreen.clone();
                scale = progress < 0.18 ? 0.85 + 0.35 * (progress / 0.18) : 1.2 - 0.2 * Math.min(1, (progress - 0.18) / 0.3);
            } else if (effect.playerHurt) {
                text = `-${Math.ceil(effect.amount)}`;
                color = ColorConst.battleDangerRed.clone();
                scale = progress < 0.16 ? 1.4 : 1.15;
            } else if (effect.critical) {
                text = `${Math.ceil(effect.amount)}!`;
                color = progress < 0.12 ? ColorConst.WHITE.clone() : ColorConst.battleCritGold.clone();
                scale = progress < 0.14
                    ? 1.0 + 0.72 * (progress / 0.14)
                    : 1.72 - 0.52 * Math.min(1, (progress - 0.14) / 0.32);
            } else {
                text = `${Math.ceil(effect.amount)}`;
                color = ColorConst.getCombatColor(effect.roleId, 255);
                scale = progress < 0.14
                    ? 0.85 + 0.38 * (progress / 0.14)
                    : 1.23 - 0.26 * Math.min(1, (progress - 0.14) / 0.3);
            }
            color.a = alpha;
            label.string = text;
            label.color = color;
            label.node.setScale(scale, scale, 1);
            if (effect.vx !== undefined && effect.vy !== undefined) {
                label.node.setPosition(effect.x, effect.y, 0);
            } else {
                label.node.setPosition(effect.x, effect.y + rule.textRise * progress, 0);
            }
        });
    }

    private drawZone(graphics: Graphics, area: ICombatArea, roleId: number, elapsed: number) {
        if (area.life <= summonBlinkDuration && Math.floor(area.life / 0.05) % 2 === 0) {
            return;
        }
        const age = Math.max(0, elapsed - area.createdAt);
        const fade = Math.min(1, area.life / 0.22);
        const opening = 1 - (1 - Math.min(1, age / 0.15)) ** 3;
        const pulse = area.force ? (1 + Math.sin(age * 9)) / 2 : 1 - Math.min(1, area.timer / Math.max(0.01, area.interval));
        const radius = area.radius * (0.4 + 0.6 * opening);
        graphics.fillColor = ColorConst.getCombatColor(roleId, (18 + 25 * pulse) * fade);
        graphics.circle(area.x, area.y, radius);
        graphics.fill();
        graphics.strokeColor = ColorConst.getCombatColor(roleId, (130 + pulse * 95) * fade);
        let rotation = area.arcSpeed * age;
        if (area.force) {
            const slowdown = roleId === RoleKeyEnum.Psykino ? 2 : 1;
            const time = Math.min(age, slowdown);
            rotation = area.arcSpeed * time * (1 - time / (2 * slowdown));
        }
        this.drawFieldArcs(graphics, area.x, area.y, radius, rotation);
    }

    private drawSummon(graphics: Graphics, summon: ISummonData, roleId: number, elapsed: number) {
        if (summon.life <= summonBlinkDuration && Math.floor(summon.life / 0.05) % 2 === 0) {
            return;
        }
        const { x, y, typeId } = summon;
        const age = Math.max(0, elapsed - summon.createdAt);
        const attackAge = elapsed - (summon.attackAt ?? Number.NEGATIVE_INFINITY);
        const recoil = Math.max(0, 1 - attackAge / 0.16);
        const size = (0.6 + 0.4 * Math.min(1, age / 0.13)) * (1 + 0.25 * recoil * Math.cos(attackAge < 0.16 ? attackAge * 38 : 0));
        const fade = Math.min(1, summon.life / 0.16);
        let angle = summon.angle;
        if (typeId === SummonTypeKeyEnum.Sentry) {
            angle = recoil > 0 ? summon.attackAngle ?? angle : angle + age * 2.4;
        } else if (typeId === SummonTypeKeyEnum.Turret || typeId === SummonTypeKeyEnum.Illusion || recoil > 0) {
            angle = summon.attackAngle ?? angle;
        }
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);

        if (typeId === SummonTypeKeyEnum.Tree || typeId === SummonTypeKeyEnum.Volcano) {
            const auraRadius = typeId === SummonTypeKeyEnum.Tree ? 48 : 68;
            const auraColor = ColorConst.getCombatColor(roleId, 28 * fade);
            graphics.fillColor = auraColor;
            graphics.circle(x, y, auraRadius * size);
            graphics.fill();
            graphics.strokeColor = ColorConst.getCombatColor(roleId, (165 + 65 * recoil) * fade);
            this.drawFieldArcs(graphics, x, y, auraRadius, age * (typeId === SummonTypeKeyEnum.Tree ? 1.1 : -1.8), size);
        }

        graphics.fillColor = ColorConst.getCombatColor(recoil > 0.65 ? 0 : roleId, 255 * fade);
        if (typeId === SummonTypeKeyEnum.PsykerOrb || typeId === SummonTypeKeyEnum.Bomb) {
            if (typeId === SummonTypeKeyEnum.Bomb) {
                const danger = ColorConst.battleDangerRed.clone();
                danger.a = Math.round(70 + 80 * (0.5 + 0.5 * Math.sin(elapsed * 14)));
                graphics.strokeColor = danger;
                graphics.lineWidth = 2;
                graphics.circle(x, y, 22 * size);
                graphics.stroke();
            }
            graphics.circle(x, y, (typeId === SummonTypeKeyEnum.PsykerOrb ? 7 : 9) * size);
            graphics.fill();
            graphics.strokeColor = ColorConst.getCombatColor(roleId, 215 * fade);
            graphics.lineWidth = 2;
            graphics.arc(x, y, 13 * size, age * 5, age * 5 + Math.PI * 1.15, true);
            graphics.stroke();
            return;
        }

        const points = summonOutlines.get(typeId) ?? illusionOutline;
        points.forEach(([along, across], index) => {
            const pointX = x + (along * dx - across * dy) * size;
            const pointY = y + (along * dy + across * dx) * size;
            if (index === 0) {
                graphics.moveTo(pointX, pointY);
            } else {
                graphics.lineTo(pointX, pointY);
            }
        });
        graphics.close();
        graphics.fill();
    }

    private drawChain(graphics: Graphics, effect: IEffectData, elapsed: number) {
        const duration = effect.duration ?? chainDuration;
        const remaining = Math.max(0, effect.life / duration);
        const dx = effect.endX - effect.x;
        const dy = effect.endY - effect.y;
        const distance = Math.hypot(dx, dy);
        const plasma = !!effect.plasma;
        const mainColor = plasma ? ColorConst.battlePlasmaBlue.clone() : ColorConst.getCombatColor(effect.roleId, 255);
        const flicker = Math.floor(elapsed * 28) + (effect.seed ?? 0);

        if (distance > 0) {
            const segments = 8;
            const spread = Math.min(plasma ? 28 : 20, distance * 0.16) / distance;
            const vertices: number[][] = [[effect.x, effect.y]];
            for (let index = 1; index < segments; index++) {
                const t = index / segments;
                const envelope = Math.sin(t * Math.PI);
                const noise = Math.sin(index * 17.3 + flicker * 6.17) * 0.65 + Math.cos(index * 29.1 + flicker * 11.3) * 0.35;
                const offset = noise * spread * envelope;
                vertices.push([effect.x + dx * t - dy * offset, effect.y + dy * t + dx * offset]);
            }
            vertices.push([effect.endX, effect.endY]);

            const glowColor = mainColor.clone();
            glowColor.a = Math.round((plasma ? 105 : 75) * remaining);
            graphics.strokeColor = glowColor;
            graphics.lineWidth = (plasma ? 12 : 8.5) * remaining + 1.5;
            this.strokePolyline(graphics, vertices);

            const midColor = mainColor.clone();
            midColor.a = Math.round(250 * remaining);
            graphics.strokeColor = midColor;
            graphics.lineWidth = (plasma ? 5 : 4) * remaining + 1;
            this.strokePolyline(graphics, vertices);

            const coreColor = ColorConst.WHITE.clone();
            coreColor.a = Math.round(245 * remaining);
            graphics.strokeColor = coreColor;
            graphics.lineWidth = (plasma ? 2.2 : 1.6) * remaining + 0.6;
            this.strokePolyline(graphics, vertices);

            if (plasma && distance > 42) {
                for (const branchIndex of [3, 5]) {
                    const [bx, by] = vertices[branchIndex];
                    const sign = branchIndex === 3 ? 1 : -1;
                    const branchAngle = Math.atan2(dy, dx) + sign * (0.62 + 0.28 * Math.sin(flicker + branchIndex));
                    const branchLen = Math.min(34, distance * 0.22) * (0.65 + 0.35 * remaining);
                    const midX = bx + Math.cos(branchAngle + sign * 0.2) * (branchLen * 0.52);
                    const midY = by + Math.sin(branchAngle + sign * 0.2) * (branchLen * 0.52);
                    const tipX = bx + Math.cos(branchAngle) * branchLen;
                    const tipY = by + Math.sin(branchAngle) * branchLen;
                    graphics.strokeColor = midColor;
                    graphics.lineWidth = 2.4 * remaining + 0.6;
                    this.strokePolyline(graphics, [[bx, by], [midX, midY], [tipX, tipY]]);
                    graphics.strokeColor = coreColor;
                    graphics.lineWidth = 1.1 * remaining + 0.3;
                    this.strokePolyline(graphics, [[bx, by], [midX, midY], [tipX, tipY]]);
                }
            }
        }

        const ringColor = mainColor.clone();
        ringColor.a = Math.round(220 * remaining);
        graphics.strokeColor = ringColor;
        graphics.lineWidth = 2 * remaining + 1;
        graphics.circle(effect.x, effect.y, (plasma ? 10 : 7) * (1.2 - 0.5 * remaining));
        graphics.stroke();
        graphics.circle(effect.endX, effect.endY, (plasma ? 12 : 8) * (1.25 - 0.5 * remaining));
        graphics.stroke();

        graphics.fillColor = ColorConst.getCombatColor(0, 245 * remaining);
        graphics.circle(effect.x, effect.y, 3.5 + 4 * remaining);
        graphics.fill();
        graphics.circle(effect.endX, effect.endY, 4 + 4.5 * remaining);
        graphics.fill();
    }

    private strokePolyline(graphics: Graphics, points: number[][]) {
        points.forEach(([px, py], index) => {
            if (index === 0) {
                graphics.moveTo(px, py);
            } else {
                graphics.lineTo(px, py);
            }
        });
        graphics.stroke();
    }

    private drawWallResidue(graphics: Graphics, effect: IEffectData) {
        const knife = effect.kind === EffectKind.WallKnife;
        const duration = knife ? knifeResidueDuration : arrowResidueDuration;
        const age = duration - effect.life;
        const blinkTime = wallResidueBlinkDuration - effect.life;
        if (blinkTime > 0 && Math.floor(blinkTime / 0.05) % 2 === 0) {
            return;
        }
        const angle = effect.amount;
        const normal = effect.endX;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        graphics.strokeColor = ColorConst.getCombatColor(age < 0.09 ? 0 : effect.roleId, 255);
        if (knife) {
            const normalX = Math.cos(normal);
            const normalY = Math.sin(normal);
            const dot = dx * normalX + dy * normalY;
            const settleTime = duration - wallResidueBlinkDuration;
            const time = Math.min(age, settleTime);
            const distance = effect.endY * time * (1 - time / (2 * settleTime));
            const x = effect.x + (dx - 2 * dot * normalX) * distance;
            const y = effect.y + (dy - 2 * dot * normalY) * distance;
            const spin = angle + age * Math.PI * 12;
            const offsetX = Math.cos(spin) * 9;
            const offsetY = Math.sin(spin) * 9;
            graphics.lineWidth = 8;
            graphics.moveTo(x - offsetX, y - offsetY);
            graphics.lineTo(x + offsetX, y + offsetY);
        } else {
            graphics.lineWidth = 4;
            graphics.moveTo(effect.x, effect.y);
            graphics.lineTo(effect.x - dx * 22, effect.y - dy * 22);
        }
        graphics.stroke();
    }

    private drawEnemyBurst(graphics: Graphics, effect: IEffectData) {
        const boss = effect.kind === EffectKind.BossDeath;
        const remaining = effect.life / (boss ? bossDeathDuration : spawnArrivalDuration);
        const radius = effect.radius * (0.65 + (1 - remaining) * (boss ? 8.5 : 1.45));
        const color = ColorConst.getEnemyColor(effect.amount);
        color.a = Math.round(240 * remaining);
        graphics.strokeColor = color;
        graphics.lineWidth = (boss ? 9 : 3.5) * (0.35 + 0.65 * remaining);
        graphics.circle(effect.x, effect.y, radius);
        graphics.stroke();
        if (boss) {
            graphics.strokeColor = ColorConst.getCombatColor(0, 220 * remaining ** 2);
            graphics.lineWidth = 2.5 + 5 * remaining;
            graphics.circle(effect.x, effect.y, radius * 0.62);
            graphics.stroke();
            const gold = ColorConst.battleCritGold.clone();
            gold.a = Math.round(180 * remaining);
            graphics.strokeColor = gold;
            graphics.lineWidth = 2 + 3 * remaining;
            graphics.circle(effect.x, effect.y, radius * 0.34);
            graphics.stroke();
        }
    }

    private drawArea(graphics: Graphics, effect: IEffectData, duration: number, lineWidth: number, maxRadius: number) {
        const age = Math.max(0, duration - effect.life);
        if (effect.life < 0.09 && Math.floor(effect.life / 0.03) % 2 === 0) {
            return;
        }
        const opening = 1 - (1 - Math.min(1, age / 0.06)) ** 3;
        const remaining = effect.life / duration;
        const square = effect.squareAngle !== undefined;
        const { x, y, roleId } = effect;
        const flashWhite = age < 0.055;

        if (!square) {
            const radius = maxRadius * (0.25 + 0.75 * opening);
            graphics.fillColor = ColorConst.getCombatColor(roleId, 48 * remaining ** 2);
            graphics.circle(x, y, radius);
            graphics.fill();
            graphics.strokeColor = ColorConst.getCombatColor(flashWhite ? 0 : roleId, 240 * remaining);
            graphics.lineWidth = lineWidth * (1.2 + 1.6 * remaining);
            graphics.circle(x, y, radius);
            graphics.stroke();
            return;
        }

        const half = maxRadius * 0.78 * (0.35 + 0.65 * opening);
        const angle = effect.squareAngle ?? 0;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const toWorld = (lx: number, ly: number) => {
            return [x + lx * cos - ly * sin, y + lx * sin + ly * cos];
        };

        const fillCorners = [
            toWorld(-half, -half),
            toWorld(half, -half),
            toWorld(half, half),
            toWorld(-half, half),
        ];
        graphics.fillColor = ColorConst.getCombatColor(flashWhite ? 0 : roleId, (flashWhite ? 72 : 44) * remaining);
        fillCorners.forEach(([px, py], index) => {
            if (index === 0) {
                graphics.moveTo(px, py);
            } else {
                graphics.lineTo(px, py);
            }
        });
        graphics.close();
        graphics.fill();

        const arm = Math.max(10, half * 0.28);
        graphics.strokeColor = ColorConst.getCombatColor(flashWhite ? 0 : roleId, 250 * remaining);
        graphics.lineWidth = lineWidth * (1.3 + 1.5 * remaining);
        const brackets = [
            [[-half, -half + arm], [-half, -half], [-half + arm, -half]],
            [[half - arm, -half], [half, -half], [half, -half + arm]],
            [[half - arm, half], [half, half], [half, half - arm]],
            [[-half, half - arm], [-half, half], [-half + arm, half]],
        ];
        for (const bracket of brackets) {
            const worldPts = bracket.map(([lx, ly]) => {
                return toWorld(lx, ly);
            });
            this.strokePolyline(graphics, worldPts);
        }
    }

    private drawMuzzle(graphics: Graphics, effect: IEffectData) {
        const remaining = effect.life / muzzleDuration;
        const { x, y, roleId } = effect;
        const dx = Math.cos(effect.amount);
        const dy = Math.sin(effect.amount);
        const width = 8 * remaining;
        const length = 26 * remaining;
        graphics.fillColor = ColorConst.getCombatColor(roleId, 255 * remaining);
        graphics.moveTo(x + dx * length, y + dy * length);
        graphics.lineTo(x - dy * width, y + dx * width);
        graphics.lineTo(x - dx * width, y - dy * width);
        graphics.lineTo(x + dy * width, y - dx * width);
        graphics.close();
        graphics.fill();
        graphics.fillColor = ColorConst.getCombatColor(0, 255 * remaining);
        graphics.circle(x, y, width * 0.55);
        graphics.fill();
    }

    private drawProjectile(graphics: Graphics, shot: IProjectileData, roleId: number, elapsed: number) {
        const color = ColorConst.getPlayerColor(roleId);
        if (shot.bladeContacts) {
            const dx = Math.cos(shot.angle);
            const dy = Math.sin(shot.angle);
            const alongX = dx * spellbladeLength / 2;
            const alongY = dy * spellbladeLength / 2;
            const acrossX = -dy * spellbladeThickness / 2;
            const acrossY = dx * spellbladeThickness / 2;
            const glow = color.clone();
            glow.a = 90;
            graphics.strokeColor = glow;
            graphics.lineWidth = 4;
            graphics.circle(shot.x, shot.y, spellbladeLength * 0.52);
            graphics.stroke();
            graphics.fillColor = color;
            graphics.moveTo(shot.x + alongX + acrossX, shot.y + alongY + acrossY);
            graphics.lineTo(shot.x + alongX - acrossX, shot.y + alongY - acrossY);
            graphics.lineTo(shot.x - alongX - acrossX, shot.y - alongY - acrossY);
            graphics.lineTo(shot.x - alongX + acrossX, shot.y - alongY + acrossY);
            graphics.close();
            graphics.fill();
            graphics.strokeColor = ColorConst.WHITE;
            graphics.lineWidth = 2.5;
            graphics.moveTo(shot.x - alongX * 0.7, shot.y - alongY * 0.7);
            graphics.lineTo(shot.x + alongX * 0.7, shot.y + alongY * 0.7);
            graphics.stroke();
            return;
        }
        const visual = shot.visual;
        if (!visual) {
            const dx = Math.cos(shot.angle);
            const dy = Math.sin(shot.angle);
            const tailLength = Math.min(34, Math.max(14, shot.speed * 0.032));
            const tailColor = color.clone();
            tailColor.a = 105;
            graphics.strokeColor = tailColor;
            graphics.lineWidth = 7;
            graphics.moveTo(shot.x - dx * tailLength, shot.y - dy * tailLength);
            graphics.lineTo(shot.x, shot.y);
            graphics.stroke();

            const offsetX = 10 * dx;
            const offsetY = 10 * dy;
            graphics.strokeColor = color;
            graphics.lineWidth = 11;
            graphics.moveTo(shot.x - offsetX, shot.y - offsetY);
            graphics.lineTo(shot.x + offsetX, shot.y + offsetY);
            graphics.stroke();

            graphics.strokeColor = ColorConst.WHITE;
            graphics.lineWidth = 4;
            graphics.moveTo(shot.x - offsetX * 0.45, shot.y - offsetY * 0.45);
            graphics.lineTo(shot.x + offsetX * 0.75, shot.y + offsetY * 0.75);
            graphics.stroke();
            return;
        }
        if (roleId === RoleKeyEnum.Sage) {
            this.drawSageProjectile(graphics, shot, roleId);
            return;
        }
        const radius = (roleId === RoleKeyEnum.Lich ? 9 + 3 * Math.sin(visual.age * 97) : 13) * visual.scale;
        if (roleId === RoleKeyEnum.Arcanist) {
            const corona = ColorConst.battlePlasmaGlow.clone();
            graphics.fillColor = corona;
            graphics.circle(shot.x, shot.y, radius * 1.9);
            graphics.fill();
            this.drawPlasmaAura(graphics, shot.x, shot.y, radius * 1.45, elapsed * 1.6 + visual.age);
        } else {
            const glow = color.clone();
            glow.a = 75;
            graphics.fillColor = glow;
            graphics.circle(shot.x, shot.y, radius * 1.45);
            graphics.fill();
        }
        graphics.fillColor = visual.flashTime > 0 ? ColorConst.WHITE : color;
        graphics.circle(shot.x, shot.y, radius);
        graphics.fill();
        graphics.fillColor = ColorConst.WHITE;
        graphics.circle(shot.x, shot.y, radius * 0.48);
        graphics.fill();
    }

    private drawSageProjectile(graphics: Graphics, shot: IProjectileData, roleId: number) {
        const visual = shot.visual;
        if (!visual || (shot.life <= 0.35 && Math.ceil(shot.life / 0.05) % 2 === 1)) {
            return;
        }
        const radius = TablePlayerSkill.getConfigById<TablePlayerSkill>(shot.skillId).pull;
        const progress = Math.min(1, visual.age / 0.05);
        const expansion = progress < 0.5 ? 4 * progress ** 3 : 1 - 4 * (1 - progress) ** 3;
        graphics.fillColor = ColorConst.getCombatColor(roleId, 24);
        graphics.circle(shot.x, shot.y, radius * visual.scale);
        graphics.fill();
        graphics.fillColor = ColorConst.getPlayerColor(roleId);
        const coreRadius = (12 * expansion + 3 * Math.sin(visual.age * 97)) * visual.scale;
        if (coreRadius > 0) {
            graphics.circle(shot.x, shot.y, coreRadius);
            graphics.fill();
        }
        graphics.strokeColor = ColorConst.getPlayerColor(roleId);
        this.drawFieldArcs(graphics, shot.x, shot.y, radius, shot.angle + visual.spin * visual.age, visual.scale);
    }

    private drawFieldArcs(graphics: Graphics, x: number, y: number, radius: number, rotation: number, scale: number = 1) {
        const originalRadius = radius / arcCoordinateScale;
        graphics.lineWidth = (2 + 2 * (originalRadius - arcReferenceRadius) / arcRadiusSpan) * arcCoordinateScale * scale;
        for (let index = 0; index < 4; index++) {
            const angle = rotation + (index + 0.5) * Math.PI / 2;
            graphics.arc(x, y, radius * scale, angle - Math.PI / 8, angle + Math.PI / 8, true);
            graphics.stroke();
        }
    }
}

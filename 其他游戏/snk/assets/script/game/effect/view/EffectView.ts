import { _decorator, Component, Graphics, Label, Node, UITransform } from "cc";
import type { Game } from "../../game/Game";
import { ColorConst } from "../../common/config/ColorConst";
import { TableCombatRule } from "../../common/table/TableCombatRule";
import { TableBattleRule } from "../../common/table/TableBattleRule";
import { EffectKind, bossDeathDuration, chainDuration, enemyDeathDuration, muzzleDuration, projectileEndDuration, projectileParticleEndSize, spawnArrivalDuration } from "../EffectEvent";
import type { IEffectData } from "../EffectEvent";
import { arrowResidueDuration, criticalDuration, knifeResidueDuration, playerDeathDuration, wallResidueBlinkDuration } from "../EffectEvent";
import { CombatCamp } from "../../combat/CombatEvent";
import { BuffKind } from "../../buff/BuffEvent";
import { RoleKeyEnum } from "../../common/table/RoleKeyEnum";
import { SummonTypeKeyEnum } from "../../common/table/SummonTypeKeyEnum";
import { TablePlayerSkill } from "../../common/table/TablePlayerSkill";
import type { IProjectileData } from "../../projectile/ProjectileEvent";
import { spellbladeLength, spellbladeThickness } from "../../projectile/ProjectileEvent";
import type { ICombatArea, ISummonData } from "../../summon/SummonEvent";
import { EnemyObjectKind } from "../../enemy/EnemyEvent";

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

    render(game: Game) {
        const graphics = this.getComponent(Graphics);
        const rule = TableCombatRule.getCurrent();
        const elapsed = game.combat.CombatModel.elapsed;
        const players = game.player.PlayerModel.players;
        graphics.clear();
        const previousLineCap = graphics.lineCap;
        const previousLineWidth = graphics.lineWidth;
        const previousStrokeColor = graphics.strokeColor.clone();
        game.summon.SummonModel.areas.forEach((area) => {
            this.drawZone(graphics, area, players[area.source].roleId, elapsed);
        });
        const warningDuration = TableBattleRule.getCurrent().spawnWarning;
        for (const marker of game.enemy.EnemyModel.objects) {
            if (marker.kind === EnemyObjectKind.SpawnMarker && marker.delay <= 0 && marker.life > 0 && !marker.dead) {
                const progress = 1 - Math.min(1, marker.life / warningDuration);
                const color = ColorConst.getEnemyColor(marker.configId);
                color.a = 110 + 135 * progress;
                const radius = 36 - 17 * progress;
                graphics.lineWidth = 2 + 2 * progress;
                graphics.strokeColor = color;
                for (const quarter of [0, 1, 2, 3]) {
                    const angle = quarter * Math.PI / 2 - progress * Math.PI / 2;
                    graphics.arc(marker.x, marker.y, radius, angle, angle + Math.PI / 3, true);
                    graphics.stroke();
                }
                graphics.fillColor = ColorConst.getCombatColor(0, 130 * progress ** 2);
                graphics.circle(marker.x, marker.y, 3 + 5 * progress);
                graphics.fill();
            }
        }
        graphics.lineCap = Graphics.LineCap.ROUND;
        game.projectile.ProjectileModel.projectiles.forEach((shot) => {
            if (shot.delay > 0 || shot.dead) {
                return;
            }
            this.drawProjectile(graphics, shot, game.player.PlayerModel.players[shot.source].roleId);
        });
        graphics.lineCap = previousLineCap;
        graphics.lineWidth = previousLineWidth;
        graphics.strokeColor = previousStrokeColor;
        game.projectile.ProjectileModel.enemyProjectiles.forEach((shot) => {
            if (shot.delay > 0 || shot.dead) {
                return;
            }
            graphics.fillColor = ColorConst.getEnemyColor(shot.configId);
            graphics.circle(shot.x, shot.y, shot.height / 2);
            graphics.fill();
        });
        game.summon.SummonModel.summons.forEach((summon) => {
            this.drawSummon(graphics, summon, players[summon.source].roleId, elapsed);
        });
        game.summon.SummonModel.orbs.forEach((orb) => {
            graphics.fillColor = ColorConst.shopGreen;
            graphics.circle(orb.x, orb.y, rule.orbRadius);
            graphics.fill();
        });
        graphics.lineWidth = rule.effectLineWidth;
        game.buff.BuffModel.buffs.forEach((buff) => {
            if (buff.camp === CombatCamp.Player && buff.kind === BuffKind.Shield && buff.remaining > 0) {
                const player = game.player.PlayerModel.players[buff.target];
                graphics.strokeColor = ColorConst.getPlayerColor(player.roleId);
                graphics.circle(player.pose.x, player.pose.y, rule.shieldRadius);
                graphics.stroke();
            }
        });
        const arena = this.getComponent(UITransform);
        const texts = game.effect.EffectModel.effects.filter((effect) => {
            if (effect.kind === EffectKind.Area) {
                const farthestCorner = Math.hypot(arena.width / 2 + Math.abs(effect.x), arena.height / 2 + Math.abs(effect.y));
                const radius = effect.squareAngle === undefined ? Math.min(effect.radius, farthestCorner) : effect.radius;
                this.drawArea(graphics, effect, rule.effectLife, rule.effectLineWidth, radius);
            } else if (effect.kind === EffectKind.Chain) {
                this.drawChain(graphics, effect);
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
                const remaining = effect.life / enemyDeathDuration;
                const color = ColorConst.getEnemyColor(effect.amount);
                color.a = 230 * remaining;
                graphics.strokeColor = color;
                graphics.lineWidth = rule.effectLineWidth * (1 + remaining);
                graphics.circle(effect.x, effect.y, effect.radius * (0.35 + remaining * 0.9));
                graphics.stroke();
            } else if (effect.kind === EffectKind.SpawnArrival || effect.kind === EffectKind.BossDeath) {
                this.drawEnemyBurst(graphics, effect);
            } else if (effect.kind === EffectKind.Critical || effect.kind === EffectKind.PlayerDeath) {
                const critical = effect.kind === EffectKind.Critical;
                const remaining = effect.life / (critical ? criticalDuration : playerDeathDuration);
                const radius = effect.radius * (0.12 + 0.88 * remaining);
                graphics.strokeColor = ColorConst.getCombatColor(remaining > 0.72 ? 0 : effect.roleId, 255 * remaining);
                graphics.lineWidth = 2 + 4 * remaining;
                graphics.circle(effect.x, effect.y, radius);
                graphics.stroke();
                if (critical && remaining > 0.7) {
                    graphics.fillColor = ColorConst.getCombatColor(0, 110 * remaining);
                    graphics.circle(effect.x, effect.y, radius * 0.45);
                    graphics.fill();
                }
            } else if (effect.kind === EffectKind.WallArrow || effect.kind === EffectKind.WallKnife) {
                this.drawWallResidue(graphics, effect);
            }
            return effect.kind === EffectKind.Damage || effect.kind === EffectKind.Heal;
        });
        const particleLineWidth = graphics.lineWidth;
        const particleStrokeColor = graphics.strokeColor.clone();
        graphics.lineCap = Graphics.LineCap.ROUND;
        for (const particle of game.effect.EffectModel.projectileHitParticles) {
            const width = projectileParticleEndSize + (particle.width - projectileParticleEndSize) * particle.sizeFactor;
            const height = projectileParticleEndSize + (particle.width / 2 - projectileParticleEndSize) * particle.sizeFactor;
            const halfSegment = (width - height) / 2;
            const offsetX = particle.directionX * halfSegment;
            const offsetY = particle.directionY * halfSegment;
            const parent = particle.parentShot;
            if (parent && !parent.dead && parent.visual && parent.visual.flashTime > 0) {
                graphics.strokeColor = ColorConst.shopText;
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
        for (let index = this.labels.length; index < texts.length; index++) {
            const node = new Node("combatText");
            node.layer = this.node.layer;
            node.parent = this.node;
            node.addComponent(UITransform).setContentSize(rule.textWidth, rule.textFontSize + 2);
            const label = node.addComponent(Label);
            label.fontSize = rule.textFontSize;
            label.lineHeight = rule.textFontSize + 2;
            this.labels.push(label);
        }
        this.labels.forEach((label, index) => {
            label.node.active = index < texts.length;
            if (label.node.active) {
                const effect = texts[index];
                label.string = `${effect.kind === EffectKind.Heal ? "+" : ""}${Math.ceil(effect.amount)}`;
                label.color = effect.kind === EffectKind.Heal ? ColorConst.shopGreen : ColorConst.getCombatColor(effect.roleId, 255 * effect.life / rule.textLife);
                label.node.setPosition(effect.x, effect.y + rule.textRise * (1 - effect.life / rule.textLife), 0);
            }
        });
    }

    private drawZone(graphics: Graphics, area: ICombatArea, roleId: number, elapsed: number) {
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
        graphics.fillColor = ColorConst.getCombatColor(recoil > 0.65 ? 0 : roleId, 255 * fade);
        if (typeId === SummonTypeKeyEnum.PsykerOrb || typeId === SummonTypeKeyEnum.Bomb) {
            graphics.circle(x, y, (typeId === SummonTypeKeyEnum.PsykerOrb ? 7 : 9) * size);
            graphics.fill();
            graphics.strokeColor = ColorConst.getCombatColor(roleId, 215 * fade);
            graphics.lineWidth = 2;
            graphics.arc(x, y, 12 * size, age * 5, age * 5 + Math.PI * 1.15, true);
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

    private drawChain(graphics: Graphics, effect: IEffectData) {
        const remaining = effect.life / chainDuration;
        const dx = effect.endX - effect.x;
        const dy = effect.endY - effect.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 0) {
            const spread = Math.min(20, distance * 0.12) / distance;
            graphics.strokeColor = ColorConst.getCombatColor(effect.roleId, 248 * remaining);
            graphics.lineWidth = 1.5 + 4.5 * remaining;
            graphics.moveTo(effect.x, effect.y);
            for (let index = 1; index < 7; index++) {
                const t = index / 7;
                const offset = Math.sin(index * 13.76 + effect.x * 0.29 + effect.endY * 0.17) * spread;
                graphics.lineTo(effect.x + dx * t - dy * offset, effect.y + dy * t + dx * offset);
            }
            graphics.lineTo(effect.endX, effect.endY);
            graphics.stroke();
        }
        graphics.fillColor = ColorConst.getCombatColor(0, 220 * remaining);
        graphics.circle(effect.x, effect.y, 3 + 4 * remaining);
        graphics.fill();
        graphics.circle(effect.endX, effect.endY, 3 + 4 * remaining);
        graphics.fill();
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
        const radius = effect.radius * (0.65 + (1 - remaining) * (boss ? 8 : 1.35));
        const color = ColorConst.getEnemyColor(effect.amount);
        color.a = 240 * remaining;
        graphics.strokeColor = color;
        graphics.lineWidth = (boss ? 8 : 3.5) * (0.35 + 0.65 * remaining);
        graphics.circle(effect.x, effect.y, radius);
        graphics.stroke();
        if (boss) {
            graphics.strokeColor = ColorConst.getCombatColor(0, 200 * remaining ** 2);
            graphics.lineWidth = 2 + 4 * remaining;
            graphics.circle(effect.x, effect.y, radius * 0.62);
            graphics.stroke();
        }
    }

    private drawArea(graphics: Graphics, effect: IEffectData, duration: number, lineWidth: number, maxRadius: number) {
        const age = Math.max(0, duration - effect.life);
        const opening = 1 - (1 - Math.min(1, age / 0.08)) ** 3;
        const remaining = effect.life / duration;
        const square = effect.squareAngle !== undefined;
        const radius = maxRadius * (square ? opening * Math.SQRT2 / 1.5 : 0.25 + 0.75 * opening);
        const { x, y, roleId } = effect;
        graphics.fillColor = ColorConst.getCombatColor(roleId, 42 * remaining ** 2);
        if (!square) {
            graphics.circle(x, y, radius);
            graphics.fill();
            graphics.strokeColor = ColorConst.getCombatColor(roleId, 110 * remaining);
            graphics.lineWidth = lineWidth;
            graphics.circle(x, y, radius);
            graphics.stroke();
        }

        graphics.strokeColor = ColorConst.getCombatColor(age < 0.045 ? 0 : roleId, 245 * remaining);
        graphics.lineWidth = lineWidth * (1 + 1.5 * remaining);
        const angle = Math.PI / 4 + (effect.squareAngle ?? 0.22 * opening);
        const dx = Math.cos(angle) * radius;
        const dy = Math.sin(angle) * radius;
        graphics.moveTo(x + dx, y + dy);
        graphics.lineTo(x - dy, y + dx);
        graphics.lineTo(x - dx, y - dy);
        graphics.lineTo(x + dy, y - dx);
        graphics.close();
        if (square) {
            graphics.fill();
        }
        graphics.stroke();
    }

    private drawMuzzle(graphics: Graphics, effect: IEffectData) {
        const remaining = effect.life / muzzleDuration;
        const { x, y, roleId } = effect;
        const dx = Math.cos(effect.amount);
        const dy = Math.sin(effect.amount);
        const width = 7 * remaining;
        const length = 23 * remaining;
        graphics.fillColor = ColorConst.getCombatColor(roleId, 255 * remaining);
        graphics.moveTo(x + dx * length, y + dy * length);
        graphics.lineTo(x - dy * width, y + dx * width);
        graphics.lineTo(x - dx * width, y - dy * width);
        graphics.lineTo(x + dy * width, y - dx * width);
        graphics.close();
        graphics.fill();
        graphics.fillColor = ColorConst.getCombatColor(0, 255 * remaining);
        graphics.circle(x, y, width / 2);
        graphics.fill();
    }

    private drawProjectile(graphics: Graphics, shot: IProjectileData, roleId: number) {
        const color = ColorConst.getPlayerColor(roleId);
        if (shot.bladeContacts) {
            const dx = Math.cos(shot.angle);
            const dy = Math.sin(shot.angle);
            const alongX = dx * spellbladeLength / 2;
            const alongY = dy * spellbladeLength / 2;
            const acrossX = -dy * spellbladeThickness / 2;
            const acrossY = dx * spellbladeThickness / 2;
            graphics.fillColor = color;
            graphics.moveTo(shot.x + alongX + acrossX, shot.y + alongY + acrossY);
            graphics.lineTo(shot.x + alongX - acrossX, shot.y + alongY - acrossY);
            graphics.lineTo(shot.x - alongX - acrossX, shot.y - alongY - acrossY);
            graphics.lineTo(shot.x - alongX + acrossX, shot.y - alongY + acrossY);
            graphics.close();
            graphics.fill();
            return;
        }
        const visual = shot.visual;
        if (!visual) {
            const offsetX = 9 * Math.cos(shot.angle);
            const offsetY = 9 * Math.sin(shot.angle);
            graphics.strokeColor = color;
            graphics.lineWidth = 12;
            graphics.moveTo(shot.x - offsetX, shot.y - offsetY);
            graphics.lineTo(shot.x + offsetX, shot.y + offsetY);
            graphics.stroke();
            return;
        }
        if (roleId === RoleKeyEnum.Sage) {
            this.drawSageProjectile(graphics, shot, roleId);
            return;
        }
        graphics.fillColor = visual.flashTime > 0 ? ColorConst.shopText : color;
        const radius = roleId === RoleKeyEnum.Lich ? 9 + 3 * Math.sin(visual.age * 97) : 12;
        graphics.circle(shot.x, shot.y, radius * visual.scale);
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
        graphics.fillColor = ColorConst.getCombatColor(roleId, 20);
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

import { _decorator, Component, Graphics, Label, Node, UITransform } from "cc";
import type { Game } from "../../game/Game";
import { ColorConst } from "../../common/config/ColorConst";
import { TableCombatRule } from "../../common/table/TableCombatRule";
import { EffectKind, projectileEndDuration } from "../EffectEvent";
import { CombatCamp } from "../../combat/CombatEvent";
import { BuffKind } from "../../buff/BuffEvent";
import { RoleKeyEnum } from "../../common/table/RoleKeyEnum";
import { SummonTypeKeyEnum } from "../../common/table/SummonTypeKeyEnum";
import { TablePlayerSkill } from "../../common/table/TablePlayerSkill";
import type { IProjectileData } from "../../projectile/ProjectileEvent";

const { ccclass } = _decorator;

@ccclass("CombatEffectView")
export class EffectView extends Component {
    private labels: Label[] = [];

    render(game: Game) {
        const graphics = this.getComponent(Graphics);
        const rule = TableCombatRule.getCurrent();
        graphics.clear();
        const previousLineCap = graphics.lineCap;
        const previousLineWidth = graphics.lineWidth;
        const previousStrokeColor = graphics.strokeColor.clone();
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
            graphics.fillColor = ColorConst.getPlayerColor(game.player.PlayerModel.players[summon.source].roleId);
            if (summon.typeId === SummonTypeKeyEnum.PsykerOrb) {
                graphics.circle(summon.x, summon.y, 7.5);
            } else {
                graphics.rect(summon.x - rule.orbRadius, summon.y - rule.orbRadius, rule.orbRadius * 2, rule.orbRadius * 2);
            }
            graphics.fill();
        });
        game.summon.SummonModel.orbs.forEach((orb) => {
            graphics.fillColor = ColorConst.shopGreen;
            graphics.circle(orb.x, orb.y, rule.orbRadius);
            graphics.fill();
        });
        game.summon.SummonModel.areas.forEach((area) => {
            graphics.strokeColor = ColorConst.getCombatColor(game.player.PlayerModel.players[area.source].roleId, rule.areaOpacity);
            graphics.lineWidth = rule.effectLineWidth;
            graphics.circle(area.x, area.y, area.radius);
            graphics.stroke();
        });
        game.buff.BuffModel.buffs.forEach((buff) => {
            if (buff.camp === CombatCamp.Player && buff.kind === BuffKind.Shield && buff.remaining > 0) {
                const player = game.player.PlayerModel.players[buff.target];
                graphics.strokeColor = ColorConst.getPlayerColor(player.roleId);
                graphics.circle(player.pose.x, player.pose.y, rule.shieldRadius);
                graphics.stroke();
            }
        });
        const texts = game.effect.EffectModel.effects.filter((effect) => {
            if (effect.kind === EffectKind.Area) {
                graphics.strokeColor = ColorConst.getCombatColor(effect.roleId, rule.areaOpacity * effect.life / rule.effectLife);
                graphics.lineWidth = rule.effectLineWidth;
                graphics.circle(effect.x, effect.y, effect.radius);
                graphics.stroke();
            } else if (effect.kind === EffectKind.Chain) {
                graphics.strokeColor = ColorConst.getCombatColor(effect.roleId, 255 * effect.life / rule.effectLife);
                graphics.moveTo(effect.x, effect.y);
                graphics.lineTo(effect.endX, effect.endY);
                graphics.stroke();
            } else if (effect.kind === EffectKind.ProjectileHit || effect.kind === EffectKind.ProjectileEnd) {
                let radius = effect.radius;
                if (effect.kind === EffectKind.ProjectileEnd) {
                    const remaining = effect.life / projectileEndDuration;
                    radius *= remaining < 0.5 ? 4 * remaining ** 3 : 1 - 4 * (1 - remaining) ** 3;
                }
                graphics.fillColor = ColorConst.shopText;
                graphics.circle(effect.x, effect.y, radius);
                graphics.fill();
            }
            return effect.kind === EffectKind.Damage || effect.kind === EffectKind.Heal;
        });
        const particleLineWidth = graphics.lineWidth;
        const particleStrokeColor = graphics.strokeColor.clone();
        graphics.lineCap = Graphics.LineCap.ROUND;
        for (const particle of game.effect.EffectModel.projectileHitParticles) {
            const height = 2 + (particle.width / 2 - 2) * particle.sizeFactor;
            const halfSegment = particle.width * particle.sizeFactor / 4;
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
            graphics.lineWidth = height;
            graphics.moveTo(particle.x - offsetX, particle.y - offsetY);
            graphics.lineTo(particle.x + offsetX, particle.y + offsetY);
            graphics.stroke();
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

    private drawProjectile(graphics: Graphics, shot: IProjectileData, roleId: number) {
        const color = ColorConst.getPlayerColor(roleId);
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
        const radius = TablePlayerSkill.getConfigById<TablePlayerSkill>(shot.skillId).pull * visual.scale;
        const progress = Math.min(1, visual.age / 0.05);
        const expansion = progress < 0.5 ? 4 * progress ** 3 : 1 - 4 * (1 - progress) ** 3;
        graphics.fillColor = ColorConst.getCombatColor(roleId, 20);
        graphics.circle(shot.x, shot.y, radius);
        graphics.fill();
        graphics.fillColor = ColorConst.getPlayerColor(roleId);
        const coreRadius = (12 * expansion + 3 * Math.sin(visual.age * 97)) * visual.scale;
        if (coreRadius > 0) {
            graphics.circle(shot.x, shot.y, coreRadius);
            graphics.fill();
        }
        graphics.strokeColor = ColorConst.getPlayerColor(roleId);
        graphics.lineWidth = Math.min(12, Math.max(6, 6 + (radius - 96) / 112));
        for (let index = 0; index < 4; index++) {
            const angle = shot.angle + visual.spin * visual.age + (index + 0.5) * Math.PI / 2;
            graphics.arc(shot.x, shot.y, radius, angle - Math.PI / 8, angle + Math.PI / 8, false);
            graphics.stroke();
        }
    }
}

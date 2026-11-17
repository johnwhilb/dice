import { _decorator, Component, Graphics, Label, Node, UITransform } from "cc";
import type { Game } from "../../game/Game";
import { ColorConst } from "../../common/config/ColorConst";
import { TableCombatRule } from "../../common/table/TableCombatRule";
import { EffectKind } from "../EffectEvent";
import { CombatCamp } from "../../combat/CombatEvent";
import { BuffKind } from "../../buff/BuffEvent";

const { ccclass } = _decorator;

@ccclass("CombatEffectView")
export class EffectView extends Component {
    private labels: Label[] = [];

    render(game: Game) {
        const graphics = this.getComponent(Graphics);
        const rule = TableCombatRule.getCurrent();
        graphics.clear();
        game.projectile.ProjectileModel.projectiles.forEach((shot) => {
            if (shot.delay > 0 || shot.dead) {
                return;
            }
            graphics.fillColor = ColorConst.getPlayerColor(game.player.PlayerModel.players[shot.source].roleId);
            graphics.circle(shot.x, shot.y, rule.projectileRadius);
            graphics.fill();
        });
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
            graphics.rect(summon.x - rule.orbRadius, summon.y - rule.orbRadius, rule.orbRadius * 2, rule.orbRadius * 2);
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
            }
            return effect.kind === EffectKind.Damage || effect.kind === EffectKind.Heal;
        });
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
}

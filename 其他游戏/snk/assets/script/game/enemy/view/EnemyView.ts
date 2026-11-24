import { _decorator, Sprite, UITransform } from "cc";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import { ColorConst } from "../../common/config/ColorConst";
import { EnemyObjectKind } from "../EnemyEvent";
import { EnemyKeyEnum } from "../../common/table/EnemyKeyEnum";
import type { IEnemyData, IEnemyObject } from "../EnemyEvent";

const { ccclass } = _decorator;

@ccclass("EnemyView")
export class EnemyView extends GameComponent {
    // 世界对象只参与战斗判定，不监听 UI 触摸，保留战场触摸转向。
    protected setButton() {
        super.setButton(false);
    }

    private hitFlashDuration: number = 0.11;
    private hitScaleOffset: number = 0.28;
    private hitSpringStiffness: number = 210;
    private hitSpringDamping: number = 10;
    private boundEnemyId: number = -1;
    private trailFill: number = 1;
    private lastCombatTime: number = 0;

    setEnemy(enemy: IEnemyData, combatTime: number) {
        const dt = Math.max(0, Math.min(0.1, combatTime - this.lastCombatTime));
        this.lastCombatTime = combatTime;
        const hpRatio = enemy.maxHp > 0 ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp)) : 0;
        if (this.boundEnemyId !== enemy.id) {
            this.boundEnemyId = enemy.id;
            this.trailFill = hpRatio;
        } else if (this.trailFill > hpRatio) {
            this.trailFill = Math.max(hpRatio, this.trailFill - Math.max(0.8, (this.trailFill - hpRatio) * 3.8) * dt);
        } else {
            this.trailFill = hpRatio;
        }

        let offsetX = 0;
        let offsetY = 0;
        const windup = enemy.config.id === EnemyKeyEnum.Headbutter && enemy.chargeRemaining > enemy.config.skillDuration;
        if (windup && enemy.config.skillDelay > 0) {
            const intensity = 1 - Math.min(1, (enemy.chargeRemaining - enemy.config.skillDuration) / enemy.config.skillDelay);
            offsetX = (Math.random() - 0.5) * 6 * intensity;
            offsetY = (Math.random() - 0.5) * 6 * intensity;
        }
        this.node.setPosition(enemy.x + offsetX, enemy.y + offsetY, 0);

        const body = this.getNode("enemyBody");
        const shadow = this.getNode("enemyShadow");
        body.active = true;
        shadow.active = true;
        body.angle = enemy.angle;
        shadow.angle = enemy.angle;
        body.getComponent(UITransform).setContentSize(enemy.config.width, enemy.config.height);
        shadow.getComponent(UITransform).setContentSize(enemy.config.width, enemy.config.height);
        const color = ColorConst.getEnemyColor(enemy.config.id);
        let bodyColor = color;
        const hitAge = combatTime - (enemy.hitTime ?? Number.NEGATIVE_INFINITY);
        const fireAge = combatTime - (enemy.fireTime ?? Number.NEGATIVE_INFINITY);
        const age = Math.min(hitAge, fireAge);
        const springDecay = this.hitSpringDamping / 2;
        const springFrequency = Math.sqrt(this.hitSpringStiffness - springDecay ** 2);
        let scaleX = 1;
        let scaleY = 1;
        if (age < 1) {
            const phase = springFrequency * age;
            const spring =
                (hitAge <= fireAge ? this.hitScaleOffset : 0.18) *
                Math.exp(-springDecay * age) *
                (Math.cos(phase) + (springDecay / springFrequency) * Math.sin(phase));
            scaleX += spring * 1.15;
            scaleY -= spring * 0.55;
        }
        const charging = enemy.config.id === EnemyKeyEnum.Headbutter && enemy.chargeRemaining > 0 && enemy.chargeRemaining <= enemy.config.skillDuration;
        if (charging) {
            scaleX *= 1.22;
            scaleY *= 0.84;
        }
        if (windup && enemy.config.skillDelay > 0) {
            const remaining = Math.min(1, (enemy.chargeRemaining - enemy.config.skillDuration) / enemy.config.skillDelay);
            bodyColor = color.clone().lerp(ColorConst.WHITE, 1 - remaining ** 2);
            scaleX -= 0.14 * (1 - remaining);
            scaleY += 0.2 * (1 - remaining);
        }
        body.setScale(scaleX, scaleY, 1);
        shadow.setScale(scaleX, scaleY, 1);
        body.getComponent(Sprite).color = hitAge < this.hitFlashDuration || fireAge < 0.08 ? ColorConst.WHITE : bodyColor;

        const visible = enemy.config.boss || enemy.hp < enemy.maxHp;
        const hpOffsetY = enemy.config.height / 2 + (enemy.config.boss ? 18 : 11);
        const hpWidth = enemy.config.boss ? Math.max(72, enemy.config.width * 1.25) : Math.max(40, enemy.config.width * 1.05);
        const hpHeight = enemy.config.boss ? 7 : 5;
        const track = this.getNode("enemyHpTrack");
        const trail = this.getNode("enemyHpTrail");
        const fill = this.getNode("enemyHpFill");
        track.active = visible;
        trail.active = visible;
        fill.active = visible;
        if (visible) {
            track.setPosition(0, hpOffsetY, 0);
            trail.setPosition(0, hpOffsetY, 0);
            fill.setPosition(0, hpOffsetY, 0);
            track.getComponent(UITransform).setContentSize(hpWidth, hpHeight);
            trail.getComponent(UITransform).setContentSize(hpWidth, hpHeight);
            fill.getComponent(UITransform).setContentSize(hpWidth, hpHeight);
            const trailSprite = trail.getComponent(Sprite);
            trailSprite.color = ColorConst.battleHpTrail;
            trailSprite.fillRange = this.trailFill;
            const fillSprite = fill.getComponent(Sprite);
            fillSprite.color = hitAge < 0.08 ? ColorConst.WHITE : color;
            fillSprite.fillRange = hpRatio;
        }
    }

    setObject(object: IEnemyObject) {
        this.boundEnemyId = -1;
        this.node.setPosition(object.x, object.y, 0);
        const body = this.getNode("enemyBody");
        const shadow = this.getNode("enemyShadow");
        const procedural =
            object.kind === EnemyObjectKind.SpawnMarker ||
            object.kind === EnemyObjectKind.Mine ||
            object.kind === EnemyObjectKind.Gold;
        body.active = object.delay <= 0 && !procedural;
        shadow.active = body.active;
        if (body.active) {
            body.angle = object.angle;
            shadow.angle = object.angle;
            body.setScale(1, 1, 1);
            shadow.setScale(1, 1, 1);
            body.getComponent(UITransform).setContentSize(object.width, object.height);
            shadow.getComponent(UITransform).setContentSize(object.width, object.height);
            body.getComponent(Sprite).color = ColorConst.getEnemyColor(object.configId);
        }
        this.getNode("enemyHpTrack").active = false;
        this.getNode("enemyHpTrail").active = false;
        this.getNode("enemyHpFill").active = false;
    }
}

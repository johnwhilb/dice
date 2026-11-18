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

    private hitFlashDuration: number = 0.1;
    private hitScaleOffset: number = 0.25;
    private hitSpringStiffness: number = 200;
    private hitSpringDamping: number = 10;

    setEnemy(enemy: IEnemyData, combatTime: number) {
        this.nodeTreeInfoLite();
        this.node.setPosition(enemy.x, enemy.y, 0);
        const body = this.getNode("enemyBody");
        body.active = true;
        body.angle = enemy.angle;
        body.getComponent(UITransform).setContentSize(enemy.config.width, enemy.config.height);
        const color = ColorConst.getEnemyColor(enemy.config.id);
        let bodyColor = color;
        const hitAge = combatTime - (enemy.hitTime ?? Number.NEGATIVE_INFINITY);
        const fireAge = combatTime - (enemy.fireTime ?? Number.NEGATIVE_INFINITY);
        const age = Math.min(hitAge, fireAge);
        const springDecay = this.hitSpringDamping / 2;
        const springFrequency = Math.sqrt(this.hitSpringStiffness - springDecay ** 2);
        let scale = 1;
        if (age < 1) {
            const phase = springFrequency * age;
            scale +=
                (hitAge <= fireAge ? this.hitScaleOffset : 0.16) *
                Math.exp(-springDecay * age) *
                (Math.cos(phase) + (springDecay / springFrequency) * Math.sin(phase));
        }
        const windup = enemy.config.id === EnemyKeyEnum.Headbutter && enemy.chargeRemaining > enemy.config.skillDuration;
        if (windup && enemy.config.skillDelay > 0) {
            const remaining = Math.min(1, (enemy.chargeRemaining - enemy.config.skillDuration) / enemy.config.skillDelay);
            bodyColor = color.clone().lerp(ColorConst.WHITE, 1 - remaining ** 2);
            scale += 0.12 * (1 - remaining);
        }
        body.setScale(scale, scale, 1);
        body.getComponent(Sprite).color = hitAge < this.hitFlashDuration || fireAge < 0.08 ? ColorConst.WHITE : bodyColor;
        const visible = enemy.config.boss || enemy.hp < enemy.maxHp;
        this.getNode("enemyHpTrack").active = visible;
        this.getNode("enemyHpFill").active = visible;
        const fill = this.getNode("enemyHpFill").getComponent(Sprite);
        fill.color = color;
        fill.fillRange = enemy.hp / enemy.maxHp;
    }

    setObject(object: IEnemyObject) {
        this.nodeTreeInfoLite();
        this.node.setPosition(object.x, object.y, 0);
        const body = this.getNode("enemyBody");
        body.angle = object.angle;
        body.setScale(1, 1, 1);
        body.getComponent(UITransform).setContentSize(object.width, object.height);
        body.getComponent(Sprite).color =
            object.kind === EnemyObjectKind.Gold ? ColorConst.YELLOW : ColorConst.getEnemyColor(object.configId);
        this.getNode("enemyHpTrack").active = false;
        this.getNode("enemyHpFill").active = false;
        body.active = object.delay <= 0 && object.kind !== EnemyObjectKind.SpawnMarker;
    }
}

import { _decorator, Sprite, UITransform } from "cc";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import { ColorConst } from "../../common/config/ColorConst";
import { EnemyObjectKind } from "../EnemyEvent";
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
        const hitAge = combatTime - (enemy.hitTime ?? Number.NEGATIVE_INFINITY);
        const springDecay = this.hitSpringDamping / 2;
        const springFrequency = Math.sqrt(this.hitSpringStiffness - springDecay ** 2);
        let scale = 1;
        if (hitAge < 1) {
            const phase = springFrequency * hitAge;
            scale +=
                this.hitScaleOffset *
                Math.exp(-springDecay * hitAge) *
                (Math.cos(phase) + (springDecay / springFrequency) * Math.sin(phase));
        }
        body.setScale(scale, scale, 1);
        body.getComponent(Sprite).color = hitAge < this.hitFlashDuration ? ColorConst.WHITE : color;
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
        body.active = object.delay <= 0;
    }
}

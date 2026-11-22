import { _decorator, EventTouch, Graphics, instantiate, Label, Layout, Node, Prefab, UITransform, Vec3 } from "cc";
import { CCView } from "db://oops-framework/module/common/CCView";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import type { Battle } from "../Battle";
import { BattleBll } from "../bll/BattleBll";
import { PlayerEvent } from "../../player/PlayerEvent";
import { PlayerView } from "../../player/view/PlayerView";
import { PlayerHpItem } from "../../player/view/PlayerHpItem";
import type { IPlayerData } from "../../player/model/PlayerModel";
import { BattleEvent, BattleState } from "../BattleEvent";
import { EnemyEvent } from "../../enemy/EnemyEvent";
import { EnemyView } from "../../enemy/view/EnemyView";
import { EffectView } from "../../effect/view/EffectView";
import { playerHurtDuration, recoilDuration } from "../../effect/EffectEvent";
import { CombatEvent } from "../../combat/CombatEvent";

const { ccclass, property } = _decorator;

@ccclass("BattleView")
@ecs.register("BattleView", false)
@gui.register("BattleView", { layer: LayerType.UI, prefab: "gui/battle/ui/BattleView" })
export class BattleView extends CCView<Battle> {
    @property(Prefab)
    private playerPrefab: Prefab;
    @property(Prefab)
    private playerHpPrefab: Prefab;
    @property(Prefab)
    private enemyPrefab: Prefab;
    private bodies: PlayerView[] = [];
    private enemies: EnemyView[] = [];
    private objects: EnemyView[] = [];
    private arenaTransform: UITransform;
    private combatTransform: UITransform;
    private arenaOrigin: Vec3;
    private effects: EffectView;

    get model() {
        return this.ent.game.player.PlayerModel;
    }

    get business() {
        return this.ent.getBusiness<BattleBll>(BattleBll);
    }

    start() {
        this.on(PlayerEvent.UpdatePlayers, this.refresh, this);
        this.on(PlayerEvent.UpdatePose, this.refreshPose, this);
        this.on(PlayerEvent.UpdateHp, this.refreshPlayerHp, this);
        this.on(EnemyEvent.UpdateFrame, this.refreshEnemies, this);
        this.on(BattleEvent.UpdateState, this.refreshState, this);
        this.on(CombatEvent.UpdateFrame, this.refreshEffects, this);
        const arena = this.getNode("arena");
        this.arenaTransform = arena.getComponent(UITransform);
        this.arenaOrigin = arena.position.clone();
        this.business.setArenaSize(this.arenaTransform.width, this.arenaTransform.height);
        const model = this.ent.BattleModel;
        const combatLayer = new Node("combatLayer");
        combatLayer.layer = arena.layer;
        combatLayer.parent = arena;
        combatLayer.setScale(model.combatScale, model.combatScale, 1);
        this.combatTransform = combatLayer.addComponent(UITransform);
        this.combatTransform.setContentSize(model.combatWidth, model.combatHeight);
        this.getNode("enemyLayer").parent = combatLayer;
        this.getNode("enemyObjectLayer").parent = combatLayer;
        const effects = new Node("combatEffects");
        effects.layer = arena.layer;
        effects.parent = combatLayer;
        effects.addComponent(UITransform).setContentSize(this.combatTransform.contentSize);
        effects.addComponent(Graphics);
        this.effects = effects.addComponent(EffectView);
        arena.on(Node.EventType.TOUCH_START, this.steer, this);
        arena.on(Node.EventType.TOUCH_MOVE, this.steer, this);
        this.refresh();
        this.refreshEnemies();
        this.refreshState();
        this.refreshEffects();
    }

    private refreshEffects() {
        const game = this.ent.game;
        const model = game.effect.EffectModel;
        const remaining = model.shakeLife > 0 ? model.shakeLife / model.shakeDuration : 0;
        const phase = (1 - remaining) * Math.PI * 5;
        const amplitude = model.shakeAmplitude * remaining ** 2;
        const origin = this.arenaOrigin;
        this.arenaTransform.node.setPosition(origin.x + Math.sin(phase) * amplitude, origin.y + Math.sin(phase * 1.5) * amplitude * 0.65, origin.z);
        this.bodies.forEach((body, index) => {
            if (body.node.active) {
                body.setFeedback((model.recoilLife.get(index) ?? 0) / recoilDuration, (model.hurtLife.get(index) ?? 0) / playerHurtDuration);
            }
        });
        this.effects.render(game);
    }

    refresh() {
        const combatLayer = this.combatTransform.node;
        for (let index = this.bodies.length; index < this.model.players.length; index++) {
            const node = instantiate(this.playerPrefab);
            node.parent = combatLayer;
            const body = node.getComponent(PlayerView);
            this.bodies.push(body);
        }
        this.bodies.forEach((body, index) => {
            body.node.active = index < this.model.players.length && this.model.players[index].hp > 0;
            if (body.node.active) {
                body.setData(this.model.players[index]);
            }
        });
        this.getNode("lbtParty").getComponent(Label).string = this.model.players
            .map((player) => {
                return `${player.config.name} Lv.${player.level}`;
            })
            .join("  /  ");
        this.refreshPose();
        this.setRwdContent(this.getNode("nodePlayerInfo"), this.model.players);
    }

    private setRwdContent(itemBox: Node, players: IPlayerData[]) {
        const children = itemBox.children;
        const length = Math.max(children.length, players.length);
        for (let index = 0; index < length; index++) {
            const player = players[index];
            if (player && index >= children.length) {
                const item = instantiate(this.playerHpPrefab);
                item.parent = itemBox;
            }
            const item = children[index];
            item.active = !!player;
            if (player) {
                item.getComponent(PlayerHpItem).setData(player);
            }
        }
        itemBox.getComponent(Layout).updateLayout();
    }

    private refreshPlayerHp(event: string, index: number) {
        this.getNode("nodePlayerInfo").children[index].getComponent(PlayerHpItem).setData(this.model.players[index]);
    }

    private refreshEnemies() {
        const model = this.ent.game.enemy.EnemyModel;
        const enemyLayer = this.getNode("enemyLayer");
        const objectLayer = this.getNode("enemyObjectLayer");
        for (let index = this.enemies.length; index < model.enemies.length; index++) {
            const node = instantiate(this.enemyPrefab);
            node.parent = enemyLayer;
            this.enemies.push(node.getComponent(EnemyView));
        }
        for (let index = this.objects.length; index < model.objects.length; index++) {
            const node = instantiate(this.enemyPrefab);
            node.parent = objectLayer;
            this.objects.push(node.getComponent(EnemyView));
        }
        this.enemies.forEach((view, index) => {
            view.node.active = index < model.enemies.length;
            if (view.node.active) {
                view.setEnemy(model.enemies[index], this.ent.game.combat.CombatModel.elapsed);
            }
        });
        this.objects.forEach((view, index) => {
            view.node.active = index < model.objects.length;
            if (view.node.active) {
                view.setObject(model.objects[index]);
            }
        });
    }

    private refreshState() {
        const model = this.ent.BattleModel;
        const enemy = this.ent.game.enemy.EnemyModel;
        const ended = model.state === BattleState.Victory || model.state === BattleState.Defeat;
        this.getNode("battleResult").active = ended && !this.ent.game.effect.EffectModel.slowLife;
        this.getNode("lbtBattleResult").getComponent(Label).string = model.state === BattleState.Victory ? "关卡胜利" : "全队阵亡";
        this.getNode("lbtBattleStatus").getComponent(Label).string = model.state === BattleState.Countdown
            ? `第 ${model.level} 关 · ${Math.ceil(model.countdown)}`
            : ended ? `第 ${model.level} 关 · ${model.state === BattleState.Victory ? "胜利" : "失败"}`
            : `第 ${model.level} 关 · ${enemy.stage.bossId ? "首领战" : `波次 ${model.wave}/${enemy.stage.maxWaves}`} · 敌人 ${enemy.enemies.length}`;
    }

    private refreshPose() {
        this.bodies.forEach((body, index) => {
            if (body.node.active) {
                body.setPose(this.model.players[index].pose);
            }
        });
    }

    private steer(event: EventTouch) {
        if (this.ent.game.GameModel.transitioning) {
            return;
        }
        const point = event.getUILocation();
        const arena = this.arenaTransform.node;
        const origin = Vec3.transformMat4(new Vec3(), this.arenaOrigin, arena.parent.worldMatrix);
        const offset = Vec3.subtract(new Vec3(), arena.worldPosition, origin);
        const local = this.combatTransform.convertToNodeSpaceAR(new Vec3(point.x + offset.x, point.y + offset.y, 0));
        this.business.steer(local.x, local.y);
    }

    update(deltaTime: number) {
        if (this.ent) {
            this.business.updateMovement(deltaTime);
        }
    }

    reset() {
        this.off(PlayerEvent.UpdatePlayers, this.refresh, this);
        this.off(PlayerEvent.UpdatePose, this.refreshPose, this);
        this.off(PlayerEvent.UpdateHp, this.refreshPlayerHp, this);
        this.off(EnemyEvent.UpdateFrame, this.refreshEnemies, this);
        this.off(BattleEvent.UpdateState, this.refreshState, this);
        this.off(CombatEvent.UpdateFrame, this.refreshEffects, this);
        this.bodies = [];
        this.enemies = [];
        this.objects = [];
    }

    getTransitionOrigin() {
        const leader = this.model.players[0];
        return leader ? this.combatTransform.convertToWorldSpaceAR(new Vec3(leader.pose.x, leader.pose.y, 0)) : undefined;
    }

    btnShop() {
        this.ent.game.returnShop();
    }

    btnBattleReturnShop() {
        if (this.ent.BattleModel.settled) {
            this.ent.game.returnShop();
        } else {
            this.business.returnAfterResult();
        }
    }
}

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
import { EffectBll } from "../../effect/bll/EffectBll";
import { ShopOfferEffect } from "../../effect/view/ShopOfferEffect";
import { playerHurtDuration, recoilDuration } from "../../effect/EffectEvent";
import { CombatEvent } from "../../combat/CombatEvent";
import { ColorConst } from "../../common/config/ColorConst";

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
    private combatTransform: UITransform;
    private arenaCamera: Node;
    private effects: EffectView;
    private spawnBurst: ShopOfferEffect;
    private countdownLabel: Label;
    private clearGlyphs: Node;
    private clearElapsed: number = 0;
    private revealedGlyphs: number = 0;

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
        this.on(EnemyEvent.SpawnArrival, this.playEnemySpawnBurst, this);
        this.on(BattleEvent.UpdateState, this.refreshState, this);
        this.on(BattleEvent.CountdownFinished, this.playCountdownBurst, this);
        this.on(CombatEvent.UpdateFrame, this.refreshEffects, this);
        const arena = this.getNode("arena");
        this.countdownLabel = this.getNode("lbtBattleCountdown").getComponent(Label);
        this.clearGlyphs = this.getNode("battleClearGlyphs");
        const arenaTransform = arena.getComponent(UITransform);
        this.business.setArenaSize(arenaTransform.width, arenaTransform.height);
        const border = this.getNode("arenaBorder");
        const content = this.getNode("content");
        const borderIndex = border.getSiblingIndex();
        this.arenaCamera = new Node("arenaCamera");
        this.arenaCamera.layer = border.layer;
        this.arenaCamera.parent = content;
        this.arenaCamera.setSiblingIndex(borderIndex);
        this.arenaCamera.addComponent(UITransform).setContentSize(content.getComponent(UITransform).contentSize);
        border.parent = this.arenaCamera;
        const model = this.ent.BattleModel;
        const combatLayer = new Node("combatLayer");
        combatLayer.layer = arena.layer;
        combatLayer.parent = arena;
        combatLayer.setSiblingIndex(this.getNode("BattleAnnouncement").getSiblingIndex());
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
        const burst = new Node("spawnBurst");
        burst.layer = arena.layer;
        burst.parent = combatLayer;
        burst.addComponent(UITransform);
        this.spawnBurst = burst.addComponent(ShopOfferEffect);
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
        const battle = this.ent.BattleModel;
        this.arenaCamera.setPosition(
            -battle.cameraX * battle.combatScale -
                (model.wallShakeX + model.collisionShakeX) * battle.originalToViewScale +
                Math.sin(phase) * amplitude,
            -battle.cameraY * battle.combatScale -
                (model.wallShakeY + model.collisionShakeY) * battle.originalToViewScale +
                Math.sin(phase * 1.5) * amplitude * 0.65,
            0
        );
        this.bodies.forEach((body, index) => {
            if (body.node.active) {
                body.setFeedback(
                    (model.recoilLife.get(index) ?? 0) / recoilDuration,
                    (model.hurtLife.get(index) ?? 0) / playerHurtDuration
                );
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
        const victory = model.state === BattleState.Victory;
        const defeat = model.state === BattleState.Defeat;
        const ended = victory || defeat;
        const showResult =
            (defeat || (victory && model.victoryPanelDelay === 0)) && !this.ent.game.effect.EffectModel.slowLife;
        const countdown = model.state === BattleState.Countdown ? Math.ceil(model.countdown) : 0;
        this.countdownLabel.node.active = countdown > 0;
        if (countdown > 0) {
            this.countdownLabel.string = `${countdown}`;
        }
        this.clearGlyphs.active = victory && !showResult;
        if (!victory && this.revealedGlyphs > 0) {
            this.clearElapsed = 0;
            this.revealedGlyphs = 0;
            for (const glyph of this.clearGlyphs.children) {
                glyph.active = false;
            }
        }
        this.getNode("battleResult").active = showResult;
        this.getNode("lbtBattleResult").getComponent(Label).string = victory ? "关卡胜利" : "全队阵亡";
        this.getNode("lbtBattleStatus").getComponent(Label).string =
            model.state === BattleState.Countdown
                ? `第 ${model.level} 关`
                : ended
                  ? `第 ${model.level} 关 · ${victory ? "胜利" : "失败"}`
                  : `第 ${model.level} 关 · ${enemy.stage.bossId ? "首领战" : `波次 ${model.wave}/${enemy.stage.maxWaves}`} · 敌人 ${enemy.enemies.length}`;
    }

    private playCountdownBurst() {
        const position = this.combatTransform.convertToNodeSpaceAR(this.countdownLabel.node.worldPosition);
        this.spawnBurst.playAt(position.x, position.y, this.countdownLabel.color);
    }

    private playEnemySpawnBurst(event: string, x: number, y: number) {
        this.spawnBurst.playAt(x, y, ColorConst.enemySpawnParticle);
    }

    private updateAnnouncement(deltaTime: number) {
        const glyphs = this.clearGlyphs.children;
        if (!this.clearGlyphs.active || this.ent.BattleModel.victoryPanelDelay !== undefined) {
            return;
        }
        this.clearElapsed += deltaTime;
        const visible = Math.min(glyphs.length, Math.floor(this.clearElapsed / 0.05) + 1);
        const effect = this.ent.game.effect.getBusiness<EffectBll>(EffectBll);
        for (const glyph of glyphs.slice(this.revealedGlyphs, visible)) {
            glyph.active = true;
            effect.showVictoryAnnouncementShake();
        }
        this.revealedGlyphs = visible;
        if (visible === glyphs.length) {
            this.business.finishVictoryAnnouncement();
        }
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
        const battle = this.ent.BattleModel;
        const drift = new Vec3(-battle.cameraX * battle.combatScale, -battle.cameraY * battle.combatScale, 0);
        const origin = Vec3.transformMat4(drift, drift, this.arenaCamera.parent.worldMatrix);
        const offset = Vec3.subtract(new Vec3(), this.arenaCamera.worldPosition, origin);
        const local = this.combatTransform.convertToNodeSpaceAR(new Vec3(point.x + offset.x, point.y + offset.y, 0));
        this.business.steer(local.x, local.y);
    }

    update(deltaTime: number) {
        if (this.ent) {
            this.business.updateMovement(deltaTime);
            this.updateAnnouncement(deltaTime);
        }
    }

    reset() {
        this.off(PlayerEvent.UpdatePlayers, this.refresh, this);
        this.off(PlayerEvent.UpdatePose, this.refreshPose, this);
        this.off(PlayerEvent.UpdateHp, this.refreshPlayerHp, this);
        this.off(EnemyEvent.UpdateFrame, this.refreshEnemies, this);
        this.off(EnemyEvent.SpawnArrival, this.playEnemySpawnBurst, this);
        this.off(BattleEvent.UpdateState, this.refreshState, this);
        this.off(BattleEvent.CountdownFinished, this.playCountdownBurst, this);
        this.off(CombatEvent.UpdateFrame, this.refreshEffects, this);
        this.bodies = [];
        this.enemies = [];
        this.objects = [];
        this.clearElapsed = 0;
        this.revealedGlyphs = 0;
    }

    getTransitionOrigin() {
        const leader = this.model.players[0];
        return leader
            ? this.combatTransform.convertToWorldSpaceAR(new Vec3(leader.pose.x, leader.pose.y, 0))
            : undefined;
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

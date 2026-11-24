import {
    _decorator,
    EventTouch,
    Graphics,
    instantiate,
    Label,
    Layout,
    Node,
    Prefab,
    UIOpacity,
    UITransform,
    Vec3,
} from "cc";
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

const bannerPopDuration = 0.14;
const bannerHoldDuration = 0.88;
const bannerFadeDuration = 0.28;
const bannerTotalDuration = bannerPopDuration + bannerHoldDuration + bannerFadeDuration;

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
    private playerLayer: Node;
    private floorGraphics: Graphics;
    private arenaCamera: Node;
    private effects: EffectView;
    private spawnBurst: ShopOfferEffect;
    private countdownLabel: Label;
    private countdownPopLife: number = 0;
    private clearGlyphs: Node;
    private clearElapsed: number = 0;
    private revealedGlyphs: number = 0;
    private glyphPopLives: number[] = [];
    private waveBannerNode: Node;
    private waveBannerGraphics: Graphics;
    private waveBannerLabel: Label;
    private waveBannerOpacity: UIOpacity;
    private waveBannerElapsed: number = bannerTotalDuration;
    private waveBannerBoss: boolean = false;
    private streakNode: Node;
    private streakLabel: Label;
    private lastShownStreak: number = 0;
    private streakPopLife: number = 0;
    private resultSummaryLabel: Label;
    private resultShown: boolean = false;
    private resultPopLife: number = 0;

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
        this.on(BattleEvent.CountdownTick, this.playCountdownTick, this);
        this.on(BattleEvent.CountdownFinished, this.playCountdownBurst, this);
        this.on(BattleEvent.WaveAnnounce, this.playWaveBanner, this);
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

        const floorNode = new Node("combatFloor");
        floorNode.layer = arena.layer;
        floorNode.parent = combatLayer;
        floorNode.addComponent(UITransform).setContentSize(this.combatTransform.contentSize);
        this.floorGraphics = floorNode.addComponent(Graphics);

        this.getNode("enemyObjectLayer").parent = combatLayer;
        this.getNode("enemyLayer").parent = combatLayer;

        this.playerLayer = new Node("playerLayer");
        this.playerLayer.layer = arena.layer;
        this.playerLayer.parent = combatLayer;
        this.playerLayer.addComponent(UITransform).setContentSize(this.combatTransform.contentSize);

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

        this.createWaveBanner(content);
        this.createStreakBadge(content);
        this.createResultSummary();

        arena.on(Node.EventType.TOUCH_START, this.steer, this);
        arena.on(Node.EventType.TOUCH_MOVE, this.steer, this);
        arena.on(Node.EventType.TOUCH_END, this.releaseSteer, this);
        arena.on(Node.EventType.TOUCH_CANCEL, this.releaseSteer, this);

        this.countdownPopLife = 0.24;
        this.refresh();
        this.refreshEnemies();
        this.refreshState();
        this.refreshEffects();
    }

    private createWaveBanner(content: Node) {
        const banner = new Node("waveBanner");
        banner.layer = content.layer;
        banner.parent = content;
        banner.setPosition(0, 215, 0);
        banner.addComponent(UITransform).setContentSize(340, 44);
        this.waveBannerOpacity = banner.addComponent(UIOpacity);
        this.waveBannerGraphics = banner.addComponent(Graphics);

        const labelNode = new Node("lbtWaveBanner");
        labelNode.layer = content.layer;
        labelNode.parent = banner;
        labelNode.addComponent(UITransform).setContentSize(320, 32);
        const label = labelNode.addComponent(Label);
        label.fontSize = 24;
        label.lineHeight = 26;
        label.isBold = true;
        label.enableOutline = true;
        label.outlineColor = ColorConst.battleDamageOutline;
        label.outlineWidth = 2;
        this.waveBannerLabel = label;
        this.waveBannerNode = banner;
        this.waveBannerNode.active = false;
    }

    private createStreakBadge(content: Node) {
        const node = new Node("streakBadge");
        node.layer = content.layer;
        node.parent = content;
        node.setPosition(485, 226, 0);
        node.addComponent(UITransform).setContentSize(200, 34);
        const label = node.addComponent(Label);
        label.fontSize = 24;
        label.lineHeight = 26;
        label.isBold = true;
        label.color = ColorConst.battleCritGold;
        label.enableOutline = true;
        label.outlineColor = ColorConst.battleDamageOutline;
        label.outlineWidth = 2;
        this.streakNode = node;
        this.streakLabel = label;
        this.streakNode.active = false;
    }

    private createResultSummary() {
        const resultNode = this.getNode("battleResult");
        const summaryNode = new Node("lbtBattleSummary");
        summaryNode.layer = resultNode.layer;
        summaryNode.parent = resultNode;
        summaryNode.setPosition(0, 4, 0);
        summaryNode.addComponent(UITransform).setContentSize(480, 24);
        const label = summaryNode.addComponent(Label);
        label.fontSize = 18;
        label.lineHeight = 20;
        label.color = ColorConst.shopText;
        this.resultSummaryLabel = label;
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
        const elapsed = game.combat.CombatModel.elapsed;
        this.bodies.forEach((body, index) => {
            if (body.node.active) {
                const player = this.model.players[index];
                const lowHp = player.stats.hp > 0 && player.hp / player.stats.hp <= 0.3;
                const lowHpPulse = lowHp ? 0.5 + 0.5 * Math.sin(elapsed * 12) : 0;
                body.setFeedback(
                    (model.recoilLife.get(index) ?? 0) / recoilDuration,
                    (model.hurtLife.get(index) ?? 0) / playerHurtDuration,
                    lowHpPulse,
                    player.lasting
                );
            }
        });
        this.updateStreakBadge(model.killStreak);
        this.effects.render(game, this.floorGraphics);
    }

    private updateStreakBadge(streak: number) {
        const visible = streak >= 5 && this.ent.BattleModel.state === BattleState.Running;
        this.streakNode.active = visible;
        if (!visible) {
            this.lastShownStreak = 0;
            return;
        }
        if (streak !== this.lastShownStreak) {
            this.lastShownStreak = streak;
            this.streakPopLife = 0.22;
            this.streakLabel.string = `${streak} 连杀!`;
            this.streakLabel.color = streak >= 12 ? ColorConst.battleDangerRed : ColorConst.battleCritGold;
        }
    }

    refresh() {
        for (let index = this.bodies.length; index < this.model.players.length; index++) {
            const node = instantiate(this.playerPrefab);
            node.parent = this.playerLayer;
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
        const effectModel = this.ent.game.effect.EffectModel;
        const victory = model.state === BattleState.Victory;
        const defeat = model.state === BattleState.Defeat;
        const ended = victory || defeat;
        const showResult = (defeat || (victory && model.victoryPanelDelay === 0)) && !effectModel.slowLife;
        const countdown = model.state === BattleState.Countdown ? Math.ceil(model.countdown) : 0;
        this.countdownLabel.node.active = countdown > 0;
        if (countdown > 0) {
            this.countdownLabel.string = `${countdown}`;
        }
        this.clearGlyphs.active = victory && !showResult;
        if (!victory && this.revealedGlyphs > 0) {
            this.clearElapsed = 0;
            this.revealedGlyphs = 0;
            this.glyphPopLives = [];
            for (const glyph of this.clearGlyphs.children) {
                glyph.active = false;
                glyph.setScale(1, 1, 1);
            }
        }
        const resultNode = this.getNode("battleResult");
        resultNode.active = showResult;
        if (showResult && !this.resultShown) {
            this.resultShown = true;
            this.resultPopLife = 0.24;
            const titleLabel = this.getNode("lbtBattleResult").getComponent(Label);
            titleLabel.string = victory ? "关卡胜利" : "全队阵亡";
            titleLabel.color = victory ? ColorConst.battleCritGold : ColorConst.battleDangerRed;
            this.resultSummaryLabel.string = `用时 ${model.battleDuration.toFixed(1)}s  ·  击杀 ${effectModel.totalKills}  ·  暴击 ${effectModel.totalCrits}  ·  金币 +${enemy.pickedUpGold}`;
        } else if (!showResult) {
            this.resultShown = false;
        }
        const goldText = enemy.pickedUpGold > 0 ? ` · 金币 +${enemy.pickedUpGold}` : "";
        this.getNode("lbtBattleStatus").getComponent(Label).string =
            model.state === BattleState.Countdown
                ? `第 ${model.level} 关 · 准备迎战`
                : ended
                  ? `第 ${model.level} 关 · ${victory ? "胜利" : "失败"} · 击杀 ${effectModel.totalKills}${goldText}`
                  : `第 ${model.level} 关 · ${enemy.stage.bossId ? "首领战" : `波次 ${model.wave}/${enemy.stage.maxWaves}`} · 敌人 ${enemy.enemies.length} · 击杀 ${effectModel.totalKills}${goldText}`;
    }

    private playCountdownTick() {
        this.countdownPopLife = 0.26;
    }

    private playCountdownBurst() {
        const position = this.combatTransform.convertToNodeSpaceAR(this.countdownLabel.node.worldPosition);
        this.spawnBurst.playAt(position.x, position.y, this.countdownLabel.color);
    }

    private playWaveBanner(event: string, title: string, boss: boolean) {
        this.waveBannerBoss = boss;
        this.waveBannerElapsed = 0;
        this.waveBannerLabel.string = title;
        this.waveBannerLabel.color = boss ? ColorConst.battleDangerRed : ColorConst.WHITE;
        this.waveBannerNode.active = true;
        this.drawWaveBannerBackdrop(boss);
    }

    private drawWaveBannerBackdrop(boss: boolean) {
        const graphics = this.waveBannerGraphics;
        graphics.clear();
        const halfW = 160;
        const halfH = 20;
        graphics.fillColor = ColorConst.battleBannerBg;
        graphics.rect(-halfW, -halfH, halfW * 2, halfH * 2);
        graphics.fill();

        const accent = boss ? ColorConst.battleDangerRed : ColorConst.battleCritGold;
        graphics.fillColor = accent;
        graphics.rect(-halfW, -halfH, 6, halfH * 2);
        graphics.rect(halfW - 6, -halfH, 6, halfH * 2);
        graphics.fill();
    }

    private playEnemySpawnBurst(event: string, x: number, y: number) {
        this.spawnBurst.playAt(x, y, ColorConst.enemySpawnParticle);
    }

    private updateAnnouncement(deltaTime: number) {
        const glyphs = this.clearGlyphs.children;
        for (let index = 0; index < this.glyphPopLives.length; index++) {
            if (this.glyphPopLives[index] > 0) {
                this.glyphPopLives[index] = Math.max(0, this.glyphPopLives[index] - deltaTime);
                const t = this.glyphPopLives[index] / 0.16;
                const scale = 1 + 0.55 * t * t;
                glyphs[index].setScale(scale, scale, 1);
            }
        }
        if (!this.clearGlyphs.active || this.ent.BattleModel.victoryPanelDelay !== undefined) {
            return;
        }
        this.clearElapsed += deltaTime;
        const visible = Math.min(glyphs.length, Math.floor(this.clearElapsed / 0.05) + 1);
        const effect = this.ent.game.effect.getBusiness<EffectBll>(EffectBll);
        for (let index = this.revealedGlyphs; index < visible; index++) {
            glyphs[index].active = true;
            glyphs[index].setScale(1.55, 1.55, 1);
            this.glyphPopLives[index] = 0.16;
            effect.showVictoryAnnouncementShake();
        }
        this.revealedGlyphs = visible;
        if (visible === glyphs.length) {
            this.business.finishVictoryAnnouncement();
        }
    }

    private updateHudAnimations(deltaTime: number) {
        if (this.countdownPopLife > 0 && this.countdownLabel.node.active) {
            this.countdownPopLife = Math.max(0, this.countdownPopLife - deltaTime);
            const t = this.countdownPopLife / 0.26;
            const scale = 2 * (1 + 0.55 * t * t);
            this.countdownLabel.node.setScale(scale, scale, 1);
        }
        if (this.waveBannerNode.active) {
            this.waveBannerElapsed += deltaTime;
            if (this.waveBannerElapsed >= bannerTotalDuration) {
                this.waveBannerNode.active = false;
            } else if (this.waveBannerElapsed < bannerPopDuration) {
                const progress = this.waveBannerElapsed / bannerPopDuration;
                const scale = 0.72 + 0.36 * Math.sin(progress * Math.PI * 0.7);
                this.waveBannerNode.setScale(scale, scale, 1);
                this.waveBannerNode.setPosition(0, 215, 0);
                this.waveBannerOpacity.opacity = Math.round(255 * progress);
            } else if (this.waveBannerElapsed < bannerPopDuration + bannerHoldDuration) {
                const pulse = this.waveBannerBoss ? 1 + 0.03 * Math.sin(this.waveBannerElapsed * 16) : 1;
                this.waveBannerNode.setScale(pulse, pulse, 1);
                this.waveBannerNode.setPosition(0, 215, 0);
                this.waveBannerOpacity.opacity = 255;
            } else {
                const fadeProgress =
                    (this.waveBannerElapsed - bannerPopDuration - bannerHoldDuration) / bannerFadeDuration;
                this.waveBannerNode.setScale(1, 1, 1);
                this.waveBannerNode.setPosition(0, 215 + 18 * fadeProgress, 0);
                this.waveBannerOpacity.opacity = Math.round(255 * (1 - fadeProgress));
            }
        }
        if (this.streakPopLife > 0 && this.streakNode.active) {
            this.streakPopLife = Math.max(0, this.streakPopLife - deltaTime);
            const t = this.streakPopLife / 0.22;
            const scale = 1 + 0.45 * t * t;
            this.streakNode.setScale(scale, scale, 1);
        }
        if (this.resultPopLife > 0 && this.resultShown) {
            this.resultPopLife = Math.max(0, this.resultPopLife - deltaTime);
            const progress = 1 - this.resultPopLife / 0.24;
            const scale = progress < 0.7 ? 0.76 + 0.3 * (progress / 0.7) : 1.06 - 0.06 * ((progress - 0.7) / 0.3);
            this.getNode("resultBackground").setScale(scale, scale, 1);
            this.getNode("lbtBattleResult").setScale(scale, scale, 1);
            this.resultSummaryLabel.node.setScale(scale, scale, 1);
            this.getNode("btnBattleReturnShop").setScale(scale, scale, 1);
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

    private releaseSteer() {
        this.business.releaseSteer();
    }

    update(deltaTime: number) {
        if (this.ent) {
            this.business.updateMovement(deltaTime);
            this.updateAnnouncement(deltaTime);
            this.updateHudAnimations(deltaTime);
        }
    }

    reset() {
        this.off(PlayerEvent.UpdatePlayers, this.refresh, this);
        this.off(PlayerEvent.UpdatePose, this.refreshPose, this);
        this.off(PlayerEvent.UpdateHp, this.refreshPlayerHp, this);
        this.off(EnemyEvent.UpdateFrame, this.refreshEnemies, this);
        this.off(EnemyEvent.SpawnArrival, this.playEnemySpawnBurst, this);
        this.off(BattleEvent.UpdateState, this.refreshState, this);
        this.off(BattleEvent.CountdownTick, this.playCountdownTick, this);
        this.off(BattleEvent.CountdownFinished, this.playCountdownBurst, this);
        this.off(BattleEvent.WaveAnnounce, this.playWaveBanner, this);
        this.off(CombatEvent.UpdateFrame, this.refreshEffects, this);
        this.bodies = [];
        this.enemies = [];
        this.objects = [];
        this.clearElapsed = 0;
        this.revealedGlyphs = 0;
        this.glyphPopLives = [];
        this.waveBannerElapsed = bannerTotalDuration;
        this.lastShownStreak = 0;
        this.streakPopLife = 0;
        this.resultShown = false;
        this.resultPopLife = 0;
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

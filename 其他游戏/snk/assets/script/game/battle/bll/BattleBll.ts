import { BattleEvent, BattleState } from "../BattleEvent";
import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import type { Battle } from "../Battle";
import type { IPlayerUnit } from "../../player/PlayerEvent";
import { PlayerBll } from "../../player/bll/PlayerBll";
import { GamePhase } from "../../game/model/GameModel";
import { EnemyBll } from "../../enemy/bll/EnemyBll";
import { TableBattleRule } from "../../common/table/TableBattleRule";
import { CombatBll } from "../../combat/bll/CombatBll";
import { EffectBll } from "../../effect/bll/EffectBll";
import { BattleAudioBll } from "../../effect/bll/BattleAudioBll";
import { BattleSound, bossSlowScale } from "../../effect/EffectEvent";

export class BattleBll extends CCBusiness<Battle> {
    /** 将商店 team 交给 Player 模块建立战场快照，并请求打开战场。 */
    prepareBattle(team: IPlayerUnit[], openView: boolean = true) {
        if (!team.length) {
            this.toast("shop_team_empty");
            return;
        }
        this.ent.game.combat.getBusiness<CombatBll>(CombatBll).reset();
        this.ent.game.effect.getBusiness<BattleAudioBll>(BattleAudioBll).resetCooldowns();
        this.ent.game.player.getBusiness<PlayerBll>(PlayerBll).prepare(team);
        this.ent.BattleModel.reset();
        const shop = this.ent.game.shop.ShopModel;
        const model = this.ent.BattleModel;
        model.level = shop.battleLevel;
        model.countdown = TableBattleRule.getCurrent().countdown;
        model.lastCountdownCeil = Math.ceil(model.countdown);
        this.ent.game.enemy.getBusiness<EnemyBll>(EnemyBll).prepare(shop.battleLevel, shop.loop, shop.newGamePlus);
        this.dispatchEvent(BattleEvent.UpdateState);
        if (openView) {
            this.dispatchEvent(BattleEvent.OpenBattle);
        } else {
            this.ent.game.combat.getBusiness<CombatBll>(CombatBll).refreshView();
        }
    }

    /** 保存预制体提供的战斗区域宽高 width、height。 */
    setArenaSize(width: number, height: number) {
        this.ent.BattleModel.setArenaSize(width, height);
    }

    /** 战斗阶段根据局部触摸坐标 x、y 请求角色转向，并更新触摸引导点。 */
    steer(x: number, y: number) {
        if (this.ent.game.GameModel.transitioning || this.ent.game.GameModel.phase !== GamePhase.Battle || this.ent.BattleModel.state === BattleState.Victory || this.ent.BattleModel.state === BattleState.Defeat) {
            return;
        }
        const model = this.ent.BattleModel;
        model.steerActive = true;
        model.steerX = x;
        model.steerY = y;
        model.steerFade = 1;
        this.ent.game.player.getBusiness<PlayerBll>(PlayerBll).steer(x, y);
    }

    /** 触摸结束时释放触摸引导点，使转向指示平滑淡出。 */
    releaseSteer() {
        this.ent.BattleModel.steerActive = false;
    }

    /** 播报最后一个字符显示后，开始胜利面板的半秒等待。 */
    finishVictoryAnnouncement() {
        const model = this.ent.BattleModel;
        if (model.state === BattleState.Victory && model.victoryPanelDelay === undefined) {
            model.victoryPanelDelay = 0.5;
        }
    }

    /** 在战斗阶段推进 deltaTime 秒的玩家、敌人、刷怪、顿帧和结算流程。 */
    updateMovement(deltaTime: number) {
        const model = this.ent.BattleModel;
        if (this.ent.game.GameModel.transitioning || this.ent.game.GameModel.phase !== GamePhase.Battle || !model.arenaWidth || !model.arenaHeight) {
            return;
        }
        const rule = TableBattleRule.getCurrent();
        const game = this.ent.game;
        const effects = game.effect.EffectModel;
        const effectBll = game.effect.getBusiness<EffectBll>(EffectBll);
        const audioBll = game.effect.getBusiness<BattleAudioBll>(BattleAudioBll);
        const hadCollisionShake = effects.hasCollisionShake || effects.screenHurtFlash > 0 || effects.wallFlashLife.size > 0;
        effectBll.updateCollisionShake(deltaTime);
        if (!model.steerActive && model.steerFade > 0) {
            model.steerFade = Math.max(0, model.steerFade - deltaTime * 3.8);
        }
        if (model.state === BattleState.Victory || model.state === BattleState.Defeat) {
            let stateChanged = false;
            if (effects.effects.length || effects.projectileHitParticles.length || effects.recoilLife.size || effects.hurtLife.size || effects.shakeLife || effects.slowLife || hadCollisionShake) {
                const wasSlowed = effects.slowLife > 0;
                effectBll.update(this.toBattleDelta(Math.min(deltaTime, rule.maxFrameTime)));
                game.combat.getBusiness<CombatBll>(CombatBll).refreshView();
                stateChanged = wasSlowed && !effects.slowLife;
            }
            if (model.victoryPanelDelay) {
                model.victoryPanelDelay = Math.max(0, model.victoryPanelDelay - deltaTime);
                stateChanged = stateChanged || model.victoryPanelDelay === 0;
            }
            if (stateChanged) {
                this.dispatchEvent(BattleEvent.UpdateState);
            }
            return;
        }
        if (effects.hitstopLife > 0) {
            effects.hitstopLife = Math.max(0, effects.hitstopLife - deltaTime);
            game.combat.getBusiness<CombatBll>(CombatBll).refreshView();
            return;
        }
        const manager = this.ent.game.enemy.getBusiness<EnemyBll>(EnemyBll);
        const width = model.combatWidth;
        const height = model.combatHeight;
        let remaining = Math.min(deltaTime, rule.maxFrameTime);
        while (remaining > 0 && (model.state === BattleState.Countdown || model.state === BattleState.Running)) {
            const frameStep = Math.min(remaining, rule.simulationStep);
            const delta = this.toBattleDelta(frameStep);
            this.ent.game.player.getBusiness<PlayerBll>(PlayerBll).updateMovement(delta, width, height);
            this.updateCamera(delta, width, height);
            if (model.state === BattleState.Countdown) {
                model.countdown = Math.max(0, model.countdown - delta);
                const nextCeil = Math.ceil(model.countdown);
                if (nextCeil > 0 && nextCeil !== model.lastCountdownCeil) {
                    model.lastCountdownCeil = nextCeil;
                    audioBll.play(BattleSound.Countdown);
                    this.dispatchEvent(BattleEvent.CountdownTick, nextCeil);
                }
                if (!model.countdown) {
                    model.state = BattleState.Running;
                    audioBll.play(BattleSound.BattleStart);
                    this.dispatchEvent(BattleEvent.CountdownFinished);
                }
            } else {
                model.battleDuration += delta;
                manager.update(delta, width, height);
                this.ent.game.combat.getBusiness<CombatBll>(CombatBll).update(delta, width, height);
                this.checkProgress();
            }
            remaining -= frameStep;
        }
        manager.refreshView();
        this.ent.game.combat.getBusiness<CombatBll>(CombatBll).refreshView();
        this.dispatchEvent(BattleEvent.UpdateState);
    }

    /** 按原版速度系数积分镜头位移，delta 为战斗步长，width、height 为逻辑战场尺寸。 */
    private updateCamera(delta: number, width: number, height: number) {
        const player = this.ent.game.player.PlayerModel;
        const head = player.players.find((unit) => {
            return unit.hp > 0;
        });
        if (!head) {
            return;
        }
        const model = this.ent.BattleModel;
        const horizontalWeight = Math.max(0, 1 - 2 * Math.abs(head.pose.x) / width);
        const verticalWeight = Math.max(0, 1 - 2 * Math.abs(head.pose.y) / height);
        model.cameraX += Math.cos(player.heading) * player.speed * 0.24 * horizontalWeight * delta;
        model.cameraY += Math.sin(player.heading) * player.speed * 0.08 * verticalWeight * delta;
    }

    /** 将现实时间 delta 换算成战斗时间，慢放到期的余量按正常速度推进。 */
    private toBattleDelta(delta: number) {
        const effects = this.ent.game.effect.EffectModel;
        const slowed = Math.min(delta, effects.slowLife);
        effects.slowLife -= slowed;
        return delta - slowed * (1 - bossSlowScale);
    }

    /** 检查全队阵亡、当前波清场和首领增援，仅在本场结束时切换终态。 */
    private checkProgress() {
        const model = this.ent.BattleModel;
        const enemies = this.ent.game.enemy.EnemyModel;
        const manager = this.ent.game.enemy.getBusiness<EnemyBll>(EnemyBll);
        const audioBll = this.ent.game.effect.getBusiness<BattleAudioBll>(BattleAudioBll);
        const alive = this.ent.game.player.PlayerModel.players.some((player) => {
            return player.hp > 0;
        });
        if (!alive) {
            model.state = BattleState.Defeat;
            model.steerActive = false;
            audioBll.play(BattleSound.Defeat);
            return;
        }
        if (enemies.stage.bossId) {
            if (!model.bossScheduled) {
                model.bossScheduled = true;
                manager.scheduleBoss();
                audioBll.play(BattleSound.BattleStart, 1.15);
                this.dispatchEvent(BattleEvent.WaveAnnounce, "首领降临", true);
                return;
            }
            if (enemies.pending.length) {
                return;
            }
            const bossAlive = enemies.enemies.some((enemy) => {
                return enemy.config.boss;
            });
            if (!bossAlive && !enemies.enemies.length) {
                model.state = BattleState.Victory;
                model.steerActive = false;
                audioBll.play(BattleSound.Victory);
            } else if (bossAlive && enemies.enemies.length === 1) {
                model.wave += 1;
                manager.scheduleWave(model.wave, model.combatWidth, model.combatHeight, true);
                this.dispatchEvent(BattleEvent.WaveAnnounce, `增援波次 ${model.wave}`, false);
            }
        } else if (!enemies.enemies.length && !enemies.pending.length) {
            if (model.wave >= enemies.stage.maxWaves) {
                model.state = BattleState.Victory;
                model.steerActive = false;
                audioBll.play(BattleSound.Victory);
            } else {
                model.wave += 1;
                manager.scheduleWave(model.wave, model.combatWidth, model.combatHeight);
                this.dispatchEvent(BattleEvent.WaveAnnounce, `第 ${model.wave}/${enemies.stage.maxWaves} 波`, false);
            }
        }
    }

    /** 处理结果界面的返回，胜利仅发放一次真实奖励，失败返回商店不改变关卡和金币。 */
    returnAfterResult() {
        const model = this.ent.BattleModel;
        if (model.settled || this.ent.game.GameModel.transitioning) {
            return;
        }
        if (model.state === BattleState.Victory && model.victoryPanelDelay === 0 && !this.ent.game.effect.EffectModel.slowLife) {
            model.settled = true;
            this.ent.game.finishBattle(this.ent.game.enemy.EnemyModel.pickedUpGold);
        } else if (model.state === BattleState.Defeat) {
            model.settled = true;
            this.ent.game.returnShop();
        }
    }
}

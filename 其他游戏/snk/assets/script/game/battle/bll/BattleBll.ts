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
import { bossSlowScale } from "../../effect/EffectEvent";

export class BattleBll extends CCBusiness<Battle> {
    /** 将商店 team 交给 Player 模块建立战场快照，并请求打开战场。 */
    prepareBattle(team: IPlayerUnit[], openView: boolean = true) {
        if (!team.length) {
            this.toast("shop_team_empty");
            return;
        }
        this.ent.game.combat.getBusiness<CombatBll>(CombatBll).reset();
        this.ent.game.player.getBusiness<PlayerBll>(PlayerBll).prepare(team);
        this.ent.BattleModel.reset();
        const shop = this.ent.game.shop.ShopModel;
        const model = this.ent.BattleModel;
        model.level = shop.battleLevel;
        model.countdown = TableBattleRule.getCurrent().countdown;
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

    /** 战斗阶段根据局部触摸坐标 x、y 请求角色转向。 */
    steer(x: number, y: number) {
        if (this.ent.game.GameModel.transitioning || this.ent.game.GameModel.phase !== GamePhase.Battle || this.ent.BattleModel.state === BattleState.Victory || this.ent.BattleModel.state === BattleState.Defeat) {
            return;
        }
        this.ent.game.player.getBusiness<PlayerBll>(PlayerBll).steer(x, y);
    }

    /** 在战斗阶段推进 deltaTime 秒的玩家、敌人、刷怪和结算流程。 */
    updateMovement(deltaTime: number) {
        const model = this.ent.BattleModel;
        if (this.ent.game.GameModel.transitioning || this.ent.game.GameModel.phase !== GamePhase.Battle || !model.arenaWidth || !model.arenaHeight) {
            return;
        }
        const rule = TableBattleRule.getCurrent();
        if (model.state === BattleState.Victory || model.state === BattleState.Defeat) {
            const game = this.ent.game;
            const effects = game.effect.EffectModel;
            if (effects.effects.length || effects.projectileHitParticles.length || effects.recoilLife.size || effects.hurtLife.size || effects.shakeLife || effects.slowLife) {
                const wasSlowed = effects.slowLife > 0;
                game.effect.getBusiness<EffectBll>(EffectBll).update(this.toBattleDelta(Math.min(deltaTime, rule.maxFrameTime)));
                game.combat.getBusiness<CombatBll>(CombatBll).refreshView();
                if (wasSlowed && !effects.slowLife) {
                    this.dispatchEvent(BattleEvent.UpdateState);
                }
            }
            if (model.state === BattleState.Victory) {
                model.resultTime += deltaTime;
                if (model.resultTime >= rule.resultDelay) {
                    this.returnAfterResult();
                }
            }
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
            if (model.state === BattleState.Countdown) {
                model.countdown = Math.max(0, model.countdown - delta);
                if (!model.countdown) {
                    model.state = BattleState.Running;
                }
            } else {
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
        const alive = this.ent.game.player.PlayerModel.players.some((player) => {
            return player.hp > 0;
        });
        if (!alive) {
            model.state = BattleState.Defeat;
            return;
        }
        if (enemies.stage.bossId) {
            if (!model.bossScheduled) {
                model.bossScheduled = true;
                manager.scheduleBoss();
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
            } else if (bossAlive && enemies.enemies.length === 1) {
                model.wave += 1;
                manager.scheduleWave(model.wave, model.combatWidth, model.combatHeight, true);
            }
        } else if (!enemies.enemies.length && !enemies.pending.length) {
            if (model.wave >= enemies.stage.maxWaves) {
                model.state = BattleState.Victory;
            } else {
                model.wave += 1;
                manager.scheduleWave(model.wave, model.combatWidth, model.combatHeight);
            }
        }
    }

    /** 处理结果界面的返回，胜利仅发放一次真实奖励，失败返回商店不改变关卡和金币。 */
    returnAfterResult() {
        const model = this.ent.BattleModel;
        if (model.settled || this.ent.game.GameModel.transitioning) {
            return;
        }
        if (model.state === BattleState.Victory) {
            model.settled = true;
            this.ent.game.finishBattle(this.ent.game.enemy.EnemyModel.pickedUpGold);
        } else if (model.state === BattleState.Defeat) {
            model.settled = true;
            this.ent.game.returnShop();
        }
    }
}

import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import { coinSounds, GameAudio } from "../../common/GameAudio";
import { EnemyKeyEnum } from "../../common/table/EnemyKeyEnum";
import { RoleKeyEnum } from "../../common/table/RoleKeyEnum";
import type { Effect } from "../Effect";
import { BattleSound } from "../EffectEvent";

const arrows = new Set<number>([RoleKeyEnum.Archer, RoleKeyEnum.Hunter, RoleKeyEnum.Barrager, RoleKeyEnum.Corruptor]);
const knives = new Set<number>([
    RoleKeyEnum.Scout, RoleKeyEnum.Outlaw, RoleKeyEnum.Blade, RoleKeyEnum.Spellblade,
    RoleKeyEnum.Jester, RoleKeyEnum.Assassin, RoleKeyEnum.Beastmaster, RoleKeyEnum.Thief,
]);
const magic = new Set<number>([RoleKeyEnum.Wizard, RoleKeyEnum.Lich, RoleKeyEnum.Arcanist]);
const mechanical = new Set<number>([RoleKeyEnum.Engineer, RoleKeyEnum.DualGunner, RoleKeyEnum.Miner]);
const melee = new Set<number>([RoleKeyEnum.Swordsman, RoleKeyEnum.Barbarian, RoleKeyEnum.Juggernaut, RoleKeyEnum.Highlander]);
const heavyHit = "Body Head (Headshot) 1";
const magicHit = "Fire bolt 10";
const fists = ["Bloody punches 7", "Bloody punches 10"];
const playerHits = ["Body Fall 2", "Body Fall 18"];
const explosions = ["Explosion Flesh_01", "Explosion Flesh_02"];

export class BattleAudioBll extends CCBusiness<Effect> {
    /** 播放拾取、倒计时、暴击等独立战斗事件 sound，保留原版采样池及叠音。 */
    play(sound: BattleSound) {
        switch (sound) {
            case BattleSound.Crit:
                GameAudio.playEffect("Dagger Stab (Flesh) 4");
                GameAudio.playEffect("Sword hits another sword 6", 0.15);
                break;
            case BattleSound.Chain:
                GameAudio.playEffect(["Spark 1", "Spark 2", "Spark 3"], 0.3, 0.9, 1.1);
                break;
            case BattleSound.Spawn:
                GameAudio.playEffect("Buff 13", 0.15, 0.8, 1.2);
                break;
            case BattleSound.PlayerHurt:
                GameAudio.playEffect(playerHits);
                break;
            case BattleSound.Gold:
                GameAudio.playEffect(["Coins - Gears - Slot", ...coinSounds], 0.3, 0.9, 1.1);
                break;
            case BattleSound.GoldDrop:
                GameAudio.playEffect("Collect 5");
                break;
            case BattleSound.HealPickup:
                GameAudio.playEffect("Collect 2", 1);
                GameAudio.playEffect("Buff 3");
                break;
            case BattleSound.Heal:
                GameAudio.playEffect("Buff 3");
                break;
            case BattleSound.Countdown:
                GameAudio.playEffect("Click", 0.5, 1, 1);
                break;
            case BattleSound.BattleStart:
                GameAudio.playEffect("Click", 0.5, 1.2, 1.2);
                break;
            case BattleSound.Thunder:
                GameAudio.playEffect("399656__bajko__sfx-thunder-blast");
                break;
        }
    }

    /** 根据角色 roleId 选择发射采样，generic 表示角色生成的次级弹丸。 */
    playShot(roleId: number, generic: boolean = false) {
        if (generic) {
            if (roleId === RoleKeyEnum.Arcanist) {
                GameAudio.playEffect("Magical Impact 12", 0.15, 0.7, 1.3);
            }
        } else if (arrows.has(roleId) || roleId === RoleKeyEnum.Sentry) {
            GameAudio.playEffect("Releasing Bow String 1", 0.35);
        } else if (knives.has(roleId)) {
            GameAudio.playEffect(["Throwing Knife (Thrown) 3", "Throwing Knife (Thrown) 4"], 0.35);
            if (roleId === RoleKeyEnum.Spellblade) {
                GameAudio.playEffect("Wind Bolt 20", 0.15);
            }
        } else if (magic.has(roleId)) {
            GameAudio.playEffect("Wind Bolt 20", 0.15);
        } else if (roleId === RoleKeyEnum.Cannoneer) {
            GameAudio.playEffect(["Cannon shots 1", "Cannon shots 7"]);
        } else if (roleId === RoleKeyEnum.DualGunner) {
            GameAudio.playEffect("Revolver Shot_07", 0.3);
            GameAudio.playEffect("Revolver Shot_08", 0.3);
        } else if (roleId === RoleKeyEnum.Engineer) {
            GameAudio.playEffect("Sci Fi Machine Gun 7", 0.35);
            GameAudio.playEffect("Sniper Shot_09", 0.35);
        } else if (roleId === RoleKeyEnum.Illusionist) {
            GameAudio.playEffect("Sci Fi Machine Gun 7", 0.1);
            GameAudio.playEffect("Sniper Shot_09", 0.1);
            GameAudio.playEffect("Wind Bolt 20", 0.1);
        } else if (roleId === RoleKeyEnum.Vagrant || roleId === RoleKeyEnum.Artificer) {
            GameAudio.playEffect("Shooting Projectile (Classic) 11", 0.2);
        }
    }

    /** 根据 roleId、arrow 和 generic 区分弹丸命中敌人的反馈。 */
    playProjectileHit(roleId: number, arrow: boolean, generic: boolean) {
        if (generic && roleId === RoleKeyEnum.Arcanist) {
            GameAudio.playEffect(magicHit, 0.075);
        } else if (!generic && magic.has(roleId)) {
            GameAudio.playEffect(magicHit, 0.15);
        } else if (arrow || arrows.has(roleId) || knives.has(roleId) || mechanical.has(roleId)
            || roleId === RoleKeyEnum.Witch || roleId === RoleKeyEnum.Sentry) {
            GameAudio.playEffect(heavyHit, 0.35);
            if (roleId === RoleKeyEnum.Spellblade) {
                GameAudio.playEffect(magicHit, 0.15);
            }
        } else {
            GameAudio.playEffect("Kick 16_1", 0.35);
        }
    }

    /** 根据 roleId 和弹丸 arrow 标记选择擦墙、撞墙或魔法碎裂反馈。 */
    playProjectileWall(roleId: number, arrow: boolean) {
        if (arrow || arrows.has(roleId) || roleId === RoleKeyEnum.Sentry) {
            GameAudio.playEffect(["Arrow Impact wood 3", "Arrow Impact wood 1"], 0.2, 0.9, 1.1);
        } else if (knives.has(roleId) || roleId === RoleKeyEnum.Witch) {
            GameAudio.playEffect("Shield Impacts Sword 1", 0.2, 0.9, 1.1);
            if (roleId === RoleKeyEnum.Spellblade) {
                GameAudio.playEffect(magicHit, 0.075);
            }
        } else if (magic.has(roleId)) {
            GameAudio.playEffect(magicHit, 0.075);
        } else if (roleId === RoleKeyEnum.Cannoneer) {
            GameAudio.playEffect("Cannon impact sounds (Hitting ship) 4", 0.1);
        } else if (mechanical.has(roleId)) {
            GameAudio.playEffect(["Concrete 6", "Concrete 7"], 0.2, 0.9, 1.1);
        } else {
            GameAudio.playEffect("Player Takes Damage 2", 0.2, 0.9, 1.1);
        }
    }

    /** 按蛇头至队尾的顺序 rank 播放撞墙木击和弹响，rate 为本次撞墙共享的音高。 */
    playPlayerWall(rank: number, rate: number) {
        GameAudio.playEffect("Wood Heavy 5", 0.1, rate + rank * 0.025, rate + rank * 0.025);
        GameAudio.playEffect("Pop sounds 10", 0.2, rate + rank * 0.05, rate + rank * 0.05);
    }

    /** 根据角色 roleId 播放范围攻击出手声，和命中音分开触发。 */
    playAreaCast(roleId: number) {
        if (melee.has(roleId)) {
            GameAudio.playEffect(["Heavy sword woosh 1", "Heavy sword woosh 19"], 0.75, 0.9, 1.1);
        }
        if (roleId === RoleKeyEnum.Elementor || roleId === RoleKeyEnum.Juggernaut) {
            GameAudio.playEffect("Wind Bolt 18", 0.5, 0.9, 1.1);
        } else if (roleId === RoleKeyEnum.Psychic) {
            GameAudio.playEffect("Magical Impact 13", 0.4, 0.9, 1.1);
        } else if (roleId === RoleKeyEnum.Launcher) {
            GameAudio.playEffect("Buff 14", 0.5, 0.9, 1.1);
        }
    }

    /** 根据攻击角色 roleId 和持续伤害标记 dot 选择范围命中的采样。 */
    playAreaHit(roleId: number, dot: boolean) {
        if (dot) {
            GameAudio.playEffect(heavyHit, 0.2, 0.8, 1.2);
            if (roleId === RoleKeyEnum.Pyromancer) {
                GameAudio.playEffect("Fire bolt 5", 0.1, 1.5, 1.8);
            }
        } else if (roleId === RoleKeyEnum.Wizard || roleId === RoleKeyEnum.Magician || roleId === RoleKeyEnum.Elementor || roleId === RoleKeyEnum.Psychic) {
            GameAudio.playEffect("Shadow Punch 1");
        } else if (melee.has(roleId)) {
            GameAudio.playEffect(heavyHit, 0.35);
        } else if (roleId === RoleKeyEnum.Blade) {
            GameAudio.playEffect("Sword impact (Flesh) 2", 0.35, 0.9, 1.1);
            GameAudio.playEffect(heavyHit, 0.2);
        } else if (roleId === RoleKeyEnum.Cannoneer) {
            GameAudio.playEffect(explosions, 0.075);
        } else if (roleId === RoleKeyEnum.Saboteur || roleId === RoleKeyEnum.Bomber || roleId === RoleKeyEnum.Pyromancer) {
            if (roleId === RoleKeyEnum.Pyromancer) {
                GameAudio.playEffect("Explosion Fireworks_01", 0.4);
            }
            GameAudio.playEffect(explosions, 0.2);
        }
    }

    /** 为敌人 configId 播放死亡采样，boss 标记追加首领专用的魔法冲击。 */
    playEnemyDeath(configId: number, boss: boolean) {
        GameAudio.playEffect(fists, 0.5, 0.9, 1.1);
        if (boss) {
            GameAudio.playEffect("Magical Impact 27");
        } else if (configId === EnemyKeyEnum.Critter) {
            GameAudio.playEffect("Crickets Chirping 4", 0.2);
        }
    }
}

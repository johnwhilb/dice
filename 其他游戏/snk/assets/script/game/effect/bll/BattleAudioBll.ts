import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import { oops } from "db://oops-framework/core/Oops";
import type { Effect } from "../Effect";
import { BattleSound } from "../EffectEvent";
import { ResPath } from "../../common/config/ResPath";
import { RoleKeyEnum } from "../../common/table/RoleKeyEnum";

const soundCooldowns = new Map<BattleSound, number>([
    [BattleSound.Shoot, 55],
    [BattleSound.Knife, 55],
    [BattleSound.Arrow, 55],
    [BattleSound.Cannon, 85],
    [BattleSound.Magic, 65],
    [BattleSound.Hit, 45],
    [BattleSound.Crit, 65],
    [BattleSound.Area, 75],
    [BattleSound.Chain, 70],
    [BattleSound.EnemyDeath, 55],
    [BattleSound.BossDeath, 200],
    [BattleSound.Spawn, 90],
    [BattleSound.WallHit, 80],
    [BattleSound.PlayerHurt, 95],
    [BattleSound.PlayerDeath, 150],
    [BattleSound.Shield, 90],
    [BattleSound.Gold, 40],
    [BattleSound.Heal, 65],
    [BattleSound.Countdown, 150],
    [BattleSound.BattleStart, 200],
    [BattleSound.Victory, 300],
    [BattleSound.Defeat, 300],
]);

const soundVolumes = new Map<BattleSound, number>([
    [BattleSound.Shoot, 0.34],
    [BattleSound.Knife, 0.38],
    [BattleSound.Arrow, 0.38],
    [BattleSound.Cannon, 0.56],
    [BattleSound.Magic, 0.4],
    [BattleSound.Hit, 0.28],
    [BattleSound.Crit, 0.62],
    [BattleSound.Area, 0.48],
    [BattleSound.Chain, 0.42],
    [BattleSound.EnemyDeath, 0.42],
    [BattleSound.BossDeath, 0.82],
    [BattleSound.Spawn, 0.26],
    [BattleSound.WallHit, 0.42],
    [BattleSound.PlayerHurt, 0.64],
    [BattleSound.PlayerDeath, 0.72],
    [BattleSound.Shield, 0.52],
    [BattleSound.Gold, 0.46],
    [BattleSound.Heal, 0.52],
    [BattleSound.Countdown, 0.5],
    [BattleSound.BattleStart, 0.6],
    [BattleSound.Victory, 0.72],
    [BattleSound.Defeat, 0.68],
]);

const arrowAudioRoles = new Set<number>([
    RoleKeyEnum.Archer,
    RoleKeyEnum.Hunter,
    RoleKeyEnum.Barrager,
    RoleKeyEnum.Sentry,
]);

const knifeAudioRoles = new Set<number>([
    RoleKeyEnum.Scout,
    RoleKeyEnum.Outlaw,
    RoleKeyEnum.Blade,
    RoleKeyEnum.Spellblade,
    RoleKeyEnum.Jester,
    RoleKeyEnum.Beastmaster,
    RoleKeyEnum.Thief,
]);

const cannonAudioRoles = new Set<number>([
    RoleKeyEnum.Cannoneer,
    RoleKeyEnum.Wizard,
]);

const magicAudioRoles = new Set<number>([
    RoleKeyEnum.Arcanist,
    RoleKeyEnum.Lich,
    RoleKeyEnum.Sage,
    RoleKeyEnum.Witch,
]);

export class BattleAudioBll extends CCBusiness<Effect> {
    private lastPlayedAt = new Map<BattleSound, number>();

    /** 按节流冷却播放指定战斗音效 sound，volumeScale 用于按强度微调音量。 */
    play(sound: BattleSound, volumeScale: number = 1) {
        if (!oops.audio.effect.getSwitch()) {
            return;
        }
        const now = Date.now();
        const cooldown = soundCooldowns.get(sound) ?? 50;
        const last = this.lastPlayedAt.get(sound) ?? 0;
        if (now - last < cooldown) {
            return;
        }
        this.lastPlayedAt.set(sound, now);
        const baseVolume = soundVolumes.get(sound) ?? 0.5;
        const masterVolume = oops.audio.effect.getVolume();
        const volume = Math.max(0, Math.min(1, baseVolume * volumeScale * masterVolume));
        oops.audio.playEffect(ResPath.getBattleAudio(sound), { bundle: "bundle", volume });
    }

    /** 根据发射角色 roleId 自动匹配对应的弹丸发射音效并播放。 */
    playShot(roleId: number) {
        if (cannonAudioRoles.has(roleId)) {
            this.play(BattleSound.Cannon);
        } else if (arrowAudioRoles.has(roleId)) {
            this.play(BattleSound.Arrow);
        } else if (knifeAudioRoles.has(roleId)) {
            this.play(BattleSound.Knife);
        } else if (magicAudioRoles.has(roleId)) {
            this.play(BattleSound.Magic);
        } else {
            this.play(BattleSound.Shoot);
        }
    }

    /** 清空各音效的节流时间戳，在新一场战斗开始时调用。 */
    resetCooldowns() {
        this.lastPlayedAt.clear();
    }
}

import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import { oops } from "db://oops-framework/core/Oops";
import type { Shop } from "../Shop";
import { ShopSound } from "../ShopEvent";
import { ResPath } from "../../common/config/ResPath";

const shopSoundVolumes = new Map<ShopSound, number>([
    [ShopSound.Buy, 0.56],
    [ShopSound.Sell, 0.56],
    [ShopSound.Upgrade, 0.68],
    [ShopSound.MaxUpgrade, 0.78],
    [ShopSound.Refresh, 0.52],
    [ShopSound.Lock, 0.54],
    [ShopSound.Swap, 0.45],
    [ShopSound.Click, 0.42],
    [ShopSound.Synergy, 0.62],
    [ShopSound.StartBattle, 0.62],
    [ShopSound.Error, 0.58],
]);

export class ShopAudioBll extends CCBusiness<Shop> {
    private lastPlayedAt = new Map<ShopSound, number>();

    /** 播放商店音效 sound，带轻度节流避免连点破音，遵循框架全局音效开关与音量。 */
    play(sound: ShopSound, volumeScale: number = 1) {
        if (!oops.audio.effect.getSwitch()) {
            return;
        }
        const now = Date.now();
        const last = this.lastPlayedAt.get(sound) ?? 0;
        if (now - last < 45) {
            return;
        }
        this.lastPlayedAt.set(sound, now);
        const baseVolume = shopSoundVolumes.get(sound) ?? 0.5;
        const masterVolume = oops.audio.effect.getVolume();
        const volume = Math.max(0, Math.min(1, baseVolume * volumeScale * masterVolume));
        oops.audio.playEffect(ResPath.getShopAudio(sound), { bundle: "bundle", volume });
    }
}

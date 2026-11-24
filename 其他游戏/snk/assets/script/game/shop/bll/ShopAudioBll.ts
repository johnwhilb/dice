import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import type { Shop } from "../Shop";
import { ShopSound } from "../ShopEvent";
import { coinSounds, GameAudio, switchAltSound, switchSound } from "../../common/GameAudio";

export class ShopAudioBll extends CCBusiness<Shop> {
    /** 根据操作 sound 播放商店反馈，购买和道具升级可同时播放多层音效。 */
    play(sound: ShopSound) {
        switch (sound) {
            case ShopSound.Buy:
                GameAudio.playEffect(switchSound);
                GameAudio.playEffect(coinSounds);
                break;
            case ShopSound.Sell:
                GameAudio.playEffect(coinSounds);
                break;
            case ShopSound.Refresh:
            case ShopSound.Lock:
            case ShopSound.Experience:
                GameAudio.playEffect(switchAltSound);
                break;
            case ShopSound.Upgrade:
                GameAudio.playEffect("Bonus 2", 0.6, 1, 1);
                break;
            case ShopSound.MaxUpgrade:
                GameAudio.playEffect("Bonus 2", 0.6, 1.2, 1.2);
                GameAudio.playEffect("Buff 4", 0.5, 1, 1);
                break;
            case ShopSound.StartBattle:
                GameAudio.playTransition(true);
                break;
            case ShopSound.Error:
                GameAudio.playEffect("Error 2");
                break;
        }
    }
}

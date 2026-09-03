import { EnumEvent } from '../../common/table/EnumEvent';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { smc } from '../../common/SingletonModuleComp';

export class BattlePlayerBll extends CCBusiness<Battle> {

    initPlayer() {
        this.ent.BattlePlayerModel.handCards = smc.player.PlayerModel.handCard
        this.ent.BattlePlayerModel.hp = smc.player.PlayerModel.hp
        this.ent.BattlePlayerModel.maxHp = smc.player.PlayerModel.maxHp
    }

}
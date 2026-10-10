import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { smc } from '../../common/SingletonModuleComp';
import { TableRole } from '../../common/table/TableRole';
export class BattlePlayerBll extends CCBusiness<Battle> {
    // 初始化玩家战斗属性与牌组。
    initPlayer(): void {
        const player = this.ent.BattlePlayerModel;
        player.reset();
        player.playerId = smc.player.getSelectedRoleId();
        const role = TableRole.getConfigById(player.playerId)!;
        player.hp = smc.player.PlayerModel.hp;
        player.maxHp = smc.player.PlayerModel.maxHp;
        player.maxEnergy = role.originEnergy;
        this.ent.BattleCardBll.initializeDeck(smc.player.PlayerModel.handCard);
    }
}

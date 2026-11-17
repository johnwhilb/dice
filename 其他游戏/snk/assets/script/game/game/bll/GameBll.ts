import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import { BattleEvent } from "../../battle/BattleEvent";
import { ShopEvent } from "../../shop/ShopEvent";
import type { Game } from "../Game";
import { GamePhase } from "../model/GameModel";

export class GameBll extends CCBusiness<Game> {
    /** 注册新局、读档、结算与战斗队伍准备完成后的流程事件。 */
    protected init() {
        this.on(ShopEvent.OpenShop, this.ent.showShop, this.ent);
        this.on(ShopEvent.RoundCompleted, this.ent.returnShop, this.ent);
        this.on(BattleEvent.OpenBattle, this.ent.showBattle, this.ent);
    }

    /** 界面加载成功后切换本局阶段，参数 phase 为商店或战斗。 */
    setPhase(phase: GamePhase) {
        this.ent.GameModel.phase = phase;
    }
}

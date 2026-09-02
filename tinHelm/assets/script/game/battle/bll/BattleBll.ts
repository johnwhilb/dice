import { EnumEvent } from '../../common/table/EnumEvent';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattlePhase } from '../model/BattleModel';

export class BattleBll extends CCBusiness<Battle> {

    changePhase() {
        switch (this.ent.BattleModel.phase) {
            case BattlePhase.Start:
                this.ent.BattleModel.phase = BattlePhase.PlayerStart;
                break;
            case BattlePhase.PlayerStart:
                this.ent.BattleModel.phase = BattlePhase.PlayerRollDice;
                break;
            case BattlePhase.PlayerRollDice:
                this.ent.BattleModel.phase = BattlePhase.PlayerAction;
                break;
            case BattlePhase.PlayerAction:
                this.ent.BattleModel.phase = BattlePhase.PlayerEnd;
                break;
            case BattlePhase.PlayerEnd:
                this.ent.BattleModel.phase = BattlePhase.EnemyStart;
                break;
            case BattlePhase.EnemyStart:
                this.ent.BattleModel.phase = BattlePhase.EnemyAction;
                break;
            case BattlePhase.EnemyAction:
                this.ent.BattleModel.phase = BattlePhase.EnemyEnd;
                break;
            case BattlePhase.EnemyEnd:
                this.ent.BattleModel.phase = BattlePhase.CheckResult;
                break;
            case BattlePhase.CheckResult:
                break;
            case BattlePhase.Victory:
                break;
            case BattlePhase.Defeat:
                break;
            default:
                break;
        }

    }


}
import { _decorator, Color, Component, Event, Label, Node, UITransform } from 'cc';
import { smc } from '../common/SingletonModuleComp';
const { ccclass } = _decorator;

@ccclass('nodeDice')
export class nodeDice extends Component {
    private index = 0;
    private value = -1;

    start() {
        const usedMask = this.node.getChildByName('usedMask')!;
        const hint = new Node('activationHint');
        hint.layer = usedMask.layer;
        usedMask.addChild(hint);
        hint.addComponent(UITransform).setContentSize(110, 40);
        const label = hint.addComponent(Label);
        label.string = '点选激活';
        label.fontSize = 22;
        label.color = Color.WHITE;
        label.overflow = Label.Overflow.SHRINK;
        usedMask.on(Node.EventType.TOUCH_START, this.stopUsedMaskTouch, this);
        usedMask.on(Node.EventType.TOUCH_END, this.stopUsedMaskTouch, this);
    }

    setIndex(index: number) {
        this.index = index;
    }

    setValue(value: number) {
        if (this.value === value) {
            return false;
        }
        this.value = value;
        this.node.getChildByName('lbtNum')!.getComponent(Label)!.string = String(value);
        return true;
    }

    onBtnClick() {
        if (smc.battle.BattlePlayerModel.diceUsed.includes(this.index)) {
            return;
        }
        this.toggleLock();
    }

    private toggleLock() {
        if (smc.battle.BattlePlayerModel.diceLocked.includes(this.index)) {
            smc.battle.BattleDiceBll.unlockDice(this.index);
        }
        else {
            smc.battle.BattleDiceBll.lockDice(this.index);
        }
    }

    private stopUsedMaskTouch(event: Event) {
        event.propagationStopped = true;
    }

    onUsedMaskClick(event: Event) {
        event.propagationStopped = true;
        this.toggleLock();
    }
}

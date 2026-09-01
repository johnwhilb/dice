import { Sprite, _decorator } from 'cc';
import { GameComponent } from 'db://oops-framework/module/common/GameComponent';
import { TableCard } from '../common/table/TableCard';
import { Label } from 'cc';

const { ccclass } = _decorator;

@ccclass('nodeCard')
export class nodeCard extends GameComponent {

    onLoad() {
        this.nodeTreeInfoLite();
        this.setButton();
    }

    setData(tableCard: TableCard) {
        this.getNode("lbtName")!.getComponent(Label)!.string = tableCard.name;
    }

}

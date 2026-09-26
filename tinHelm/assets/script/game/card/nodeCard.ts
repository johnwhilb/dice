import { Sprite, _decorator } from 'cc';
import { GameComponent } from 'db://oops-framework/module/common/GameComponent';
import { TableCard } from '../common/table/TableCard';
import { Label } from 'cc';
import { Prefab } from 'cc';
import { instantiate } from 'cc';
import { ResPath } from '../common/config/ResPath';

const { ccclass, property } = _decorator;

@ccclass('nodeCard')
export class nodeCard extends GameComponent {

    @property(Prefab)
    diceIcon: Prefab = null!;

    onLoad() {
        this.nodeTreeInfoLite();
        this.setButton();
    }
    setData(tableCard: TableCard) {
        this.getNode("lbtName")!.getComponent(Label)!.string = tableCard.name;
        this.getNode("lbtDes")!.getComponent(Label)!.string = tableCard.des;
        const iconNeed = tableCard.DiceNeed
        const nodeIconNeed = this.getNode("nodeIconNeed")!;
        for (let i = 0; i < Math.max(iconNeed.length, nodeIconNeed.children.length); i++) {
            if (i >= iconNeed.length) {
                continue;
            }
            let node = nodeIconNeed.children[i];
            if (!node) {
                node = instantiate(this.diceIcon);
                node.parent = nodeIconNeed;
            }
            const spIcon = node.getChildByName("face")!.getChildByName("spIcon")!.getComponent(Sprite);
            this.setSprite(spIcon, ResPath.getSpriteDice(iconNeed[i]));
        }
    }

    onBtnClick() {

    }

}
function instansiate(diceIcon: Prefab) {
    throw new Error('Function not implemented.');
}


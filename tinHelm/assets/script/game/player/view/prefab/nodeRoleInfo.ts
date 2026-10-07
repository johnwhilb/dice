import { Label, _decorator } from 'cc';
import { GameComponent } from 'db://oops-framework/module/common/GameComponent';
import { smc } from '../../../common/SingletonModuleComp';
import { PlayerEvent } from '../../PlayerEvent';
import { RouteSelectEvent } from '../../../routeSelect/RouteSelectEvent';

const { ccclass } = _decorator;

@ccclass('nodeRoleInfo')
export class NodeRoleInfo extends GameComponent {
    onLoad() {
        this.nodeTreeInfoLite();
    }

    onEnable() {
        this.on(PlayerEvent.statsChanged, this.refresh, this);
        this.on(RouteSelectEvent.anchorCountChanged, this.refresh, this);
        this.refresh();
    }

    onDisable() {
        this.off(PlayerEvent.statsChanged, this.refresh, this);
        this.off(RouteSelectEvent.anchorCountChanged, this.refresh, this);
    }

    refresh() {
        const player = smc.player?.PlayerModel;
        const route = smc.routeSelect?.RouteSelectModel;
        const hp = player?.hp ?? 0;
        const maxHp = player?.maxHp ?? 0;
        const gold = player?.gold ?? 0;
        const anchorCount = route?.anchorCount ?? 0;

        this.getNode('lbtCurrentHp')!.getComponent(Label)!.string = `当前血量：${hp}/${maxHp}`;
        this.getNode('lbtCurrentGold')!.getComponent(Label)!.string = `当前金币：${gold}`;
        this.getNode('lbtCurrentBranch')!.getComponent(Label)!.string = `枝桠数量：${anchorCount}`;
    }
}

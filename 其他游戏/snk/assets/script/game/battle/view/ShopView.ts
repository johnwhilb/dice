import { _decorator, Button, Label } from 'cc';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { oops } from 'db://oops-framework/core/Oops';
import type { Battle } from '../Battle';
import { BattleBll } from '../bll/BattleBll';
import { TableRole } from '../../common/table/TableRole';
import { TableShopRule } from '../../common/table/TableShopRule';
import { lang } from '../../common/Language';

const { ccclass } = _decorator;

@ccclass('ShopView')
@ecs.register('ShopView', false)
@gui.register('ShopView', { layer: LayerType.UI, prefab: 'gui/shop/ui/ShopView' })
export class ShopView extends CCView<Battle> {
    start() {
        this.nodeTreeInfoLite();
        this.setButton(false);
        const rule = TableShopRule.getInitial()!;
        Array.from({ length: rule.cardSlots }, (value, index) => {
            this.getNode(`btnBuy${index}`)!.on(Button.EventType.CLICK, () => {
                this.showResult(this.ent.getBusiness<BattleBll>(BattleBll).buy(index));
            }, this);
        });
        Array.from({ length: rule.baseTeamSize }, (value, index) => {
            this.getNode(`btnSell${index}`)!.on(Button.EventType.CLICK, () => {
                this.showResult(this.ent.getBusiness<BattleBll>(BattleBll).sell(index));
            }, this);
        });
        this.refresh();
    }

    private showResult(message: string) {
        if (message) {
            oops.gui.toast(lang(message));
        }
        this.refresh();
    }

    refresh() {
        const model = this.ent.BattleModel;
        const rule = TableShopRule.getInitial()!;
        this.getNode('goldLabel')!.getComponent(Label)!.string = `${lang('shop_gold')} ${model.gold}`;
        this.getNode('teamTitle')!.getComponent(Label)!.string = `${lang('shop_team')} ${model.team.length}/${rule.baseTeamSize}`;
        this.getNode('btnRefresh')!.getComponent(Label)!.string = `${lang('shop_refresh')} · ${rule.refreshCost}`;
        this.getNode('mergeHint')!.getComponent(Label)!.string = `${lang('shop_merge_hint')} ${rule.copiesPerUpgrade} / ${rule.copiesPerUpgrade * rule.copiesPerUpgrade}\n${lang('shop_reserve_hint')}`;
        model.offers.forEach((id, index) => {
            const role = TableRole.getConfigById<TableRole>(id);
            const label = this.getNode(`cardLabel${index}`)!.getComponent(Label)!;
            label.string = role ? `${role.name}\n${role.getClasses().map((item) => {
                return item.name;
            }).join(' / ')}\n${lang('shop_price')} ${role.price}` : lang('shop_sold');
            this.getNode(`btnBuy${index}`)!.getComponent(Button)!.interactable = !!role;
        });
        Array.from({ length: rule.baseTeamSize }, (value, index) => {
            const unit = model.team[index];
            const role = TableRole.getConfigById(unit?.roleId || 0);
            this.getNode(`teamLabel${index}`)!.getComponent(Label)!.string = unit && role
                ? `${index + 1}. ${role.name}   Lv.${unit.level}   ×${unit.copies}   ${lang('shop_sale')} ${this.ent.getBusiness<BattleBll>(BattleBll).getSalePrice(index)}`
                : `${index + 1}. ${lang('shop_empty_slot')}`;
            this.getNode(`btnSell${index}`)!.active = !!unit;
        });
        this.getNode('btnBattle')!.getComponent(Button)!.interactable = model.team.length > 0;
    }

    btnRefresh() {
        this.showResult(this.ent.getBusiness<BattleBll>(BattleBll).refreshOffers());
    }

    btnBattle() {
        this.ent.openArena();
    }

    btnMenu() {
        this.ent.returnMenu();
    }

    reset() {
    }
}

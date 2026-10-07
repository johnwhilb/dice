import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Player } from '../Player';
import { PlayerEvent } from '../PlayerEvent';
import { TableRole } from '../../common/table/TableRole';
import { TableItem } from '../../common/table/TableItem';
import { TableEquipment } from '../../common/table/TableEquipment';
import { TableGameResource } from '../../common/table/TableGameResource';
import { GameResourceItemEnum } from '../../common/table/GameResourceItemEnum';
import { TableUniversal } from '../../common/table/TableUniversal';
import { UniversalNameEnum } from '../../common/table/UniversalNameEnum';

export class PlayerBll extends CCBusiness<Player> {

    selectRole(roleId: number) {
        if (!TableRole.isOwnId(roleId) || !TableRole.getConfigById(roleId)) {
            return;
        }

        this.ent.PlayerModel.roleId = roleId;
        this.dispatchEvent(PlayerEvent.currentSelectedRoleIdChanged, roleId);
    }

    initPlayer() {
        const playerInfo= TableRole.getConfigById(this.ent.PlayerModel.roleId);
        this.ent.PlayerModel.equipmentIds = [];
        this.ent.PlayerModel.hp = playerInfo!.originHp;
        this.ent.PlayerModel.maxHp = playerInfo!.maxHp;
        this.ent.PlayerModel.handCard = [...playerInfo!.originCards];
        this.dispatchEvent(PlayerEvent.statsChanged);
    }

    addEquipment(equipmentId: number) {
        const equipment = TableEquipment.getConfigById(equipmentId);
        if (!equipment) {
            return false;
        }
        const model = this.ent.PlayerModel;
        model.equipmentIds.push(equipmentId);
        model.maxHp = Math.max(1, model.maxHp + equipment.maxHpBonus);
        model.hp = Math.min(model.hp, model.maxHp);
        this.dispatchEvent(PlayerEvent.statsChanged);
        return true;
    }

    removeEquipment(equipmentId: number) {
        const model = this.ent.PlayerModel;
        const index = model.equipmentIds.indexOf(equipmentId);
        if (index < 0) {
            return false;
        }
        model.equipmentIds.splice(index, 1);
        model.maxHp = Math.max(1, model.maxHp - (TableEquipment.getConfigById(equipmentId)?.maxHpBonus || 0));
        model.hp = Math.min(model.hp, model.maxHp);
        this.dispatchEvent(PlayerEvent.statsChanged);
        return true;
    }

    addItem(itemId: number, count: number) {
        if (!TableItem.getConfigById(itemId) || !Number.isSafeInteger(count) || count <= 0) {
            return false;
        }
        const model = this.ent.PlayerModel;
        if (this.getItemCount() + count > this.getItemLimit()) {
            return false;
        }
        model.items[itemId] = (model.items[itemId] || 0) + count;
        this.dispatchEvent(PlayerEvent.statsChanged);
        return true;
    }

    getItemCount() {
        return Object.values(this.ent.PlayerModel.items).reduce((sum, count) => {
            return sum + (Number.isSafeInteger(count) && count > 0 ? count : 0);
        }, 0);
    }

    getItemLimit() {
        return Math.max(0, TableUniversal.getConfigById(UniversalNameEnum.MAX_ITEM_COUNT)?.value || 0);
    }

    removeItem(itemId: number) {
        const model = this.ent.PlayerModel;
        const count = model.items[itemId] || 0;
        if (count <= 0) {
            return false;
        }
        if (count === 1) {
            delete model.items[itemId];
        }
        else {
            model.items[itemId] = count - 1;
        }
        this.dispatchEvent(PlayerEvent.statsChanged);
        return true;
    }

    addResource(resourceId: number, count: number) {
        if (!TableGameResource.getConfigById(resourceId) || !Number.isSafeInteger(count) || count <= 0) {
            return false;
        }
        const model = this.ent.PlayerModel;
        if (resourceId === GameResourceItemEnum.GOLD) {
            model.gold += count;
        }
        else {
            model.resources[resourceId] = (model.resources[resourceId] || 0) + count;
        }
        this.dispatchEvent(PlayerEvent.statsChanged);
        return true;
    }


}

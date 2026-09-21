import { TableDice } from '../table/TableDice';
import { TableEnemy } from '../table/TableEnemy';
import { TableRole } from '../table/TableRole';

export class ResPath {

    private static requireLocalId(id: number, localId: number, tableName: string) {
        if (!localId) {
            throw new Error(`${id} 不是有效的 ${tableName} 配置ID`);
        }

        return localId;
    }

    /**
     * 角色头像
     */
    static getSpriteRoleHead(id: number): string {
        const localId = this.requireLocalId(id, TableRole.getLocalId(id), TableRole.TableName);
        const resourceId = 1000 + localId;
        return `texture/roleHead/roleHead${resourceId}/spriteFrame`;
    }


    /**
     * 角色立绘
     */
    static getSpriteRoleBody(id: number): string {
        const localId = this.requireLocalId(id, TableRole.getLocalId(id), TableRole.TableName);
        const resourceId = 1000 + localId;
        return `texture/roleBody/roleBody${resourceId}/spriteFrame`;
    }

    /**
     * 敌人立绘
     */
    static getSpriteEnemyBody(id: number): string {
        const localId = this.requireLocalId(id, TableEnemy.getLocalId(id), TableEnemy.TableName);
        const resourceId = 5000 + localId;
        return `texture/enemyBody/enemyBody${resourceId}/spriteFrame`;
    }

    /**
     * 角色卡片
     */
    static getSpriteRoleCard(id: number): string {
        const localId = this.requireLocalId(id, TableRole.getLocalId(id), TableRole.TableName);
        const resourceId = 1000 + localId;
        return `texture/roleCard/roleCard${resourceId}/spriteFrame`;
    }

    /**
     * 骰子
     */
    static getSpriteDice(id: number): string {
        const localId = this.requireLocalId(id, TableDice.getLocalId(id), TableDice.TableName);
        const resourceId = 6000 + localId;
        return `texture/dice/dice${resourceId}/spriteFrame`;
    }

    /**
     * 道具图标
     */
    static getSpriteItemIcon(id: number): string {
        return `texture/item/item${id}/spriteFrame`;
    }

}

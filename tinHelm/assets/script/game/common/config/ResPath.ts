export class ResPath {

    /**
     * 角色头像
     */
    static getSpriteRoleHead(id: number): string {
        return `texture/roleHead/roleHead${id}/spriteFrame`;
    }


    /**
     * 角色立绘
     */
    static getSpriteRoleBody(id: number): string {
        return `texture/roleBody/roleBody${id}/spriteFrame`;
    }

    /**
     * 角色卡片
     */
    static getSpriteRoleCard(id: number): string {
        return `texture/roleCard/roleCard${id}/spriteFrame`;
    }


    /**
     * 道具图标
     */
    static getSpriteItemIcon(id: number): string {
        return `texture/item/item${id}/spriteFrame`;
    }

}
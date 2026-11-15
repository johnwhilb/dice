export class ResPath {
    /**
     * 获取职业图标
     */
    static getClassSpriteItemIcon(id: number): string {
        return `texture/class/${id}/spriteFrame`;
    }

    /** 获取被动道具图标。 */
    static getItemSpriteIcon(id: number): string {
        return `texture/item/${id}/spriteFrame`;
    }
}

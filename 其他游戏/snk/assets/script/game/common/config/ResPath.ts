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

    /** 获取战斗音效资源路径。 */
    static getBattleAudio(name: string): string {
        return `audios/${name}`;
    }

    /** 获取商店音效资源路径。 */
    static getShopAudio(name: string): string {
        return `audios/${name}`;
    }
}

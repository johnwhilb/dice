import { BaseShopContent } from "./BaseShopContent";

/**
 * ShopContent 配置扩展类。
 *
 * 此文件只会自动创建一次。
 * 可以在这里安全编写项目自己的方法。
 */
export class TableShopContent extends BaseShopContent {
    static getRole(roleId: number) {
        return this.getAllConfig<TableShopContent>().find((content) => {
            return content.roleId === roleId;
        });
    }

    static getRoleClass(classId: number) {
        return this.getAllConfig<TableShopContent>().find((content) => {
            return content.classId === classId;
        });
    }

    static getItems() {
        return this.getAllConfig<TableShopContent>().filter((content) => {
            return !content.roleId && !content.classId && content.enabled;
        });
    }

    getDescription(level: number) {
        return level === 3 ? this.description3 : level === 2 ? this.description2 : this.description1;
    }
}

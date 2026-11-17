/*
 * @Descripttion: 颜色常量类
 */
import { Color } from "cc";
import { TableShopContent } from "../table/TableShopContent";
import { TableEnemy } from "../table/TableEnemy";

export class ColorConst {
    static getEnemyColor(configId: number) {
        return new Color(TableEnemy.getConfigById(configId).color);
    }

    static getPlayerColor(roleId: number) {
        const content = TableShopContent.getRole(roleId);
        return new Color(content.color);
    }

    static readonly shopText: Color = new Color("#dadada");
    static readonly shopMuted: Color = new Color("#777777");
    static readonly shopPanel: Color = new Color("#434343");
    static readonly shopHover: Color = new Color("#292929");
    static readonly shopTick: Color = new Color("#707070");
    static readonly shopItemXpEmpty: Color = new Color("#303030");
    static readonly shopButton: Color = new Color("#363636");
    static readonly shopGreen: Color = new Color("#8bbf40");
    static readonly shopShadow: Color = new Color(26, 26, 26, 128);
    static readonly shopTags: Map<string, string> = new Map<string, string>([
        ["fg", "#dadada"],
        ["bg10", "#707070"],
        ["light_bg", "#777777"],
        ["yellow", "#facf00"],
        ["green", "#8bbf40"],
        ["blue", "#019bd6"],
        ["red", "#e91d39"],
        ["orange", "#f07021"],
        ["purple", "#8e559e"],
        ["blue2", "#4778ba"],
        ["yellow2", "#f59f10"],
        ["fgm5", "#bababa"],
    ]);
    static readonly menuStar: Color = new Color(150, 150, 150, 255);

    static readonly menuSnakeColors: Color[] = [
        new Color("#8e559e69"),
        new Color("#019bd669"),
        new Color("#8e559e69"),
        new Color("#e91d3969"),
        new Color("#f0702169"),
        new Color("#facf0069"),
        new Color("#8bbf4069"),
    ];

    // 通用颜色
    static WHITE: Color = new Color(255, 255, 255, 255);
    static YELLOW: Color = new Color(255, 255, 0, 255);
    static GREEN: Color = new Color(0, 255, 0, 255);
    static GREEN2: Color = new Color(67, 146, 71, 255);
    static BLUE: Color = new Color(0, 0, 255, 255);
    static RED: Color = new Color(255, 0, 0, 255);
    static MAGENTA: Color = new Color(255, 0, 255, 255);
    static BLACK: Color = new Color(0, 0, 0, 255);
    static ORANGE: Color = new Color(255, 127, 0, 255);
    static GRAY: Color = new Color(166, 166, 166, 255);

    /** 文本颜色 */
    /** #D9CBAF */
    static NO1: Color = new Color(217, 203, 175, 255);

    /** 转换色值格式**/
    public static getColorStrByColorUint(color: number): string {
        let colorStr: string = color.toString(16);
        while (colorStr.length < 6) {
            colorStr = "0" + colorStr;
        }
        const theColor: string = "#" + colorStr;
        return theColor;
    }
}

/*
 * @Descripttion: 颜色常量类
 */
import { Color } from "cc";
import { TableShopContent } from "../table/TableShopContent";
import { TableEnemy } from "../table/TableEnemy";

export class ColorConst {
    static getCombatColor(roleId: number, opacity: number) {
        const color = roleId > 0 ? this.getPlayerColor(roleId) : this.shopText.clone();
        color.a = opacity;
        return color;
    }
    static getEnemyColor(configId: number) {
        return new Color(TableEnemy.getConfigById(configId).color);
    }

    static getPlayerColor(roleId: number) {
        const content = TableShopContent.getRole(roleId);
        return new Color(content.color);
    }

    static getShopDarkAccentColor(base: Color) {
        const max = Math.max(base.r, base.g, base.b);
        const min = Math.min(base.r, base.g, base.b);
        const lightness = (max + min) / 510;
        const levelLightness = Math.max(0, lightness - 5 * 0.025);
        const chroma = 1 - Math.abs(2 * lightness - 1);
        const levelChroma = 1 - Math.abs(2 * levelLightness - 1);
        const ratio = chroma > 0 ? levelChroma / chroma : 0;
        return new Color(
            Math.round(levelLightness * 255 + (base.r - lightness * 255) * ratio),
            Math.round(levelLightness * 255 + (base.g - lightness * 255) * ratio),
            Math.round(levelLightness * 255 + (base.b - lightness * 255) * ratio),
            base.a,
        );
    }

    static readonly shopText: Color = new Color("#dadada");
    static readonly enemySpawnParticle: Color = new Color("#e91d39");
    static readonly battleCritGold: Color = new Color("#facf00");
    static readonly battleDangerRed: Color = new Color("#e91d39");
    static readonly battleSlowBlue: Color = new Color("#019bd6");
    static readonly battleDotPurple: Color = new Color("#8e559e");
    static readonly battleBoostOrange: Color = new Color("#f07021");
    static readonly battleShieldCyan: Color = new Color("#6de3ff");
    static readonly battlePlasmaBlue: Color = new Color("#28c8ff");
    static readonly battlePlasmaGlow: Color = new Color(40, 200, 255, 95);
    static readonly battleFairyBlue: Color = new Color(1, 155, 214, 175);
    static readonly battleReviveGreen: Color = new Color(139, 191, 64, 185);
    static readonly battleDefenseGold: Color = new Color(250, 207, 0, 185);
    static readonly battleWardenGold: Color = new Color("#facf00");
    static readonly battleArenaGrid: Color = new Color(255, 255, 255, 14);
    static readonly battleArenaCross: Color = new Color(255, 255, 255, 24);
    static readonly battleArenaGuide: Color = new Color(218, 218, 218, 120);
    static readonly battleWallFlash: Color = new Color(255, 255, 255, 210);
    static readonly battleDamageOutline: Color = new Color(18, 18, 22, 235);
    static readonly battleHpTrail: Color = new Color(255, 255, 255, 220);
    static readonly battleEnemyShadow: Color = new Color(16, 16, 20, 128);
    static readonly battleBannerBg: Color = new Color(24, 24, 30, 210);
    static readonly shopMuted: Color = new Color("#777777");
    static readonly shopPanel: Color = new Color("#434343");
    static readonly shopHover: Color = new Color("#292929");
    static readonly shopTick: Color = new Color("#707070");
    static readonly shopItemXpEmpty: Color = new Color("#303030");
    static readonly shopButton: Color = new Color("#363636");
    static readonly shopBuyButton: Color = new Color("#f59f10");
    static readonly shopMergeButton: Color = new Color("#facf00");
    static readonly shopMergeGlow: Color = new Color(250, 207, 0, 220);
    static readonly shopMaxBadge: Color = new Color("#4778ba");
    static readonly shopGreen: Color = new Color("#8bbf40");
    static readonly shopGreenMuted: Color = new Color("#566c36");
    static readonly shopBattleTextActive: Color = new Color(92, 128, 42, 255);
    static readonly shopBattleTextMuted: Color = new Color(56, 68, 40, 255);
    static readonly shopGoldGain: Color = new Color("#facf00");
    static readonly shopGoldSpend: Color = new Color("#f07021");
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

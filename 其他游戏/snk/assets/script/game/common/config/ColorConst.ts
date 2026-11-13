/*
 * @Descripttion: 颜色常量类
 */
import { Color } from "cc";

export class ColorConst {
    static readonly menuStar = new Color(150, 150, 150, 255);

    static readonly menuSnakeColors = [
        new Color('#8e559e69'),
        new Color('#019bd669'),
        new Color('#8e559e69'),
        new Color('#e91d3969'),
        new Color('#f0702169'),
        new Color('#facf0069'),
        new Color('#8bbf4069')
    ];

    //通用颜色
    static WHITE = new Color(255, 255, 255, 255)
    static YELLOW = new Color(255, 255, 0, 255)
    static GREEN = new Color(0, 255, 0, 255)
    static GREEN2 = new Color(67, 146, 71, 255)
    static BLUE = new Color(0, 0, 255, 255)
    static RED = new Color(255, 0, 0, 255)
    static MAGENTA = new Color(255, 0, 255, 255)
    static BLACK = new Color(0, 0, 0, 255)
    static ORANGE = new Color(255, 127, 0, 255)
    static GRAY = new Color(166, 166, 166, 255)

    /** 文本颜色 */
    /** #D9CBAF */
    static NO1 = new Color(217, 203, 175, 255)

    /**转换色值格式**/
    public static getColorStrByColorUint(color: number): string {
        let colorStr: string = color.toString(16);
        while (colorStr.length < 6) {
            colorStr = "0" + colorStr;
        }
        let theColor: string = "#" + colorStr;
        return theColor;
    }

}

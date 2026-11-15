import { ColorConst } from "../common/config/ColorConst";

export class UICommon {
    static toText(text: string, isRichText: boolean = false): string {
        let colorOpen = false;
        const richText = text.replace(/\[(\w+)\]/g, (match: string, tag: string) => {
            const color = ColorConst.shopTags.get(tag);
            if (!color) {
                return match;
            }
            if (!isRichText) {
                return "";
            }
            const closingTag = colorOpen ? "</color>" : "";
            colorOpen = true;
            return `${closingTag}<color=${color}>`;
        });
        return colorOpen ? `${richText}</color>` : richText;
    }
}

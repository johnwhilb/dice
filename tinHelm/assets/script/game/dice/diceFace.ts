import { _decorator, Color, Component, Label, Node, Sprite, sys, Texture2D, UITransform } from 'cc';
const { ccclass } = _decorator;

@ccclass('diceFace')
export class diceFace extends Component {
    private renderedTexture: Texture2D | null = null;
    private renderedSignature = '';

    public syncLabelColor(): void {
        const label = this.getLabel();
        const icon = this.getIcon();

        if (!label || !icon) {
            return;
        }

        // 不再读取 Texture2D 像素。
        // 直接使用 Sprite 的颜色，Web / 微信小游戏都能用。
        label.color.set(icon.color);
    }

    public getShaderTexture(): Texture2D | null {
        const icon = this.getIcon();
        const texture = icon?.spriteFrame?.texture as Texture2D | null;
        if (!icon || !texture) {
            return null;
        }

        if (!sys.isBrowser) {
            return texture;
        }

        const label = this.getLabel() || undefined;
        const signature = this.getSignature(icon, label);
        if (this.renderedTexture && this.renderedSignature === signature) {
            return this.renderedTexture;
        }

        const renderedTexture = this.createFaceTextureForWeb(icon, label);
        if (!renderedTexture) {
            return texture;
        }

        this.renderedTexture = renderedTexture;
        this.renderedSignature = signature;
        return renderedTexture;
    }

    public setSourceVisible(visible: boolean): void {
        this.node.active = visible;
    }

    private getIcon(): Sprite | null {
        return this.node.getChildByName('spIcon')?.getComponent(Sprite) || null;
    }

    private getLabel(): Label | null {
        return this.node.getChildByName('lbtNum')?.getComponent(Label) || null;
    }

    private getSignature(icon: Sprite, label: Label | undefined): string {
        const faceSpriteFrame = this.node.getComponent(Sprite)?.spriteFrame;
        const iconSpriteFrame = icon.spriteFrame;
        const labelColor = label?.color;
        return [
            faceSpriteFrame?.uuid,
            iconSpriteFrame?.uuid,
            iconSpriteFrame?.texture.width,
            iconSpriteFrame?.texture.height,
            label?.string,
            labelColor?.r,
            labelColor?.g,
            labelColor?.b,
            labelColor?.a,
        ].join('_');
    }

    private createFaceTextureForWeb(icon: Sprite, label: Label | undefined): Texture2D | null {
        if (!this.getTextureImageSource(icon.spriteFrame?.texture as Texture2D | null)) {
            return null;
        }

        const faceTransform = this.node.getComponent(UITransform);
        if (!faceTransform) {
            return null;
        }

        const width = Math.max(1, Math.round(faceTransform.width));
        const height = Math.max(1, Math.round(faceTransform.height));
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            canvas.remove();
            return null;
        }

        canvas.width = width;
        canvas.height = height;
        this.drawSprite(ctx, this.node.getComponent(Sprite), width, height);
        this.drawSprite(ctx, icon, width, height);

        if (label) {
            this.drawLabel(ctx, label, width, height);
        }

        const texture = new Texture2D();
        texture.reset({
            width: width,
            height: height,
            format: Texture2D.PixelFormat.RGBA8888,
        });
        texture.uploadData(canvas as any);
        canvas.remove();
        return texture;
    }

    private drawSprite(
        ctx: CanvasRenderingContext2D,
        sprite: Sprite | null,
        canvasWidth: number,
        canvasHeight: number
    ): void {
        const spriteFrame = sprite?.spriteFrame;
        const source = this.getTextureImageSource(spriteFrame?.texture as Texture2D | null);
        const transform = sprite?.node.getComponent(UITransform);
        if (!spriteFrame || !source || !transform || !sprite) {
            return;
        }

        const rect = spriteFrame.rect;
        const node = sprite.node;
        const scale = node.scale;
        const drawWidth = transform.width * Math.abs(scale.x);
        const drawHeight = transform.height * Math.abs(scale.y);
        const drawX = canvasWidth * 0.5 + (node === this.node ? 0 : node.position.x) - drawWidth * 0.5;
        const drawY = canvasHeight * 0.5 - (node === this.node ? 0 : node.position.y) - drawHeight * 0.5;

        ctx.save();
        ctx.globalAlpha = sprite.color.a / 255;
        ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
    }

    private drawLabel(
        ctx: CanvasRenderingContext2D,
        label: Label,
        canvasWidth: number,
        canvasHeight: number
    ): void {
        const node = label.node;
        const color = label.color;
        const fontWeight = (label as any).isBold ? 'bold ' : '';
        const fontFamily = label.fontFamily || 'Arial';

        ctx.save();
        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
        ctx.font = `${fontWeight}${label.fontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label.string, canvasWidth * 0.5 + node.position.x, canvasHeight * 0.5 - node.position.y);
        ctx.restore();
    }


    private getTextureImageSource(texture: Texture2D | null): HTMLCanvasElement | HTMLImageElement | null {
        return ((texture as any)?.image?.data || null) as HTMLCanvasElement | HTMLImageElement | null;
    }
}

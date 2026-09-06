import { _decorator, Color, Component, Label, Node, Sprite, sys, Texture2D, UITransform } from 'cc';
const { ccclass } = _decorator;

@ccclass('diceFace')
export class diceFace extends Component {
    private renderedTexture: Texture2D | null = null;
    private renderedSignature = '';
    private colorCache: Map<Texture2D, Color> = new Map();

    public syncLabelColor(): void {
        const label = this.getLabel();
        const icon = this.getIcon();
        const texture = icon?.spriteFrame?.texture as Texture2D | null;
        if (!label || !texture) {
            return;
        }

        label.color.set(this.getTextureMainColor(texture));
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

    private getTextureMainColor(texture: Texture2D): Color {
        const cached = this.colorCache.get(texture);
        if (cached) {
            return cached;
        }

        const color = sys.isBrowser
            ? this.getTextureMainColorForWeb(texture)
            : this.getTextureMainColorForNative(texture);

        this.colorCache.set(texture, color);
        return color;
    }

    private getTextureMainColorForWeb(texture: Texture2D): Color {
        const image = this.getTextureImageSource(texture);
        if (!image) {
            return new Color(255, 255, 255, 255);
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            canvas.remove();
            return new Color(255, 255, 255, 255);
        }

        canvas.width = texture.width;
        canvas.height = texture.height;
        ctx.drawImage(image, 0, 0, texture.width, texture.height);
        const data = ctx.getImageData(0, 0, texture.width, texture.height).data;
        canvas.remove();

        return this.averageOpaquePixels(data);
    }

    private getTextureMainColorForNative(texture: Texture2D): Color {
        const sampleCount = 12;
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        let count = 0;

        for (let y = 0; y < sampleCount; y++) {
            for (let x = 0; x < sampleCount; x++) {
                const pixel = (texture as any).getPixel(
                    Math.floor((x + 0.5) * texture.width / sampleCount),
                    Math.floor((y + 0.5) * texture.height / sampleCount)
                );
                if (!pixel || pixel.a <= 8) {
                    continue;
                }

                r += pixel.r;
                g += pixel.g;
                b += pixel.b;
                a += pixel.a;
                count++;
            }
        }

        if (count <= 0) {
            return new Color(255, 255, 255, 255);
        }

        return new Color(
            Math.round(r / count),
            Math.round(g / count),
            Math.round(b / count),
            Math.round(a / count)
        );
    }

    private averageOpaquePixels(data: Uint8ClampedArray): Color {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] <= 8) {
                continue;
            }

            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            a += data[i + 3];
            count++;
        }

        if (count <= 0) {
            return new Color(255, 255, 255, 255);
        }

        return new Color(
            Math.round(r / count),
            Math.round(g / count),
            Math.round(b / count),
            Math.round(a / count)
        );
    }

    private getTextureImageSource(texture: Texture2D | null): HTMLCanvasElement | HTMLImageElement | null {
        return ((texture as any)?.image?.data || null) as HTMLCanvasElement | HTMLImageElement | null;
    }
}

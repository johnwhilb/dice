import { _decorator, Component, Label, Sprite, Texture2D } from 'cc';
import { diceFace } from './diceFace';
import { smc } from '../common/SingletonModuleComp';
const { ccclass } = _decorator;

const DICE_FACE_TEXTURE_PROPERTIES = [
    'faceTexture1',
    'faceTexture2',
    'faceTexture3',
    'faceTexture4',
    'faceTexture5',
    'faceTexture6',
];

@ccclass('nodeDice')
export class nodeDice extends Component {
    private faceTextures: Array<Texture2D | null> = [];
    private initialized = false;
    private rolling = false;
    private rollDuration = 2;
    private rollElapsed = 0;
    private rollTargetFace = 1;
    private index = 0;

    start() {
        this.syncFaces();
        this.stopAtFace(1);
    }

    update(deltaTime: number): void {
        this.syncFaces();
        this.updateRoll(deltaTime);
    }


    setIndex(index: number) {
        this.index = index;
    }


    public syncFaces(): void {
        const sprite = this.node.getComponent(Sprite);
        const material = sprite?.getMaterialInstance(0);
        if (!material) {
            return;
        }

        if (!this.initialized) {
            this.initialized = true;
            material.setProperty('rotationSpeed', 0);
            material.setProperty('stopBlend', 1);
            material.setProperty('stopFace', this.rollTargetFace);
        }

        for (let i = 0; i < this.node.children.length && i < DICE_FACE_TEXTURE_PROPERTIES.length; i++) {
            const faceNode = this.node.children[i];
            const face = faceNode.getComponent(diceFace) || faceNode.addComponent(diceFace);

            face.syncLabelColor();
            const texture = face.getShaderTexture();
            if (texture && this.faceTextures[i] !== texture) {
                this.faceTextures[i] = texture;
                material.setProperty(DICE_FACE_TEXTURE_PROPERTIES[i], texture);
            }

            face.setSourceVisible(false);
        }
    }

    public rollToFace(face: number, duration = 2): void {
        this.rollTargetFace = this.clampFace(face);
        this.rollDuration = Math.max(0.1, duration);
        this.rollElapsed = 0;
        this.rolling = true;

        const material = this.getDiceMaterial();
        if (!material) {
            return;
        }

        material.setProperty('stopFace', this.rollTargetFace);
        material.setProperty('stopBlend', 0);
        material.setProperty('rotationSpeed', 5);
        this.randomizeRotation(material);
    }

    public rollToFaceValue(faceValue: number, duration = 2): void {
        const face = this.getFaceByValue(faceValue);
        this.rollToFace(face, duration);
    }

    public stopAtFace(face: number): void {
        this.rollTargetFace = this.clampFace(face);
        this.rolling = false;

        const material = this.getDiceMaterial();
        if (!material) {
            return;
        }

        material.setProperty('stopFace', this.rollTargetFace);
        material.setProperty('stopBlend', 1);
        material.setProperty('rotationSpeed', 0);
    }

    private updateRoll(deltaTime: number): void {
        if (!this.rolling) {
            return;
        }

        const material = this.getDiceMaterial();
        if (!material) {
            return;
        }

        this.rollElapsed += deltaTime;

        const settleDuration = Math.min(0.45, this.rollDuration * 0.35);
        const settleStart = this.rollDuration - settleDuration;
        const settleProgress = this.rollElapsed <= settleStart
            ? 0
            : (this.rollElapsed - settleStart) / settleDuration;

        material.setProperty('stopFace', this.rollTargetFace);
        material.setProperty('stopBlend', Math.min(1, settleProgress));

        if (this.rollElapsed >= this.rollDuration) {
            this.stopAtFace(this.rollTargetFace);
        }
    }

    private randomizeRotation(material: any): void {
        material.setProperty('rotationX', Math.random() * Math.PI * 2 - Math.PI);
        material.setProperty('rotationY', Math.random() * Math.PI * 2 - Math.PI);
        material.setProperty('rotationZ', Math.random() * Math.PI * 2 - Math.PI);
    }

    private getDiceMaterial(): any {
        return this.node.getComponent(Sprite)?.getMaterialInstance(0) || null;
    }

    private getFaceByValue(faceValue: number): number {
        for (let i = 0; i < this.node.children.length && i < DICE_FACE_TEXTURE_PROPERTIES.length; i++) {
            const label = this.node.children[i].getChildByName('lbtNum')?.getComponent(Label);
            if (Number(label?.string) === faceValue) {
                return i + 1;
            }
        }

        return this.clampFace(faceValue);
    }

    private clampFace(face: number): number {
        return Math.max(1, Math.min(6, Math.floor(face)));
    }

    onBtnClick() {
        const isLocked = smc.battle.BattlePlayerModel.diceLocked.includes(this.index);
        if (isLocked) {
            smc.battle.BattleDiceBll.unlockDice(this.index);
        } else {
            smc.battle.BattleDiceBll.lockDice(this.index);
        }
    }

}

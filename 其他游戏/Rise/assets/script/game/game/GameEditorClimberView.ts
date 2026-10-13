import { GameEditorRoute } from './GameEditorRoute';
import { _decorator, Color, Graphics, Node, Sprite, UITransform } from 'cc';
import { GameComponent } from 'db://oops-framework/module/common/GameComponent';
import type { GameEditor } from './GameEditor';
import { ClimbPoint, LimbId } from './TableClimbRoute';

const { ccclass } = _decorator;

interface ClimberLimbDisplay {
    end: Node;
    sprite: Sprite;
    upper: Node;
    lower: Node;
    joint: Node;
}

@ccclass('GameEditorClimberView')
export class GameEditorClimberView extends GameComponent {
    private climb!: GameEditor;
    private body!: Node;
    private selection!: Graphics;
    private limbs = new Map<LimbId, ClimberLimbDisplay>();

    init(climb: GameEditor) {
        this.climb = climb;
        this.nodeTreeInfoLite();
        this.body = this.getNode('Body')!;
        this.selection = this.getNode('Selection')!.addComponent(Graphics);
        GameEditorRoute.limbs.forEach((setting) => {
            const upper = this.getNode(`${setting.id}Upper`)!;
            const lower = this.getNode(`${setting.id}Lower`)!;
            const joint = this.getNode(`${setting.id}Joint`)!;
            const end = this.getNode(`${setting.id}End`)!;
            const sprite = end.getComponent(Sprite)!;
            this.limbs.set(setting.id, { end, sprite, upper, lower, joint });
        });
        this.render();
    }

    render() {
        const model = this.climb.model;
        this.selection.clear();
        this.body.setPosition(model.body.x, -model.body.y);
        this.body.angle = -model.body.tilt * 180 / Math.PI;
        model.limbs.forEach((limb) => {
            const root = this.climb.bll.rootOf(limb.id);
            const joint = this.solveJoint(root, limb, limb.hand ? 105 : 93, limb.hand ? 105 : 95, limb.side);
            const display = this.limbs.get(limb.id)!;
            this.renderSegment(display.upper, root, joint, limb.hand);
            this.renderSegment(display.lower, joint, limb, limb.hand);
            display.joint.setPosition(joint.x, -joint.y);
            display.end.setPosition(limb.x, -limb.y);
            display.end.angle = limb.hand ? 0 : -Math.min(45, Math.max(-65, Math.atan2(limb.y - joint.y, limb.x - joint.x) * 180 / Math.PI + 75));
            display.sprite.color = model.selected === limb.id ? new Color(220, 255, 175) : Color.WHITE;
            if (model.selected === limb.id) {
                this.selection.lineWidth = 3;
                this.selection.strokeColor = new Color(200, 251, 116);
                this.selection.circle(limb.x, -limb.y, 29);
                this.selection.stroke();
            }
        });
    }

    private renderSegment(node: Node, start: ClimbPoint, end: ClimbPoint, hand: boolean) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        node.setPosition((start.x + end.x) / 2, -(start.y + end.y) / 2);
        node.angle = -Math.atan2(dy, dx) * 180 / Math.PI;
        node.getComponent(UITransform)!.setContentSize((hand ? 131 : 119) * length / (hand ? 105 : 93), 26);
    }

    private solveJoint(start: ClimbPoint, end: ClimbPoint, length1: number, length2: number, side: number) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.max(0.01, Math.hypot(dx, dy));
        const clamped = Math.min(distance, length1 + length2 - 0.01);
        const along = (length1 * length1 - length2 * length2 + clamped * clamped) / (2 * clamped);
        const height = Math.sqrt(Math.max(0, length1 * length1 - along * along));
        const a = { x: start.x + dx / distance * along - dy / distance * height, y: start.y + dy / distance * along + dx / distance * height };
        const b = { x: start.x + dx / distance * along + dy / distance * height, y: start.y + dy / distance * along - dx / distance * height };
        return (side < 0 ? a.x < b.x : a.x > b.x) ? a : b;
    }
}

import { _decorator, EventTouch, Label, Node, RichText, Sprite } from 'cc';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { StoryEvent } from './StoryEvent';

const { ccclass } = _decorator;

enum StoryRolePosition {
    Left = 'LEFT',
    Right = 'RIGHT',
}

@ccclass('StoryDialog')
@ecs.register('StoryDialog', false)
@gui.register('StoryDialog', { layer: LayerType.Dialog, prefab: 'gui/storyEvent/StoryDialog' })
export class StoryDialog extends CCView<StoryEvent> {
    private readonly typeInterval = 0.03;
    private textCharacters: string[] = [];
    private typedLength = 0;
    private isTyping = false;

    start() {
        this.nodeTreeInfoLite();
        this.node.on(Node.EventType.TOUCH_END, this.onDialogueTouchEnd, this);
        this.refreshDialogue();
    }

    private refreshDialogue() {
        const dialogue = this.ent.getCurrentDialogue();
        if (!dialogue) {
            this.ent.finishCurrentEvent();
            return;
        }

        this.getNode('lbtName')!.getComponent(Label)!.string = dialogue.name ?? '';
        this.getNode('txtSkip')!.getComponent(Label)!.string = '点击继续';
        this.ent.updateBackground(dialogue.bgPath ?? '');
        this.updateRole(dialogue.rolePath ?? '', dialogue.string ?? StoryRolePosition.Left);
        this.startTypewriter(dialogue.txt ?? '');
    }

    private updateRole(path: string, position: string) {
        const roleNode = this.getNode('nodeRole')!;
        const roleSprite = this.getNode('spRole')!.getComponent(Sprite)!;
        const offsetX = 220;
        roleNode.setPosition(
            position === StoryRolePosition.Right ? offsetX : -offsetX,
            roleNode.position.y,
            roleNode.position.z
        );
        roleSprite.node.active = !!path;
        if (path) {
            const spritePath = path.endsWith('/spriteFrame') ? path : `${path}/spriteFrame`;
            this.setSprite(roleSprite, spritePath);
        }
    }

    private startTypewriter(text: string) {
        this.unschedule(this.typeNextCharacter);
        this.textCharacters = [...text];
        this.typedLength = 0;
        this.isTyping = this.textCharacters.length > 0;
        this.getNode('lbtTalk')!.getComponent(RichText)!.string = '';

        if (this.isTyping) {
            this.schedule(
                this.typeNextCharacter,
                this.typeInterval,
                this.textCharacters.length - 1
            );
        }
    }

    private typeNextCharacter() {
        this.typedLength += 1;
        this.getNode('lbtTalk')!.getComponent(RichText)!.string = this.textCharacters
            .slice(0, this.typedLength)
            .join('');

        if (this.typedLength >= this.textCharacters.length) {
            this.isTyping = false;
            this.unschedule(this.typeNextCharacter);
        }
    }

    private completeTypewriter() {
        this.unschedule(this.typeNextCharacter);
        this.typedLength = this.textCharacters.length;
        this.isTyping = false;
        this.getNode('lbtTalk')!.getComponent(RichText)!.string = this.textCharacters.join('');
    }

    private onDialogueTouchEnd(event: EventTouch) {
        event.propagationStopped = true;
        if (this.isTyping) {
            this.completeTypewriter();
            return;
        }

        const dialogue = this.ent.nextDialogue();
        if (dialogue) {
            this.refreshDialogue();
        }
        else {
            this.ent.finishCurrentEvent();
        }
    }

    reset() {
        this.unscheduleAllCallbacks();
        this.node.off(Node.EventType.TOUCH_END, this.onDialogueTouchEnd, this);
        this.textCharacters = [];
        this.typedLength = 0;
        this.isTyping = false;
    }
}

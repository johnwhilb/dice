import { instantiate, Node, Prefab } from 'cc';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { GameEditorModel } from './GameEditorModel';
import { GameEditorBll } from './GameEditorBll';
import { GameEditorView } from './GameEditorView';

@ecs.register('GameEditor')
export class GameEditor extends CCEntity {
    model!: GameEditorModel;
    bll!: GameEditorBll;
    private editorNode: Node | null = null;

    init() {
        this.model = this.add(GameEditorModel);
        this.bll = this.addBusiness(GameEditorBll);
    }

    open(levelId: number, prefab: Prefab, parent: Node) {
        if (!prefab || !this.bll.loadLevel(levelId)) {
            return null;
        }
        if (!this.editorNode) {
            const node = instantiate(prefab);
            node.active = false;
            this.add(node.getComponent(GameEditorView)!);
            node.parent = parent;
            this.editorNode = node;
        }
        this.editorNode.active = true;
        this.editorNode.setSiblingIndex(parent.children.length - 1);
        return this.editorNode;
    }

    close(discard = false) {
        if (this.model.saving) {
            this.model.status = '正在保存，请等待保存完成';
            return false;
        }
        if (this.model.dirty && !discard) {
            this.model.status = '有未保存修改，请先保存，或点击“放弃并返回”';
            return false;
        }
        this.bll.pause();
        this.editorNode!.active = false;
        return true;
    }
}

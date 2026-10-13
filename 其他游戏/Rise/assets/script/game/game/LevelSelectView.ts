import { _decorator, Color, EventTouch, Graphics, instantiate, Label, Node, Prefab, view } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { smc } from '../common/SingletonModuleComp';
import { TableClimbLevel } from '../common/table/TableClimbLevel';
import type { Climb } from './Climb';
import { LevelItemView } from './LevelItemView';
import { GameEditor } from './GameEditor';

const { ccclass, property } = _decorator;

@ccclass('LevelSelectView')
@ecs.register('LevelSelectView', false)
@gui.register('LevelSelectView', { layer: LayerType.UI, prefab: 'gui/gameView/LevelSelect' })
export class LevelSelectView extends CCView<Climb> {
    @property({ type: Prefab, tooltip: '关卡卡片预制体' })
    levelItemPrefab!: Prefab;

    @property({ type: Prefab, tooltip: '攀岩游戏预制体' })
    gamePrefab!: Prefab;

    @property({ type: Prefab, tooltip: '独立关卡编辑器预制体' })
    gameEditorPrefab!: Prefab;

    private board!: Node;
    private backdrop!: Graphics;
    private selectedTitle!: Label;
    private selectedDescription!: Label;
    private selectedInfo!: Label;
    private startNode!: Node;
    private startText!: Label;
    private editNode!: Node;
    private editText!: Label;
    private editor: GameEditor | null = null;
    private items: LevelItemView[] = [];
    private ready = false;

    start() {
        this.nodeTreeInfoLite();
        this.board = this.getNode('Board')!;
        this.selectedTitle = this.getNode('SelectedTitle')!.getComponent(Label)!;
        this.selectedDescription = this.getNode('SelectedDescription')!.getComponent(Label)!;
        this.selectedInfo = this.getNode('SelectedInfo')!.getComponent(Label)!;
        this.startNode = this.getNode('btnStartLevel')!;
        this.startText = this.getNode('StartText')!.getComponent(Label)!;
        this.editNode = this.getNode('btnEditLevel')!;
        this.editText = this.getNode('EditText')!.getComponent(Label)!;
        this.backdrop = this.node.addComponent(Graphics);
        this.drawPanels();
        this.getNode('btnBack')!.on(Node.EventType.TOUCH_END, this.btnBack, this);
        this.startNode.on(Node.EventType.TOUCH_END, this.btnStartLevel, this);
        this.editNode.on(Node.EventType.TOUCH_END, this.btnEditLevel, this);
        const grid = this.getNode('LevelGrid')!;
        TableClimbLevel.getOrdered().forEach((level, index) => {
            const node = instantiate(this.levelItemPrefab);
            node.parent = grid;
            node.setPosition(index % 2 === 0 ? -176 : 176, 294 - Math.floor(index / 2) * 147);
            const item = node.getComponent(LevelItemView)!;
            item.init(level, this);
            this.items.push(item);
        });
        this.ready = true;
        this.resize();
        this.refresh();
    }

    protected onEnable() {
        view.on('canvas-resize', this.resize, this);
        if (this.ready) {
            this.resize();
        }
    }

    protected onDisable() {
        view.off('canvas-resize', this.resize, this);
    }

    private resize() {
        const size = view.getVisibleSize();
        const scale = Math.min(size.width / 750, size.height / 1334);
        this.board.setScale(scale, scale, 1);
        this.backdrop.clear();
        this.backdrop.fillColor = new Color(10, 20, 30);
        this.backdrop.rect(-size.width / 2, -size.height / 2, size.width, size.height);
        this.backdrop.fill();
    }

    private drawPanels() {
        const panel = this.getNode('SelectionPanel')!.addComponent(Graphics);
        panel.fillColor = new Color(20, 35, 46);
        panel.strokeColor = new Color(64, 81, 89);
        panel.lineWidth = 1;
        panel.roundRect(-344, -90, 688, 180, 18);
        panel.fill();
        panel.stroke();
        const back = this.getNode('btnBack')!.addComponent(Graphics);
        back.fillColor = new Color(29, 44, 54);
        back.roundRect(-56, -24, 112, 48, 12);
        back.fill();
        const start = this.startNode.addComponent(Graphics);
        start.fillColor = new Color(200, 251, 116);
        start.roundRect(-164, -40, 328, 80, 18);
        start.fill();
        const edit = this.editNode.addComponent(Graphics);
        edit.fillColor = new Color(29, 48, 61);
        edit.strokeColor = new Color(115, 153, 170);
        edit.roundRect(-164, -40, 328, 80, 18);
        edit.fill();
        edit.stroke();
    }

    selectLevel(id: number) {
        if (this.ent.bll.selectLevel(id)) {
            this.refresh();
        }
    }

    refresh() {
        if (!this.ready) {
            return;
        }
        const level = TableClimbLevel.getConfigById(this.ent.model.selectedLevelId) || TableClimbLevel.getOrdered()[0];
        this.startNode.active = !!level;
        this.editNode.active = !!level;
        if (!level) {
            this.selectedTitle.string = '暂无可用关卡';
            this.selectedDescription.string = '请检查关卡配置。';
            this.selectedInfo.string = '';
            return;
        }
        this.ent.bll.selectLevel(level.id);
        this.items.forEach((item) => {
            item.render(level.id);
        });
        this.selectedTitle.string = `LV${level.level} · ${level.displayName}`;
        this.selectedDescription.string = level.description;
        const danger = level.getDangerCount();
        this.selectedInfo.string = `高度 ${level.height} · ${level.getHolds().length} 个岩点 · ${danger ? `${danger} 个危险岩点` : '无危险岩点'}`;
        this.startText.string = `开始第 ${level.level} 关攀登`;
        this.editText.string = `编辑第 ${level.level} 关`;
    }

    btnBack(event: EventTouch) {
        event.propagationStopped = true;
        this.ent.closeLevelSelect();
        smc.mainMenu.MainMenuView.node.active = true;
        smc.mainMenu.MainMenuView.refresh();
    }

    btnStartLevel(event: EventTouch) {
        event.propagationStopped = true;
        const node = this.ent.bll.enterSelectedLevel(this.gamePrefab, this.node.parent!);
        if (!node) {
            oops.gui.toast('关卡配置无效，无法开始攀登');
            return;
        }
        this.ent.closeLevelSelect();
    }

    btnEditLevel(event: EventTouch) {
        event.propagationStopped = true;
        if (!this.editor) {
            this.editor = ecs.getEntity(GameEditor);
        }
        const node = this.editor.open(this.ent.model.selectedLevelId, this.gameEditorPrefab, this.node.parent!);
        if (!node) {
            oops.gui.toast('编辑器预制体或关卡配置无效');
            return;
        }
        this.ent.closeLevelSelect();
    }

    reset() {
        this.ready = false;
        this.items = [];
    }
}

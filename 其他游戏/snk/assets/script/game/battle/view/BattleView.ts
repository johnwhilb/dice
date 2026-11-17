import { _decorator, EventTouch, instantiate, Label, Layout, Node, Prefab, UITransform, Vec3 } from "cc";
import { CCView } from "db://oops-framework/module/common/CCView";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import type { Battle } from "../Battle";
import { BattleBll } from "../bll/BattleBll";
import { PlayerEvent } from "../../player/PlayerEvent";
import { PlayerView } from "../../player/view/PlayerView";
import { PlayerHpItem } from "../../player/view/PlayerHpItem";
import type { IPlayerData } from "../../player/model/PlayerModel";
import { BattleEvent, BattleState } from "../BattleEvent";
import { EnemyEvent } from "../../enemy/EnemyEvent";
import { EnemyView } from "../../enemy/view/EnemyView";

const { ccclass, property } = _decorator;

@ccclass("BattleView")
@ecs.register("BattleView", false)
@gui.register("BattleView", { layer: LayerType.UI, prefab: "gui/battle/ui/BattleView" })
export class BattleView extends CCView<Battle> {
    @property(Prefab)
    private playerPrefab: Prefab;
    @property(Prefab)
    private playerHpPrefab: Prefab;
    @property(Prefab)
    private enemyPrefab: Prefab;
    private bodies: PlayerView[] = [];
    private enemies: EnemyView[] = [];
    private objects: EnemyView[] = [];
    private arenaTransform: UITransform;

    get model() {
        return this.ent.game.player.PlayerModel;
    }

    get business() {
        return this.ent.getBusiness<BattleBll>(BattleBll);
    }

    start() {
        this.on(PlayerEvent.UpdatePlayers, this.refresh, this);
        this.on(PlayerEvent.UpdatePose, this.refreshPose, this);
        this.on(PlayerEvent.UpdateHp, this.refreshPlayerHp, this);
        this.on(EnemyEvent.UpdateFrame, this.refreshEnemies, this);
        this.on(BattleEvent.UpdateState, this.refreshState, this);
        const arena = this.getNode("arena");
        this.arenaTransform = arena.getComponent(UITransform);
        this.business.setArenaSize(this.arenaTransform.width, this.arenaTransform.height);
        arena.on(Node.EventType.TOUCH_START, this.steer, this);
        arena.on(Node.EventType.TOUCH_MOVE, this.steer, this);
        this.refresh();
        this.refreshEnemies();
        this.refreshState();
    }

    refresh() {
        const arena = this.getNode("arena");
        for (let index = this.bodies.length; index < this.model.players.length; index++) {
            const node = instantiate(this.playerPrefab);
            node.parent = arena;
            const body = node.getComponent(PlayerView);
            this.bodies.push(body);
        }
        this.bodies.forEach((body, index) => {
            body.node.active = index < this.model.players.length && this.model.players[index].hp > 0;
            if (body.node.active) {
                body.setData(this.model.players[index]);
            }
        });
        this.getNode("lbtParty").getComponent(Label).string = this.model.players
            .map((player) => {
                return `${player.config.name} Lv.${player.level}`;
            })
            .join("  /  ");
        this.refreshPose();
        this.setRwdContent(this.getNode("nodePlayerInfo"), this.model.players);
    }

    private setRwdContent(itemBox: Node, players: IPlayerData[]) {
        const children = itemBox.children;
        const length = Math.max(children.length, players.length);
        for (let index = 0; index < length; index++) {
            const player = players[index];
            if (player && index >= children.length) {
                const item = instantiate(this.playerHpPrefab);
                item.parent = itemBox;
            }
            const item = children[index];
            item.active = !!player;
            if (player) {
                item.getComponent(PlayerHpItem).setData(player);
            }
        }
        itemBox.getComponent(Layout).updateLayout();
    }

    private refreshPlayerHp(event: string, index: number) {
        this.getNode("nodePlayerInfo").children[index].getComponent(PlayerHpItem).setData(this.model.players[index]);
    }

    private refreshEnemies() {
        const model = this.ent.game.enemy.EnemyModel;
        const enemyLayer = this.getNode("enemyLayer");
        const objectLayer = this.getNode("enemyObjectLayer");
        for (let index = this.enemies.length; index < model.enemies.length; index++) {
            const node = instantiate(this.enemyPrefab);
            node.parent = enemyLayer;
            this.enemies.push(node.getComponent(EnemyView));
        }
        for (let index = this.objects.length; index < model.objects.length; index++) {
            const node = instantiate(this.enemyPrefab);
            node.parent = objectLayer;
            this.objects.push(node.getComponent(EnemyView));
        }
        this.enemies.forEach((view, index) => {
            view.node.active = index < model.enemies.length;
            if (view.node.active) {
                view.setEnemy(model.enemies[index]);
            }
        });
        this.objects.forEach((view, index) => {
            view.node.active = index < model.objects.length;
            if (view.node.active) {
                view.setObject(model.objects[index]);
            }
        });
    }

    private refreshState() {
        const model = this.ent.BattleModel;
        const enemy = this.ent.game.enemy.EnemyModel;
        const ended = model.state === BattleState.Victory || model.state === BattleState.Defeat;
        this.getNode("battleResult").active = ended;
        this.getNode("lbtBattleResult").getComponent(Label).string = model.state === BattleState.Victory ? "关卡胜利" : "全队阵亡";
        this.getNode("lbtBattleStatus").getComponent(Label).string = model.state === BattleState.Countdown
            ? `第 ${model.level} 关 · ${Math.ceil(model.countdown)}`
            : ended ? `第 ${model.level} 关 · ${model.state === BattleState.Victory ? "胜利" : "失败"}`
            : `第 ${model.level} 关 · ${enemy.stage.bossId ? "首领战" : `波次 ${model.wave}/${enemy.stage.maxWaves}`} · 敌人 ${enemy.enemies.length}`;
    }

    private refreshPose() {
        this.bodies.forEach((body, index) => {
            if (body.node.active) {
                body.setPose(this.model.players[index].pose);
            }
        });
    }

    private steer(event: EventTouch) {
        if (this.ent.game.GameModel.transitioning) {
            return;
        }
        const point = event.getUILocation();
        const local = this.arenaTransform.convertToNodeSpaceAR(new Vec3(point.x, point.y, 0));
        this.business.steer(local.x, local.y);
    }

    update(deltaTime: number) {
        if (this.ent) {
            this.business.updateMovement(deltaTime);
        }
    }

    reset() {
        this.bodies = [];
        this.enemies = [];
        this.objects = [];
    }

    btnShop() {
        this.ent.game.returnShop();
    }

    btnBattleReturnShop() {
        this.business.returnAfterResult();
    }
}

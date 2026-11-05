import { TableRelmEvent } from '../../common/table/TableRelmEvent';
import { TableUniversal } from '../../common/table/TableUniversal';
import { UniversalNameEnum } from '../../common/table/UniversalNameEnum';
import { TableFightEvent } from '../../common/table/TableFightEvent';
import { TableEnemy } from '../../common/table/TableEnemy';
import { TableShopEvent } from '../../common/table/TableShopEvent';
import { EventTypeEnum } from '../../common/table/EventTypeEnum';
import { MapNodeData, MapNodeType, RealmLevelState } from '../model/RouteSelectModel';

export class MapGenerateBll {
    /** 按世界配置生成分层无交叉路径；random 为可替换的随机源，便于验证地图。 */
    static generate(realmId: number, random = Math.random): RealmLevelState {
        const floors = TableRelmEvent.getAllConfig().filter((item) => {
            return item.realms === realmId;
        }).sort((left, right) => {
            return left.level - right.level;
        });
        const columns = Math.max(2, Math.min(floors.length,
            this.getValue(UniversalNameEnum.REALM_EVENT_NUM, 10)));
        const lanes = Math.max(2, Math.min(9, this.getValue(UniversalNameEnum.MAP_LANE_COUNT, 7)));
        const pathCount = Math.max(2, Math.min(20, this.getValue(UniversalNameEnum.MAP_PATH_COUNT, 7)));
        const shopChance = Math.max(0, Math.min(100, this.getValue(UniversalNameEnum.MAP_SHOP_CHANCE, 15))) / 100;
        const nodes: MapNodeData[] = [];
        const starts: number[] = [];
        for (const pathIndex of Array.from({ length: pathCount }).keys()) {
            let lane = Math.floor(random() * lanes);
            if (pathIndex === 1 && lane === starts[0]) {
                lane = (lane + 1) % lanes;
            }
            starts.push(lane);
            let previous = this.getOrCreateNode(nodes, 0, lane, random);
            for (const columnIndex of Array.from({ length: columns - 2 }).keys()) {
                const column = columnIndex + 1;
                const candidates = [lane - 1, lane, lane + 1].filter((nextLane) => {
                    return nextLane >= 0 && nextLane < lanes && !nodes.some((source) => {
                        return source.column === column - 1 && source.nextNodeIds.some((id) => {
                            const target = nodes.find((node) => {
                                return node.id === id;
                            })!;
                            return (source.lane - lane) * (target.lane - nextLane) < 0;
                        });
                    });
                });
                lane = candidates[Math.floor(random() * candidates.length)] ?? lane;
                const next = this.getOrCreateNode(nodes, column, lane, random);
                if (!previous.nextNodeIds.includes(next.id)) {
                    previous.nextNodeIds.push(next.id);
                }
                previous = next;
            }
            const end = this.getOrCreateNode(nodes, columns - 1, (lanes - 1) / 2, random);
            if (!previous.nextNodeIds.includes(end.id)) {
                previous.nextNodeIds.push(end.id);
            }
        }
        const ordered = [...nodes].sort((left, right) => {
            return left.column - right.column || left.lane - right.lane;
        });
        for (const node of ordered) {
            const floor = floors[node.column];
            if (!floor) {
                throw new Error(`世界 ${realmId} 缺少第 ${node.column + 1} 列地图配置`);
            }
            const elite = node.column === columns - 1;
            const parents = nodes.filter((parent) => {
                return parent.nextNodeIds.includes(node.id);
            });
            const shopPool = (floor.shopPool ?? []).filter((id): id is number => {
                return typeof id === 'number' && !!TableShopEvent.getConfigById(id);
            });
            const shop = !elite && node.column > 0 && shopPool.length > 0
                && floor.maybeEvent.includes(EventTypeEnum.SHOP)
                && !parents.some((parent) => {
                    return parent.type === MapNodeType.Shop || parent.nextNodeIds.some((id) => {
                        return nodes.find((sibling) => {
                            return sibling.id === id;
                        })?.type === MapNodeType.Shop;
                    });
                }) && random() < shopChance;
            const fightPool = (elite ? floor.elitePool : floor.fightPool).filter((id): id is number => {
                return typeof id === 'number'
                    && !!TableEnemy.getConfigById(TableFightEvent.getConfigById(id)?.enemyId ?? 0);
            });
            const pool = shop ? shopPool : fightPool;
            if (!pool.length) {
                throw new Error(`世界 ${realmId} 第 ${node.column + 1} 列缺少有效的${elite ? '精英' : '普通战斗'}事件池`);
            }
            node.type = elite ? MapNodeType.Elite : shop ? MapNodeType.Shop : MapNodeType.Fight;
            node.eventId = shop ? EventTypeEnum.SHOP : EventTypeEnum.FIGHT;
            node.detailId = pool[Math.floor(random() * pool.length)];
        }
        return {
            realmId,
            eventIds: nodes.map((node) => {
                return node.eventId;
            }),
            eventDetailIds: nodes.map((node) => {
                return node.detailId;
            }),
            currentEventIndex: 0,
            completed: false,
            visited: true,
            mapNodes: nodes,
            currentNodeId: 0,
            visitedNodeIds: [],
        };
    }

    /** 复用同一网格点，随机偏移只影响展示，不改变路径拓扑。 */
    private static getOrCreateNode(nodes: MapNodeData[], column: number, lane: number, random: () => number) {
        const existing = nodes.find((node) => {
            return node.column === column && node.lane === lane;
        });
        if (existing) {
            return existing;
        }
        const node: MapNodeData = {
            id: nodes.length + 1,
            column,
            lane,
            offsetY: (random() - 0.5) * 0.08,
            type: MapNodeType.Fight,
            eventId: EventTypeEnum.FIGHT,
            detailId: 0,
            nextNodeIds: [],
        };
        nodes.push(node);
        return node;
    }

    /** 读取生成参数，id 为通用配置枚举，fallback 为缺省整数。 */
    private static getValue(id: UniversalNameEnum, fallback: number) {
        return Math.floor(TableUniversal.getConfigById(id)?.value ?? fallback);
    }
}

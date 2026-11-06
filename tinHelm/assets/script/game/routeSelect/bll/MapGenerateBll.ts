import { TableMap } from '../../common/table/TableMap';
import { TableMapFloor } from '../../common/table/TableMapFloor';
import { MapMapEnum } from '../../common/table/MapMapEnum';
import { TableEnemy } from '../../common/table/TableEnemy';
import { TableShopEvent } from '../../common/table/TableShopEvent';
import { EventTypeEnum } from '../../common/table/EventTypeEnum';
import { MapNodeData, MapNodeType, RealmLevelState } from '../model/RouteSelectModel';

interface MapEventChoice {
    eventId: EventTypeEnum;
    weight: number;
    pool: number[];
}

export class MapGenerateBll {
    /** 按 mapId 的列配置生成地图；realmId 保留世界进度归属，random 为随机源。 */
    static generate(realmId: number, random = Math.random, mapId = MapMapEnum.Yharnam): RealmLevelState {
        const map = TableMap.getConfigById(mapId);
        const floorIds: unknown[] = map?.mapFloorPool ?? [];
        if (!floorIds.length) {
            throw new Error(`地图 ${mapId} 缺少地图层配置`);
        }
        const nodes: MapNodeData[] = [];
        const columns = floorIds.map((id, column) => {
            const floor = typeof id === 'number' ? TableMapFloor.getConfigById(id) : null;
            if (!floor) {
                throw new Error(`地图 ${mapId} 第 ${column + 1} 列配置不存在`);
            }
            const minimum = floor.minCount ?? 1;
            const maximum = floor.maxCount ?? minimum;
            if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum)
                || minimum < 1 || maximum < minimum) {
                throw new Error(`地图层 ${floor.id} 节点数量范围无效`);
            }
            const count = minimum + Math.floor(random() * (maximum - minimum + 1));
            const choices = this.getEventChoices(floor);
            const totalWeight = choices.reduce((total, choice) => {
                return total + choice.weight;
            }, 0);
            if (!totalWeight) {
                throw new Error(`地图层 ${floor.id} 缺少有效的事件权重或事件池`);
            }
            return Array.from({ length: count }, (_, lane) => {
                let weight = random() * totalWeight;
                const choice = choices.find((item) => {
                    weight -= item.weight;
                    return weight < 0;
                }) ?? choices[choices.length - 1];
                const shop = choice.eventId === EventTypeEnum.SHOP;
                const node: MapNodeData = {
                    id: nodes.length + 1,
                    column,
                    lane,
                    offsetY: (random() - 0.5) * 0.08,
                    type: shop ? MapNodeType.Shop : column === floorIds.length - 1 ? MapNodeType.Elite : MapNodeType.Fight,
                    eventId: choice.eventId,
                    detailId: choice.pool[Math.floor(random() * choice.pool.length)],
                    nextNodeIds: [],
                };
                nodes.push(node);
                return node;
            });
        });
        columns.forEach((column, index) => {
            const next = columns[index + 1];
            if (next) {
                this.connectColumns(column, next, random);
            }
        });
        return {
            realmId,
            mapId,
            completed: false,
            mapNodes: nodes,
            currentNodeId: 0,
            visitedNodeIds: [],
        };
    }

    /** 从 floor 的事件权重及有效详情池读取可生成的战斗和商店。 */
    private static getEventChoices(floor: TableMapFloor) {
        const entries: unknown[] = floor.maybeEvent ?? [];
        const choices: MapEventChoice[] = [];
        for (const entry of entries) {
            if (!Array.isArray(entry)) {
                continue;
            }
            const [eventId, weight] = entry;
            if ((eventId !== EventTypeEnum.FIGHT && eventId !== EventTypeEnum.SHOP)
                || typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
                continue;
            }
            const rawPool: unknown[] = (eventId === EventTypeEnum.SHOP ? floor.shopPool : floor.enemyPool) ?? [];
            const pool = rawPool.filter((id): id is number => {
                if (typeof id !== 'number') {
                    return false;
                }
                return eventId === EventTypeEnum.SHOP ? !!TableShopEvent.getConfigById(id)
                    : !!TableEnemy.getConfigById(id);
            });
            if (!pool.length) {
                throw new Error(`地图层 ${floor.id} 的事件 ${eventId} 缺少有效详情`);
            }
            choices.push({ eventId, weight, pool });
        }
        return choices;
    }

    /** 为相邻列 source、target 建立全节点可达的无交叉连线，random 控制额外分支。 */
    private static connectColumns(source: MapNodeData[], target: MapNodeData[], random: () => number) {
        const steps = Math.max(source.length, target.length);
        for (const step of Array.from({ length: steps }).keys()) {
            const ratio = steps === 1 ? 0 : step / (steps - 1);
            const start = source[Math.round(ratio * (source.length - 1))];
            const end = target[Math.round(ratio * (target.length - 1))];
            if (!start.nextNodeIds.includes(end.id)) {
                start.nextNodeIds.push(end.id);
            }
        }
        for (const start of source) {
            for (const end of target) {
                if (start.nextNodeIds.includes(end.id) || random() >= 0.35) {
                    continue;
                }
                const crossing = source.some((other) => {
                    return other.nextNodeIds.some((id) => {
                        const destination = target.find((node) => {
                            return node.id === id;
                        })!;
                        return (other.lane - start.lane) * (destination.lane - end.lane) < 0;
                    });
                });
                if (!crossing) {
                    start.nextNodeIds.push(end.id);
                }
            }
        }
    }
}

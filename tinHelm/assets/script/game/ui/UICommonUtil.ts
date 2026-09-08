import { Node, UITransform, Vec3 } from 'cc';

/**
 *
 * @param worldPos 世界坐标
 * @param node 目标节点
 */
export function isWorldPosInsideNode(worldPos: Vec3, node: Node): boolean {
    const uiTransform = node.getComponent(UITransform);
    if (!uiTransform) {
        return false;
    }

    // 世界坐标 -> 节点本地坐标（以 anchor 为原点）
    const localPos = uiTransform.convertToNodeSpaceAR(worldPos);

    const width = uiTransform.width;
    const height = uiTransform.height;

    const anchorX = uiTransform.anchorX;
    const anchorY = uiTransform.anchorY;

    // Node 本地坐标下的边界
    const minX = -width * anchorX;
    const maxX = width * (1 - anchorX);

    const minY = -height * anchorY;
    const maxY = height * (1 - anchorY);

    return (
        localPos.x >= minX &&
        localPos.x <= maxX &&
        localPos.y >= minY &&
        localPos.y <= maxY
    );
}
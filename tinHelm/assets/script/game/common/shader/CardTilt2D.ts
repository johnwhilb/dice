import { _decorator, Component, EventMouse, Node, Vec2, UITransform, Sprite, Material, math } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CardHoverEffect')
export class CardHoverEffect extends Component {
    @property({ tooltip: '鼠标悬浮时的放大倍数(传给Shader)' })
    maxHoverScale: number = 1.15;

    @property({ tooltip: '最大倾斜强度(传给Shader)' })
    maxTilt: number = 0.5;

    @property({ tooltip: '动画平滑速度' })
    smoothSpeed: number = 12;

    @property({ tooltip: '必须与Shader中的baseScale保持完全一致！用于修正判定范围' })
    baseScale: number = 1.3;

    @property({ tooltip: '【新增】角色位移视差强度(像素距离)' })
    roleMoveIntensity: number = 20.0;

    // 缩放相关变量 (传递给 Shader)
    private targetScale: number = 1.0;
    private currentScale: number = 1.0;

    // 旋转倾斜相关变量 (传递给 Shader)
    private targetTilt: Vec2 = new Vec2();
    private currentTilt: Vec2 = new Vec2();

    // 【新增】角色位移相关变量
    private roleNode: Node | null = null;
    private initialRolePos: math.Vec3 = new math.Vec3();
    private targetRolePos: math.Vec3 = new math.Vec3();
    private currentRolePos: math.Vec3 = new math.Vec3();

    private uiTransform: UITransform | null = null;
    private cardMaterial: Material | null = null;
    private roleMaterial: Material | null = null;

    start() {
        this.uiTransform = this.node.getComponent(UITransform);

        // 获取当前节点上的自定义材质
        const cardSprite = this.node.getComponent(Sprite);
        this.cardMaterial = cardSprite.customMaterial;
        
        // 获取子节点和它的材质
        this.roleNode = this.node.getChildByName('spRole');
        if (this.roleNode) {
            const roleSprite = this.roleNode.getComponent(Sprite);
            this.roleMaterial = roleSprite.customMaterial;

            // 【新增】记录子节点在编辑器中的初始坐标
            this.initialRolePos = this.roleNode.getPosition().clone();
            this.currentRolePos.set(this.initialRolePos);
            this.targetRolePos.set(this.initialRolePos);
        }

        // 监听鼠标事件
        this.node.on(Node.EventType.MOUSE_MOVE, this.onMouseMove, this);
        this.node.on(Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
    }

    onMouseMove(event: EventMouse) {
        if (!this.uiTransform) return;

        // 1. 获取鼠标相对卡片中心的局部坐标
        const mousePos = event.getUILocation();
        const localPos = this.uiTransform.convertToNodeSpaceAR(new math.Vec3(mousePos.x, mousePos.y, 0));

        // 2. 【核心数学：算出真正的视觉边界】
        const visualHalfWidth = (this.uiTransform.width / 2) / this.baseScale;
        const visualHalfHeight = (this.uiTransform.height / 2) / this.baseScale;

        // 3. 【精准判定】：判断鼠标是否在“视觉可见”的范围内
        if (Math.abs(localPos.x) <= visualHalfWidth && Math.abs(localPos.y) <= visualHalfHeight) {
            // --- 鼠标在卡牌画面内 ---
            this.targetScale = this.maxHoverScale;

            const xOffset = localPos.x / visualHalfWidth;
            const yOffset = localPos.y / visualHalfHeight;

            this.targetTilt.x = yOffset * this.maxTilt;
            this.targetTilt.y = -xOffset * this.maxTilt; 

            // 【新增】根据鼠标位置计算角色的目标位移（追随鼠标）
            this.targetRolePos.x = this.initialRolePos.x + xOffset * this.roleMoveIntensity;
            this.targetRolePos.y = this.initialRolePos.y + yOffset * this.roleMoveIntensity;
        } else {
            // --- 鼠标在物理框内，但在透明安全区（假装已经离开了） ---
            this.targetScale = 1.0;
            this.targetTilt.set(0, 0);
            this.targetRolePos.set(this.initialRolePos); // 【新增】恢复位置
        }
    }

    onMouseLeave() {
        // 鼠标彻底离开节点物理框时，恢复原状
        this.targetScale = 1.0;
        this.targetTilt.set(0, 0);
        this.targetRolePos.set(this.initialRolePos); // 【新增】恢复位置
    }

    update(dt: number) {
        // 平滑插值
        this.currentScale = math.lerp(this.currentScale, this.targetScale, dt * this.smoothSpeed);
        Vec2.lerp(this.currentTilt, this.currentTilt, this.targetTilt, dt * this.smoothSpeed);
        
        // 【新增】角色位移的平滑插值并应用
        if (this.roleNode) {
            math.Vec3.lerp(this.currentRolePos, this.currentRolePos, this.targetRolePos, dt * this.smoothSpeed);
            this.roleNode.setPosition(this.currentRolePos);
        }

        // 传给 Shader
        if (this.cardMaterial) {
            this.cardMaterial.setProperty('hoverScale', this.currentScale);
            this.cardMaterial.setProperty('tilt', this.currentTilt);
        }
        if (this.roleMaterial) {
            this.roleMaterial.setProperty('hoverScale', this.currentScale);
            this.roleMaterial.setProperty('tilt', this.currentTilt);
        }
    }
}
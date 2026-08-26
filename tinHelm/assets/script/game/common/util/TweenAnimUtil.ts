import { tween, Node, Vec3 } from "cc";

export class TweenAnimUtil {

    private static playing = new WeakSet<Node>();

    static move(
        node: Node,
        x: number,
        y: number,
        duration = 0.5,
        complete?: () => void
    ) {
        if (this.playing.has(node)) {
            return;
        }

        this.playing.add(node);

        const start = node.position.clone();

        const target = new Vec3(
            start.x + x,
            start.y + y,
            start.z
        );

        // Anticipation：运动前先向反方向轻微蓄力
        const anticipation = new Vec3(
            start.x - x * 0.08,
            start.y - y * 0.08,
            start.z
        );

        tween(node)

            // 预备动作
            .to(
                0.08,
                {
                    position: anticipation
                },
                {
                    easing: "sineOut"
                }
            )

            // 主运动
            .to(
                duration,
                {
                    position: target
                },
                {
                    easing: "backOut"
                }
            )

            .call(() => {
                this.playing.delete(node);
                complete?.();
            })

            .start();
    }
}
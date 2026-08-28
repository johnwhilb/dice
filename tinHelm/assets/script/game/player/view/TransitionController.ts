import {
    _decorator,
    Component,
    Node,
    Sprite,
    UITransform,
    Vec2,
    Vec4,
    MaterialInstance,
    director,
    tween,
    Tween,
    Event,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('TransitionController')
export class TransitionController extends Component {
    public static instance: TransitionController | null = null;

    @property({ type: Node, tooltip: 'Full-screen Sprite using transition.mtl' })
    public overlay: Node | null = null;

    @property({ tooltip: 'Close duration in seconds' })
    public closeDuration = 0.48;

    @property({ tooltip: 'Open duration in seconds' })
    public openDuration = 0.58;

    @property({ tooltip: 'Tile size in UI units. Use 200 for a 200x200 tile.' })
    public tileSize = 200;

    @property({ tooltip: 'Softness of the circular aperture edge' })
    public feather = 0.015;

    @property({ tooltip: 'Width of the accent ring on the aperture edge' })
    public edgeWidth = 0.012;

    @property({ type: Vec2, tooltip: 'Tile scrolling speed, in tiles / second' })
    public scrollSpeed = new Vec2(-0.28, -0.18);

    private _sprite: Sprite | null = null;
    private _material: MaterialInstance | null = null;

    private _running = false;
    private _offsetX = 0;
    private _offsetY = 0;

    private _animState = { value: 1 };
    private _nodeSize = new Vec4(1080, 1920, 0, 0);
    private _animParams = new Vec4(1, 200, 0.015, 0.012);
    private _offsetParams = new Vec4(0, 0, 0, 0);

    protected onLoad(): void {
        if (
            TransitionController.instance &&
            TransitionController.instance !== this
        ) {
            this.node.destroy();
            return;
        }

        TransitionController.instance = this;

        // This node must be a root-level scene node, as required by Cocos.
        if (!director.isPersistRootNode(this.node)) {
            director.addPersistRootNode(this.node);
        }

        if (!this.overlay) {
            console.error('[TransitionController] overlay is not assigned.');
            return;
        }

        this._sprite = this.overlay.getComponent(Sprite);
        if (!this._sprite) {
            console.error('[TransitionController] overlay needs a Sprite component.');
            return;
        }

        this._material = this._sprite.getMaterialInstance(0);
        if (!this._material) {
            console.error(
                '[TransitionController] overlay needs a custom material using transition.effect.'
            );
            return;
        }

        this._syncShaderParams();
        this.overlay.active = true;
        this._setProgress(0.0);
    }

    protected onDestroy(): void {
        if (TransitionController.instance === this) {
            TransitionController.instance = null;
        }
        Tween.stopAllByTarget(this._animState);
    }

    protected update(dt: number): void {
        if (!this.overlay?.active || !this._material) return;

        // Keep the values bounded to avoid precision loss during long sessions.
        this._offsetX = this._wrap01(this._offsetX + dt * this.scrollSpeed.x);
        this._offsetY = this._wrap01(this._offsetY + dt * this.scrollSpeed.y);

        this._offsetParams.set(this._offsetX, this._offsetY, 0, 0);
        this._material.setProperty('offsetParams', this._offsetParams);
    }

    /**
     * Main API.
     * Example:
     *   await TransitionController.instance?.transitionTo('RoleSelect');
     */
    public async transitionTo(sceneName: string): Promise<void> {
        if (this._running || !this.overlay || !this._material) return;

        this._running = true;
        this.overlay.active = true;
        this._syncShaderParams();
        this._setProgress(1.0);

        try {
            // Same sequencing principle as the referenced article:
            // scene preloading and the closing animation run in parallel.
            // The switch happens only after BOTH are complete.
            const preloadResult = await Promise.all([
                this._preloadScene(sceneName)
                    .then(() => null)
                    .catch((err) => err as Error),
                this._animateProgress(1.0, 0.0, this.closeDuration),
            ]);

            const preloadError = preloadResult[0];
            if (preloadError) {
                throw preloadError;
            }

            // The old scene is now completely hidden by the tile overlay.
            await this._loadScene(sceneName);

            // Reveal the new scene.
            await this._animateProgress(0.0, 1.0, this.openDuration);
        } catch (err) {
            console.error(`[TransitionController] transition to "${sceneName}" failed`, err);

            // Recover gracefully: reveal whichever scene is currently active.
            await this._animateProgress(
                this._animState.value,
                1.0,
                Math.min(0.3, this.openDuration),
            );
        } finally {
            if (this.overlay) this.overlay.active = false;
            this._running = false;
        }
    }

    /**
     * Optional helper for Button -> ClickEvents.
     * Put the target scene name into CustomEventData.
     */
    public onClickTransition(_event: Event, sceneName: string): void {
        void this.transitionTo(sceneName);
    }

    private _preloadScene(sceneName: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            director.preloadScene(sceneName, (err?: Error | null) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    private _loadScene(sceneName: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const accepted = director.loadScene(
                sceneName,
                (err?: Error | null) => {
                    if (err) reject(err);
                    else resolve();
                },
            );

            if (!accepted) {
                reject(new Error(`director.loadScene("${sceneName}") returned false.`));
            }
        });
    }

    private _animateProgress(
        from: number,
        to: number,
        duration: number,
    ): Promise<void> {
        Tween.stopAllByTarget(this._animState);

        this._animState.value = from;
        this._setProgress(from);

        return new Promise<void>((resolve) => {
            tween(this._animState)
                .to(
                    Math.max(duration, 0.001),
                    { value: to },
                    {
                        easing: 'cubicInOut',
                        onUpdate: () => {
                            this._setProgress(this._animState.value);
                        },
                    },
                )
                .call(() => {
                    this._animState.value = to;
                    this._setProgress(to);
                    resolve();
                })
                .start();
        });
    }

    private _syncShaderParams(): void {
        if (!this.overlay || !this._material) return;

        const transform = this.overlay.getComponent(UITransform);
        if (!transform) {
            console.error('[TransitionController] overlay needs UITransform.');
            return;
        }

        const size = transform.contentSize;
        this._nodeSize.set(
            Math.max(size.width, 1),
            Math.max(size.height, 1),
            0,
            0,
        );

        this._material.setProperty('nodeSize', this._nodeSize);

        // Keep the current progress while refreshing static parameters.
        this._animParams.set(
            this._animState.value,
            this.tileSize,
            this.feather,
            this.edgeWidth,
        );
        this._material.setProperty('animParams', this._animParams);
    }

    private _setProgress(value: number): void {
        if (!this._material) return;

        const p = Math.max(0, Math.min(1, value));
        this._animState.value = p;

        this._animParams.set(
            p,
            this.tileSize,
            this.feather,
            this.edgeWidth,
        );
        this._material.setProperty('animParams', this._animParams);
    }

    private _wrap01(v: number): number {
        v %= 1.0;
        return v < 0 ? v + 1.0 : v;
    }
}

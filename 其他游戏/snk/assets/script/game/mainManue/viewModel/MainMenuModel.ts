import { ecs } from 'db://oops-framework/libs/ecs/ECS';

@ecs.register('MainMenuModel')
export class MainMenuModel extends ecs.Comp {
    readonly menuMusicPaths = [
        'audios/Kubbi - Ember - 01 Pathfinder',
        'audios/Kubbi - Ember - 02 Ember',
        'audios/Kubbi - Ember - 03 Firelight',
        'audios/Kubbi - Ember - 04 Cascade',
        'audios/Kubbi - Ember - 05 Compass'
    ];
    musicEnabled = true;
    effectEnabled = true;

    /** 重置主菜单音频展示状态，实际设置由框架音频管理器保存。 */
    reset() {
        this.musicEnabled = true;
        this.effectEnabled = true;
    }
}

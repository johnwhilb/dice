import { ecs } from 'db://oops-framework/libs/ecs/ECS';


@ecs.register('ProfileAvatarModel')
export class ProfileAvatarModel extends ecs.Comp {
    currentSelectedAvatarId: number = 1001;
    currentSelectAvatarId: number = 1001;

    unlockedAvatarIds: number[] = [];

    reset() {
        this.currentSelectedAvatarId = 0;
        this.currentSelectAvatarId = 0;
        this.unlockedAvatarIds.length = 0;
    }


}
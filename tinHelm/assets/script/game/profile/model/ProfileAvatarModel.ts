import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { TableRole } from '../../common/table/TableRole';


@ecs.register('ProfileAvatarModel')
export class ProfileAvatarModel extends ecs.Comp {
    currentSelectedAvatarId: number = TableRole.createId(1);
    currentSelectAvatarId: number = TableRole.createId(1);

    unlockedAvatarIds: number[] = [];

    reset() {
        this.currentSelectedAvatarId = TableRole.createId(1);
        this.currentSelectAvatarId = TableRole.createId(1);
        this.unlockedAvatarIds.length = 0;
    }


}

import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { ProfileDialog } from './view/ProfileDialog';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { ProfileAvatarModel } from './model/ProfileAvatarModel';
import { ProfileAvatarBll } from './bll/ProfileAvatarBll';
import { ProfileEvent } from './ProfileEvent';

@ecs.register('Profile')
export class Profile extends CCEntity {

    ProfileDialog!: ProfileDialog
    ProfileAvatarModel!: ProfileAvatarModel
    ProfileAvatarBll!: ProfileAvatarBll

    init(): void {
        this.addBusinesss(ProfileAvatarBll);
        this.addComponents(ProfileAvatarModel);
    }

    open() {
        if (this.has(ProfileDialog)) {
            return Promise.resolve(this.ProfileDialog.node);
        }
        this.addUi(ProfileDialog);
    }

    getCurrentSelectedAvatarId() {
        return this.ProfileAvatarModel.currentSelectedAvatarId;
    }
    getCurrentSelectAvatarId() {
        return this.ProfileAvatarModel.currentSelectAvatarId;
    }

    changeCurrentSelectedAvatarId() {
        this.ProfileAvatarBll.changeCurrentSelectedAvatarId();
    }

    changeCurrentSelectAvatarId(avatarId: number) {
        this.ProfileAvatarBll.changeCurrentSelectAvatarId(avatarId);
    }


    close() {
        if (this.has(ProfileDialog)) {
            this.removeUi(ProfileDialog);
        }
    }
}
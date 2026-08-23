import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';

import { Profile } from '../Profile';
import { ProfileEvent } from '../ProfileEvent';

export class ProfileAvatarBll extends CCBusiness<Profile> {


    changeAvatar(id: number) {

    }

    unlockAvatar(id: number) {

    }

    getCurrentSelectedAvatarId() {
        return this.ent.ProfileAvatarModel.currentSelectedAvatarId;
    }

    getCurrentSelectAvatarId() {
        return this.ent.ProfileAvatarModel.currentSelectAvatarId;
    }

    changeCurrentSelectedAvatarId() {
        this.ent.ProfileAvatarModel.currentSelectedAvatarId = this.ent.ProfileAvatarModel.currentSelectAvatarId;
        this.dispatchEvent(ProfileEvent.currentSelectedAvatarIdChanged, this.ent.ProfileAvatarModel.currentSelectAvatarId);
    }
    changeCurrentSelectAvatarId(avatarId: number) {
        this.ent.ProfileAvatarModel.currentSelectAvatarId = avatarId;
        this.dispatchEvent(ProfileEvent.currentSelectAvatarIdChanged, avatarId);
    }



}
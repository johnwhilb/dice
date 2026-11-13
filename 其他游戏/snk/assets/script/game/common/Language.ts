import { oops } from 'db://oops-framework/core/Oops';

export function lang(key: string) {
    return oops.language.getLangByID(key);
}

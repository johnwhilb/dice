import { _decorator, Component, Node } from 'cc';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Save } from '../Save';
const { ccclass, property } = _decorator;

@ccclass('B_Save')
export class B_Save extends CCBusiness<Save> {

}



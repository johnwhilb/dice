import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { TableUnknownEvent } from '../common/table/TableUnknownEvent';
import { TableUnknownEventSelect } from '../common/table/TableUnknownEventSelect';
import { UnknownEvent } from './UnknownEvent';

export class UnknownEventBll extends CCBusiness<UnknownEvent> {
    /** 根据事件 ID 加载未知事件及其选项，缺失的选项配置跳过并提示。 */
    prepare(eventId: number) {
        const event = TableUnknownEvent.getConfigById(eventId);
        const model = this.ent.UnknownEventModel;
        model.reset();
        if (!event) {
            return null;
        }

        model.eventId = event.id;
        const optionIds: unknown[] = event.selects ?? [];
        for (const optionId of optionIds) {
            const option = typeof optionId === 'number'
                ? TableUnknownEventSelect.getConfigById(optionId) : null;
            if (!option) {
                console.warn('未知事件选项配置不存在', { eventId, optionId });
                continue;
            }
            model.options.push(option);
        }
        return event;
    }

    /** 读取当前模型记录的未知事件配置，无有效事件时返回空值。 */
    getCurrentEvent() {
        return TableUnknownEvent.getConfigById(this.ent.UnknownEventModel.eventId);
    }

    /** 校验选项 ID 属于当前事件后，仅输出选项信息。 */
    selectOption(optionId: number) {
        const model = this.ent.UnknownEventModel;
        const option = model.options.find((item) => {
            return item.id === optionId;
        });
        if (!option) {
            return;
        }
        console.log('未知事件选项点击', {
            eventId: model.eventId,
            optionId: option.id,
            selectName: option.selectName ?? '',
            selectDes: option.selectDes ?? '',
        });
    }
}

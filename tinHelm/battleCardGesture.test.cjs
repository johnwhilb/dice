/* 回归：Cocos 3.8 将节点范围外的松手派发为 TOUCH_CANCEL，但原始事件仍为 TOUCH_END。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(process.env.COCOS_TYPESCRIPT || 'typescript');
const cards = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets/bundle/config/game/2_Card.json'), 'utf8'));
const events = { TOUCH_START: 'touch-start', TOUCH_MOVE: 'touch-move', TOUCH_END: 'touch-end', TOUCH_CANCEL: 'touch-cancel' };
class Vec3 {
    constructor(x = 0, y = 0, z = 0) {
        this.set(x, y, z);
    }
    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}
const cc = {
    _decorator: { ccclass() {
        return type => type;
    }, property() {
        return () => {};
    } },
    Vec3, Node: { EventType: events }
};
const imports = {
    CCView: class {}, LayerType: { UI: 0 },
    ecs: { register() {
        return type => type;
    } },
    gui: { register() {
        return type => type;
    } },
    BattlePhase: { PlayerAction: 3, PlayerRollDice: 2 },
    TableCard: { getConfigById(id) {
        return cards[id] || null;
    } }
};
const sourcePath = path.join(__dirname, 'assets/script/game/battle/view/BattleView.ts');
const output = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true }
}).outputText;
const viewModule = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: sourcePath })(name => {
    return name === 'cc' ? cc : imports;
}, viewModule, viewModule.exports);

function setup(cardId = 20001) {
    const view = new viewModule.exports.BattleView();
    const played = [];
    const hits = [];
    const nodes = {
        nodeGraphView: { getComponent() {
            return { reset() {} };
        } }
    };
    for (const name of ['spRole', 'spEnemy']) {
        nodes[name] = { getComponent() {
            return { hitTest(position, windowId) {
                hits.push({ name, position, windowId });
                return position.target === name;
            } };
        } };
    }
    view.getNode = name => nodes[name];
    view.ent = {
        BattleModel: { busy: false, phase: 3 },
        BattlePlayerModel: { handCards: [cardId] },
        BattleCardBll: { async play(index) {
            played.push(index);
        } }
    };
    const listeners = new Map();
    const card = { on(name, callback, owner) {
        listeners.set(name, callback.bind(owner));
    }, async fire(name, event) {
        await listeners.get(name)(event);
    } };
    view.bindCardGesture(card, 0);
    return { view, card, played, hits };
}
function touch(originalType, target = 'spEnemy', id = 1) {
    return { windowId: 7, getID() {
        return id;
    }, getUILocation() {
        return { x: 10, y: 20 };
    }, getLocation() {
        return { x: 800, y: 450, target };
    }, getEventCode() {
        return originalType;
    } };
}
async function run() {
    // 敌方攻击牌和自身防御牌：移出原卡后松手都应出牌。
    for (const [cardId, target] of [[20001, 'spEnemy'], [20002, 'spRole']]) {
        const { card, played, hits } = setup(cardId);
        await card.fire(events.TOUCH_START, touch(events.TOUCH_START));
        await card.fire(events.TOUCH_CANCEL, touch(events.TOUCH_END, target));
        assert.deepEqual(played, [0]);
        assert.deepEqual(hits, [{ name: target, position: { x: 800, y: 450, target }, windowId: 7 }]);
        await card.fire(events.TOUCH_END, touch(events.TOUCH_END, target));
        assert.deepEqual(played, [0], '重复结束事件不能重复出牌');
    }
    for (const target of ['spEnemy', 'spRole']) {
        const { card, played } = setup(target === 'spEnemy' ? 20001 : 20002);
        await card.fire(events.TOUCH_START, touch(events.TOUCH_START));
        await card.fire(events.TOUCH_CANCEL, touch(events.TOUCH_CANCEL, target));
        assert.deepEqual(played, [], '系统取消或节点销毁不能出牌');
    }
    const wrongTarget = setup();
    await wrongTarget.card.fire(events.TOUCH_START, touch(events.TOUCH_START));
    await wrongTarget.card.fire(events.TOUCH_CANCEL, touch(events.TOUCH_END, 'spRole'));
    assert.deepEqual(wrongTarget.played, []);

    const multitouch = setup();
    await multitouch.card.fire(events.TOUCH_START, touch(events.TOUCH_START));
    await multitouch.card.fire(events.TOUCH_START, touch(events.TOUCH_START, 'spEnemy', 2));
    await multitouch.card.fire(events.TOUCH_CANCEL, touch(events.TOUCH_END, 'spEnemy', 2));
    assert.deepEqual(multitouch.played, []);
    await multitouch.card.fire(events.TOUCH_CANCEL, touch(events.TOUCH_END));
    assert.deepEqual(multitouch.played, [0]);

    const busy = setup();
    busy.view.ent.BattleModel.busy = true;
    await busy.card.fire(events.TOUCH_START, touch(events.TOUCH_START));
    await busy.card.fire(events.TOUCH_CANCEL, touch(events.TOUCH_END));
    assert.deepEqual(busy.played, []);

    const stale = setup();
    await stale.card.fire(events.TOUCH_START, touch(events.TOUCH_START));
    stale.view.cancelCardGesture();
    await stale.card.fire(events.TOUCH_CANCEL, touch(events.TOUCH_END));
    assert.deepEqual(stale.played, [], '手牌刷新后旧拖动不能提交');
    console.log('通过：敌人/自身拖牌、屏幕坐标命中、真实取消、错目标、重复松手、多指隔离与刷新清理。');
}
run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

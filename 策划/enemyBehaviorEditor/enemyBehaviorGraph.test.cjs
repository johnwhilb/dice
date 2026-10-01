const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

async function run() {
    const elements = new Map();
    const handlers = new Map();
    const windowHandlers = new Map();
    const element = id => {
        if (!elements.has(id)) {
            elements.set(id, {
                value: '1', textContent: '', innerHTML: '', hidden: false, style: {},
                classList: { toggle() {}, remove() {} },
                addEventListener(name, callback) { handlers.set(`${id}:${name}`, callback); },
                getBoundingClientRect() { return id === 'graphViewport'
                    ? { left: 100, top: 100, right: 900, bottom: 700 }
                    : { left: 100, top: 100, right: 1100, bottom: 720 }; },
                querySelector() { return { style: {} }; }
            });
        }
        return elements.get(id);
    };
    const context = vm.createContext({
        document: { getElementById: element, addEventListener() {}, elementFromPoint() { return null; } },
        window: { addEventListener(name, callback) { windowHandlers.set(name, callback); } },
        setTimeout,
        fetch: async () => ({ ok: true, json: async () => ({
            revision: 'test', enemies: [{ id: 50001, name: '测试敌人', originHp: 30,
                behavior: { type: 'ACTION', action: 'ATTACK', amount: 5, hits: 1 } }]
        }) }),
        confirm: () => true,
        console
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'enemyBehaviorGraph.js'), 'utf8'), context);
    await new Promise(resolve => setImmediate(resolve));
    const result = vm.runInContext(`
        const original = currentEnemy().behavior;
        addNode('SELECTOR', 100, 100);
        const selector = looseNodes()[0];
        setRoot(selector.editorId);
        const first = looseNodes()[0];
        connectNodes(selector.editorId, first.editorId);
        addNode('ACTION', 420, 100);
        const second = looseNodes()[0];
        connectNodes(selector.editorId, second.editorId);
        moveSibling(second.editorId, -1);
        const ordered = currentEnemy().behavior.children[0] === second;
        addNode('SEQUENCE', 420, 300);
        const sequence = looseNodes()[0];
        connectNodes(selector.editorId, sequence.editorId);
        const blockedCycle = !connectNodes(sequence.editorId, selector.editorId);
        disconnectNode(second.editorId);
        const disconnected = looseNodes().includes(second);
        ({ ordered, blockedCycle, disconnected, childCount: selector.children.length,
            preview: selectActions(selector, { TURN: 1 })[0].action,
            originalId: original.editorId, firstId: first.editorId });
    `, context);
    assert(result.ordered);
    assert(result.blockedCycle);
    assert(result.disconnected);
    assert.strictEqual(result.childCount, 2);
    assert.strictEqual(result.preview, 'ATTACK');
    assert.strictEqual(result.originalId, result.firstId);
    const beforeDrag = vm.runInContext('allNodes().length', context);
    const palette = { dataset: { palette: 'ACTION' }, textContent: '执行行动' };
    handlers.get('graphPalette:pointerdown')({
        target: { closest() { return palette; } }, clientX: 40, clientY: 140, preventDefault() {}
    });
    windowHandlers.get('pointermove')({ clientX: 420, clientY: 250 });
    windowHandlers.get('pointerup')({ clientX: 420, clientY: 250 });
    assert.strictEqual(vm.runInContext('allNodes().length', context), beforeDrag + 1);
    assert.strictEqual(vm.runInContext('looseNodes().at(-1).editorX', context), 290);
    console.log('通过：Excel 加载、实际指针拖入、连接、排序、循环保护、断开及预览。');
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

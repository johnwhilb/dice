const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function run() {
    const filename = path.join(__dirname, '..', 'excel', '5_Enemy.xlsx');
    const files = new Map([[filename, fs.readFileSync(filename)]]);
    const memory = {
        readFile: async name => Buffer.from(files.get(name)),
        writeFile: async (name, content) => files.set(name, Buffer.from(content)),
        copyFile: async (from, to) => files.set(to, Buffer.from(files.get(from))),
        rename: async (from, to) => {
            files.set(to, files.get(from));
            files.delete(from);
        }
    };
    const sandbox = {
        require: name => name === 'fs' ? { promises: memory } : require(name),
        module: { exports: {} }, __dirname, Buffer, URL, console
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'enemyBehaviorEditorServer.cjs'), 'utf8'), sandbox);
    const api = sandbox.module.exports;
    const data = await api.readTables();
    assert(data.enemies.length >= 1);
    assert.strictEqual(data.enemies[0].behavior.action, 'ATTACK');
    assert.throws(() => api.validateBehavior({ type: 'ACTION', action: 'SUMMON' }), /行动类型/);
    assert.throws(() => api.validateBehavior({ type: 'CONDITION', field: 'TURN', operator: '<', value: 2, children: [] }), /子节点/);
    api.validateBehavior({ type: 'CYCLE', children: [
        { type: 'ACTION', action: 'ATTACK', amount: 5, hits: 2 },
        { type: 'ACTION', action: 'ADD_CARD', cardId: 20001, count: 1, pile: 'DISCARD' },
        { type: 'ACTION', action: 'EFFECTS', effects: [
            { type: 'DAMAGE', target: 'ENEMY', params: { amount: 8, hits: 2 } },
            { type: 'APPLY_STATUS', target: 'ENEMY', params: { status: 'WEAK', stacks: 1 } }
        ] }
    ] });
    assert.throws(() => api.validateBehavior({ type: 'ACTION', action: 'EFFECTS', effects: [
        { type: 'SUMMON', params: { id: 50002 } }
    ] }), /未支持/);
    assert.throws(() => api.validateBehavior({ type: 'CONDITION', field: 'TURN_MOD', modulus: 0,
        operator: '==', value: 0, children: [{ type: 'ACTION', action: 'WAIT' }] }), /条件节点/);
    const enemy = { ...data.enemies[0], behavior: { type: 'SELECTOR', children: [
        { type: 'CONDITION', field: 'SELF_HP_PERCENT', operator: '<=', value: 50, children: [{ type: 'ACTION', action: 'HEAL', amount: 8 }] },
        { type: 'ACTION', action: 'ATTACK', amount: 7, hits: 2 }
    ] } };
    await assert.rejects(api.saveEnemies({ revision: 'stale', enemies: [enemy] }), /外部修改/);
    await api.saveEnemies({ revision: data.revision, enemies: [enemy] });
    const saved = await api.readTables();
    assert.strictEqual(saved.enemies[0].behavior.children[1].hits, 2);
    assert(files.has(filename + '.editor-backup'));
    console.log('通过：敌人行为树真实 XLSX 解析、校验、回读、并发冲突、备份。');
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

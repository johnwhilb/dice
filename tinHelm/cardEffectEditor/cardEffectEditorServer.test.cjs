const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function run() {
    // 使用真实工作簿内容与内存文件系统验证回写，不触碰项目原表。
    const files = new Map();
    for (const name of ['1_Role', '2_Card', '3_Dice']) {
        const filename = path.join(__dirname, '..', 'excel', name + '.xlsx');
        files.set(filename, fs.readFileSync(filename));
    }
    const memory = {
        readFile: async filename => Buffer.from(files.get(filename)),
        writeFile: async (filename, content) => files.set(filename, Buffer.from(content)),
        copyFile: async (from, to) => files.set(to, Buffer.from(files.get(from))),
        rename: async (from, to) => {
            files.set(to, files.get(from));
            files.delete(from);
        }
    };
    const sandbox = {
        require: name => name === 'fs' ? {promises:memory} : require(name),
        module: {exports:{}}, __dirname, Buffer, URL, console
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'cardEffectEditorServer.cjs'), 'utf8'), sandbox);
    const api = sandbox.module.exports;
    const data = await api.readTables();
    assert.strictEqual(data.roles.length, 3);
    assert.strictEqual(data.cards.length, 9);
    assert.strictEqual(data.dice.length, 12);
    const cards = data.cards.map(card => ({...card, target:'SELF', effect:[], flags:{}, type:'SKILL', up_id:null}));
    assert.throws(() => api.validateCards(cards, data), /20007/);
    cards.find(card => card.id === 20007).DiceNeed = [30011, 30009];
    api.validateCards(cards, data);
    const first = cards[0];
    first.DiceNeed = Array(6).fill(30001);
    assert.throws(() => api.validateCards(cards, data), /最多 5 个/);
    first.DiceNeed = Array(5).fill(30001);
    first.level = 4;
    assert.throws(() => api.validateCards(cards, data), /等级/);
    first.level = 3;
    first.price = 42;
    first.target = 'ALL_ENEMIES';
    assert.throws(() => api.validateCards(cards, data), /目标/);
    first.target = 'ENEMY';
    first.effect = [{id:'test', type:'DAMAGE', target:'ENEMY', params:{amount:8}}];
    cards.push({...first, id:20010, name:'测试新增'});
    cards.splice(1, 1);
    await assert.rejects(api.saveCards({revision:'stale', cards}), /外部修改/);
    await api.saveCards({revision:data.revision, cards});
    const saved = await api.readTables();
    assert.strictEqual(saved.cards.length, 9);
    assert(!saved.cards.some(card => card.id === 20002));
    assert(saved.cards.some(card => card.id === 20010));
    assert.strictEqual(saved.cards[0].price, 42);
    assert.strictEqual(saved.cards[0].level, 3);
    assert.strictEqual(saved.cards[0].DiceNeed.length, 5);
    assert.strictEqual(saved.cards[0].effect[0].params.amount, 8);
    assert.strictEqual(saved.cards[0].target, 'ENEMY');
    assert.strictEqual(saved.cards[0].up_id, null);
    assert(files.has(path.join(__dirname, '..', 'excel', '2_Card.xlsx.editor-backup')));
    assert.notStrictEqual(saved.revision, data.revision);
    await api.saveCards({revision:saved.revision, cards:[]});
    assert.strictEqual((await api.readTables()).cards.length, 0);
    console.log('通过：真实 XLSX 解析、角色骰子校验、5 个上限、等级/目标校验、并发冲突、增删改回读、空表保存、备份。');
}
run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

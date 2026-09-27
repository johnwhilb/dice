/* 使用 Cocos 自带 TypeScript 转译业务代码，在无引擎环境验证真实配置与战斗状态。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(process.env.COCOS_TYPESCRIPT || 'typescript');
const root = __dirname;
const cache = new Map();
const config = {};
for (const name of ['1_Role', '2_Card', '3_Dice', '5_Enemy']) {
    config[name] = JSON.parse(fs.readFileSync(path.join(root, 'assets/bundle/config/game', `${name}.json`), 'utf8'));
}
const smc = { player: { PlayerModel: {}, getSelectedRoleId() {
    return this.PlayerModel.roleId;
} } };
class Business {
    dispatchEvent() {
        if (this.ent.onRefresh) {
            this.ent.onRefresh();
        }
    }
}
function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) {
        return cache.get(file).exports;
    }
    const module = { exports: {} };
    cache.set(file, module);
    const source = fs.readFileSync(file, 'utf8');
    const output = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true }
    }).outputText;
    const localRequire = name => {
        if (name.includes('CCBusiness')) {
            return { CCBusiness: Business };
        }
        if (name.includes('/ecs/ECS')) {
            return { ecs: { Comp: class {}, register() {
                return target => target;
            } } };
        }
        if (name.endsWith('SingletonModuleComp')) {
            return { smc };
        }
        if (name.includes('/table/Table')) {
            const table = name.split('/').pop();
            const tables = { TableRole: '1_Role', TableCard: '2_Card', TableDice: '3_Dice', TableEnemy: '5_Enemy' };
            const data = config[tables[table]];
            return { [table]: { getConfigById(id) {
                return data[id] ? { id, ...data[id] } : null;
            }, createId(id) {
                return Number(tables[table].split('_')[0]) * 10000 + id;
            } } };
        }
        return load(path.resolve(path.dirname(file), `${name}.ts`));
    };
    vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: file })(localRequire, module, module.exports);
    return module.exports;
}
const battlePath = 'assets/script/game/battle/';
const { BattlePhase } = load(`${battlePath}model/BattleModel.ts`);
const { BattleSide } = load(`${battlePath}model/BattleTypes.ts`);
function create(roleId = 10001) {
    const role = config['1_Role'][roleId];
    smc.player.PlayerModel = { roleId, hp: 100, maxHp: 100, handCard: [...role.originCards], gold: 0 };
    const ent = {};
    for (const name of ['BattleModel', 'BattlePlayerModel', 'BattleEnemyModel']) {
        const Type = load(`${battlePath}model/${name}.ts`)[name];
        ent[name] = new Type();
    }
    for (const name of ['BattleBll', 'BattlePlayerBll', 'BattleEnemyBll', 'BattleDiceBll', 'BattleCardBll',
        'BattleEffectBll', 'BattleValueResolver', 'BattleDamageBll', 'BattleBuffBll', 'BattleTriggerBll']) {
        const Type = load(`${battlePath}bll/${name}.ts`)[name];
        ent[name] = new Type();
        ent[name].ent = ent;
    }
    ent.initBattleSceneInfo = () => {
        ent.BattleBll.generateEnemy();
        ent.BattleEnemyBll.initEnemy();
        ent.BattlePlayerBll.initPlayer();
    };
    ent.onRefresh = () => {
        const choice = ent.BattleModel.choice;
        if (choice && ent.autoChoose !== false) {
            ent.BattleEffectBll.select(0);
        }
    };
    return ent;
}
async function ready(role = 10001) {
    const ent = create(role);
    await ent.BattleBll.start();
    assert.equal(ent.BattleModel.message, '');
    ent.BattleBll.finishRoll();
    return ent;
}
async function run() {
    let ent = await ready();
    let player = ent.BattlePlayerModel;
    assert.equal(player.handCards.length, 5);
    assert.equal(player.drawPile.length, 5);
    assert.equal(player.energy, 3);
    assert.equal(player.rerolls, 2);
    const locked = player.dice[0];
    ent.BattleDiceBll.lockDice(0);
    assert.equal(ent.BattleBll.reroll(), true);
    assert.equal(player.dice[0], locked);
    assert.equal(ent.BattleBll.reroll(), false);
    ent.BattleBll.finishRoll();
    assert.equal(ent.BattleBll.reroll(), true);
    ent.BattleBll.finishRoll();
    assert.equal(ent.BattleBll.reroll(), false);
    player.handCards = [20007];
    player.dice = [6, 2, 1, 4, 5];
    assert.equal(ent.BattleCardBll.canPlay(0), false);
    player.dice[4] = 6;
    assert.equal(ent.BattleCardBll.canPlay(0), true);

    player.handCards = [20001];
    player.drawPile = [20002];
    player.discardPile = [];
    player.dice = [1];
    ent.BattleEnemyModel.hp = 100;
    await ent.BattleCardBll.play(0);
    assert.equal(ent.BattleEnemyModel.hp, 94);
    assert.equal(player.energy, 2);
    assert.deepEqual(player.handCards, [20002]);
    assert.deepEqual(player.discardPile, [20001]);
    assert.deepEqual(player.dice, [1]);
    player.handCards = [20001];
    player.energy = 0;
    player.drawPile = [20002];
    await ent.BattleCardBll.play(0);
    assert.equal(ent.BattleEnemyModel.hp, 88);
    assert.equal(player.drawPile.length, 1);
    assert.equal(player.handCards.length, 0);
    player.handCards = [20001];
    player.energy = 3;
    player.drawPile = [];
    await ent.BattleCardBll.play(0);
    assert.equal(player.energy, 3);
    assert.equal(player.drawPile.length, 0);
    await ent.BattleBll.endTurn();
    assert.equal(ent.BattleModel.turn, 2);
    assert.equal(player.energy, 3);
    assert.equal(player.rerolls, 2);
    assert.equal(player.handCards.length, 3);

    ent = await ready();
    player = ent.BattlePlayerModel;
    ent.BattleBuffBll.add(BattleSide.Player, 'STRENGTH', 2);
    ent.BattleBuffBll.add(BattleSide.Player, 'WEAK', 2);
    ent.BattleBuffBll.add(BattleSide.Enemy, 'VULNERABLE', 2);
    ent.BattleEnemyModel.hp = 100;
    ent.BattleEnemyModel.block = 3;
    assert.equal(await ent.BattleDamageBll.damage(BattleSide.Player, BattleSide.Enemy, 6), 6);
    assert.equal(ent.BattleEnemyModel.hp, 94);
    assert.equal(ent.BattleEnemyModel.block, 0);
    ent.BattleBuffBll.add(BattleSide.Enemy, 'POISON', 3);
    ent.BattleEnemyModel.block = 99;
    await ent.BattleBuffBll.startTurn(BattleSide.Enemy);
    assert.equal(ent.BattleEnemyModel.hp, 91);
    assert.equal(ent.BattleValueResolver.stacks(BattleSide.Enemy, 'POISON'), 2);
    await ent.BattleBuffBll.endTurn(BattleSide.Enemy);
    assert.equal(ent.BattleValueResolver.stacks(BattleSide.Enemy, 'VULNERABLE'), 1);
    const context = ent.BattleValueResolver.context();
    assert.equal(ent.BattleValueResolver.number('max(2, @target.poison * 3) + floor(5 / 2)', context), 8);
    assert.throws(() => ent.BattleValueResolver.number('globalThis.process.exit()', context));
    assert.throws(() => ent.BattleValueResolver.number('1 / 0', context));

    ent = await ready();
    player = ent.BattlePlayerModel;
    ent.BattleEnemyModel.hp = 1000;
    player.handCards = [20006];
    player.drawPile = [];
    player.dice = [2, 4];
    await ent.BattleCardBll.play(0);
    assert.deepEqual(player.powerPile, [20006]);
    const hp = player.hp;
    await ent.BattleDamageBll.damage(BattleSide.Enemy, BattleSide.Player, 10);
    assert.equal(player.hp, hp - 4);
    assert.equal(player.block, 3);
    assert.equal(ent.BattleEnemyModel.hp, 996);
    ent.BattleTriggerBll.register('ON_DAMAGE_TAKEN', [{ type: 'DAMAGE', target: 'ENEMY', params: { amount: 4 } }],
        ent.BattleValueResolver.context(BattleSide.Enemy));
    await ent.BattleDamageBll.damage(BattleSide.Enemy, BattleSide.Player, 10);
    assert.equal(player.hp > 0, true);

    ent = await ready();
    player = ent.BattlePlayerModel;
    player.handCards = [20008];
    player.drawPile = [];
    player.dice = [4, 2, 5];
    await ent.BattleCardBll.play(0);
    assert.equal(player.block, 12);
    await ent.BattleBll.endTurn();
    assert.equal(player.block, 6);
    assert.equal(ent.BattleModel.triggers.length, 0);

    // 所有 30 张真实配置走完整出牌链；每张选择牌至少覆盖一个选项。
    for (const [id, card] of Object.entries(config['2_Card'])) {
        ent = await ready(card.role);
        player = ent.BattlePlayerModel;
        ent.BattleEnemyModel.hp = 10000;
        ent.BattleEnemyModel.maxHp = 10000;
        player.handCards = [Number(id), Number(id)];
        player.drawPile = [];
        player.dice = card.DiceNeed.map(icon => config['3_Dice'][icon].diceNum[0]);
        await ent.BattleCardBll.play(0);
        assert.equal(ent.BattleModel.message, '', `${id} ${card.name}`);
        assert.equal(player.resolvingCards.length, 0);
        assert.equal(ent.BattleModel.busy, false);
    }

    ent = await ready();
    player = ent.BattlePlayerModel;
    player.handCards = [20003];
    player.drawPile = [20001];
    player.dice = [2];
    ent.BattleEnemyModel.hp = 2;
    await ent.BattleCardBll.play(0);
    assert.equal(ent.BattleModel.phase, BattlePhase.Victory);
    assert.equal(player.energy, 3);
    assert.equal(player.drawPile.length, 1);
    assert.equal(player.resolvingCards.length, 0);
    await ent.BattleBll.endTurn();
    assert.equal(ent.BattleModel.turn, 1);

    ent = await ready();
    ent.autoChoose = false;
    player = ent.BattlePlayerModel;
    player.handCards = [20010];
    player.drawPile = [];
    player.dice = [4, 1, 2, 6];
    const pending = ent.BattleCardBll.play(0);
    await Promise.resolve();
    assert.ok(ent.BattleModel.choice);
    assert.equal(ent.BattleModel.busy, true);
    await ent.BattleBll.endTurn();
    assert.equal(ent.BattleModel.turn, 1);
    ent.BattleBll.close();
    await pending;
    assert.equal(ent.BattleModel.choice, null);
    assert.equal(ent.BattleModel.busy, false);

    ent = await ready();
    ent.autoChoose = false;
    player = ent.BattlePlayerModel;
    player.handCards = [20010];
    player.dice = [4, 1, 2, 6];
    const oldResolution = ent.BattleCardBll.play(0);
    await Promise.resolve();
    ent.BattleBll.close();
    await ent.BattleBll.start();
    await oldResolution;
    assert.equal(ent.BattleModel.closed, false);
    assert.equal(player.handCards.length, 5);
    assert.equal(player.drawPile.length, 5);
    assert.equal(player.discardPile.length, 0);
    assert.equal(player.resolvingCards.length, 0);

    for (const cardId of [20008, 20016, 20020]) {
        const card = config['2_Card'][cardId];
        ent = await ready(card.role);
        player = ent.BattlePlayerModel;
        player.hp = 20;
        player.handCards = [cardId];
        player.drawPile = [];
        player.dice = card.DiceNeed.map(icon => config['3_Dice'][icon].diceNum[0]);
        ent.BattleEnemyModel.hp = 18;
        await ent.BattleCardBll.play(0);
        assert.equal(ent.BattleModel.message, '');
        if (cardId === 20008) {
            assert.equal(player.hp, 28);
            assert.equal(player.block, 6);
        } else if (cardId === 20016) {
            assert.equal(ent.BattleEnemyModel.hp, 0);
        } else {
            assert.equal(ent.BattleModel.phase, BattlePhase.Victory);
        }
    }
    // 覆盖所有选择分支，不把 CHOOSE_ONE 偷换成固定第一个分支。
    for (const cardId of [20010, 20018, 20028]) {
        const card = config['2_Card'][cardId];
        for (const option of card.effect[0].children.keys()) {
            ent = await ready(card.role);
            ent.onRefresh = () => {
                if (ent.BattleModel.choice) {
                    ent.BattleEffectBll.select(option);
                }
            };
            player = ent.BattlePlayerModel;
            player.hp = 50;
            player.handCards = [cardId];
            player.drawPile = [];
            player.dice = card.DiceNeed.map(icon => config['3_Dice'][icon].diceNum[0]);
            await ent.BattleCardBll.play(0);
            assert.equal(ent.BattleModel.message, '');
            assert.equal(player.block > 0 || player.hp > 50 || ent.BattleEnemyModel.hp < 100, true);
        }
    }

    // 保留、虚无与消耗不丢牌，也不修改原始牌组。
    const originalFlags = [20001, 20002, 20003].map(id => config['2_Card'][id].flags);
    config['2_Card'][20001].flags = { retain: true };
    config['2_Card'][20002].flags = { ethereal: true, retain: true };
    config['2_Card'][20003].flags = { exhaust: true };
    ent = await ready();
    player = ent.BattlePlayerModel;
    player.handCards = [20001, 20002, 20003];
    player.drawPile = [];
    player.discardPile = [];
    player.dice = [2];
    await ent.BattleCardBll.play(2);
    await ent.BattleCardBll.endTurn();
    assert.deepEqual(player.handCards, [20001]);
    assert.deepEqual(player.exhaustPile, [20003, 20002]);
    assert.equal(smc.player.PlayerModel.handCard.length, 10);
    [20001, 20002, 20003].forEach((id, index) => {
        config['2_Card'][id].flags = originalFlags[index];
    });

    ent = await ready();
    player = ent.BattlePlayerModel;
    const limited = [{ type: 'BLOCK', target: 'SELF', params: { amount: 2 } }];
    ent.BattleTriggerBll.register('ON_CARD_PLAYED', limited, ent.BattleValueResolver.context(), 'TURN', 1);
    await ent.BattleTriggerBll.fire('ON_CARD_PLAYED', BattleSide.Player);
    await ent.BattleTriggerBll.fire('ON_CARD_PLAYED', BattleSide.Player);
    assert.equal(player.block, 2);
    assert.equal(ent.BattleModel.triggers.length, 0);
    ent.BattleBuffBll.add(BattleSide.Player, 'STRENGTH', -3, 'TURN');
    ent.BattleBuffBll.add(BattleSide.Player, 'DEXTERITY', 2, 'COMBAT');
    await ent.BattleBuffBll.endTurn(BattleSide.Player);
    assert.equal(ent.BattleValueResolver.stacks(BattleSide.Player, 'STRENGTH'), 0);
    assert.equal(ent.BattleValueResolver.stacks(BattleSide.Player, 'DEXTERITY'), 2);
    ent.BattleBuffBll.remove(BattleSide.Player, 'ALL');
    assert.equal(player.buffs.length, 0);

    ent = await ready();
    player = ent.BattlePlayerModel;
    ent.BattleEnemyModel.hp = 2;
    ent.BattleBuffBll.add(BattleSide.Enemy, 'POISON', 3);
    const beforeEnemyAttack = player.hp;
    await ent.BattleBll.endTurn();
    assert.equal(ent.BattleModel.phase, BattlePhase.Victory);
    assert.equal(player.hp, beforeEnemyAttack);
    assert.equal(ent.BattleModel.turn, 1);

    ent = await ready();
    ent.BattlePlayerModel.hp = 1;
    await ent.BattleBll.endTurn();
    assert.equal(ent.BattleModel.phase, BattlePhase.Defeat);
    assert.equal(ent.BattlePlayerModel.hp, 0);
    assert.equal(ent.BattleModel.turn, 1);
    assert.equal(smc.player.PlayerModel.hp, 0);

    // 验证实际 Prefab 合约，防止节点重命名或缺组件时直到运行才报错。
    const prefab = JSON.parse(fs.readFileSync(path.join(root, 'assets/bundle/gui/battle/BattleView.prefab'), 'utf8'));
    for (const name of ['lbtPlayerEnergy', 'lbtPlayerHP', 'lbtEnemyHP',
        'lbtCurrentPhase', 'lbtCurrentRound', 'txtThrow', 'txtContinue']) {
        const node = prefab.find(item => item.__type__ === 'cc.Node' && item._name === name);
        assert.ok(node, name);
        assert.ok(node._components.some(ref => prefab[ref.__id__].__type__ === 'cc.Label'), name);
    }
    for (const name of ['lbtPlayerBuff', 'lbtEnemyBuff']) {
        const node = prefab.find(item => item.__type__ === 'cc.Node' && item._name === name);
        assert.ok(node._components.some(ref => prefab[ref.__id__].__type__ === 'cc.RichText'), name);
    }
    for (const name of ['btnEnd', 'btnThrow']) {
        const node = prefab.find(item => item.__type__ === 'cc.Node' && item._name === name);
        assert.ok(node._components.some(ref => prefab[ref.__id__].__type__ === 'cc.Button'), name);
    }
    console.log('通过：30 张真实卡牌及全部选择分支、回合循环、骰子匹配/重投、补牌、伤害/Buff、表达式、持续/延迟触发、生命周期、选择取消、胜负中断及 Prefab 节点合约。');
    if (process.argv.includes('--typecheck')) {
        const file = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
        file.config.compilerOptions.types = ['./temp/declarations/cc', './temp/declarations/cc.env',
            './temp/declarations/jsb', './temp/declarations/cc.custom-macro'];
        file.config.compilerOptions.skipLibCheck = true;
        const parsed = ts.parseJsonConfigFileContent(file.config, ts.sys, root);
        const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram(parsed.fileNames, parsed.options));
        const changed = diagnostics.filter(item => item.file && /game[\\/]battle|game[\\/]player[\\/]model[\\/]PlayerModel|game[\\/]dice[\\/]nodeDice|game[\\/]save[\\/]bll[\\/]B_Save/.test(item.file.fileName));
        const host = { getCanonicalFileName(fileName) {
            return fileName;
        }, getCurrentDirectory() {
            return root;
        }, getNewLine() {
            return '\n';
        } };
        assert.equal(changed.length, 0, ts.formatDiagnostics(changed, host));
        console.log(`本次修改的 TypeScript 文件诊断：0；项目其他文件诊断：${diagnostics.length}。`);
    }
}
run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

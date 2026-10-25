const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const { readTables, validateCards, saveCards, buffDurations, buffRuleNames } = require('../effectEditorTables.cjs');
let writing = false;
const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    /**
 * @returns {void}
 */
    const send = (status, value) => {
        response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify(value));
    };
    return (async () => {
        const url = new URL(request.url, 'http://localhost');
        if (request.method === 'GET' && url.pathname === '/api/tables') {
            const { revision, roles, cards, dice, buffs, effects } = await readTables();
            send(200, { revision, roles, cards, dice, buffs, effects, buffDurations, buffRuleNames });
        }
        else if (request.method === 'POST' && url.pathname === '/api/cards') {
            if (request.headers.origin !== `http://${request.headers.host}` || request.headers['content-type'] !== 'application/json' || writing) {
                send(409, { error: '请求来源无效或正在保存' });
                return;
            }
            writing = true;
            await (async () => {
                let body = '';
                for await (const chunk of request) {
                    body += chunk;
                    if (body.length > 5 * 1024 * 1024) {
                        throw new Error('数据超过 5 MB');
                    }
                }
                send(200, await saveCards(JSON.parse(body)));
            })().finally(() => {
                writing = false;
            });
        }

        else if (request.method === 'GET' && ['/effectEditorCore.js', '/effectEditor.css'].includes(url.pathname)) {
            response.writeHead(200, {'Content-Type': url.pathname.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8'});
            response.end(await fs.readFile(path.join(__dirname, '..', url.pathname.slice(1))));
        }
        else if (request.method === 'GET' && ['/', '/cardEffectEditor.html'].includes(url.pathname)) {
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end(await fs.readFile(path.join(__dirname, 'cardEffectEditor.html')));
        }
        else {
            send(404, { error: '不存在的地址' });
        }
    })().catch(error => {
        send(400, { error: error.message });
    });
});
if (require.main === module) {
    const port = Number(process.env.PORT) || 3210;
    server.on('error', error => {
        if (error.code === 'EADDRINUSE') {
            console.error(`端口 ${port} 已被占用。编辑器可能已经启动，可直接打开 http://127.0.0.1:${port}。`);
        }
        else {
            console.error('编辑器启动失败：' + error.message);
        }
        process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
        console.log(`卡牌编辑器：http://127.0.0.1:${port}`);
    });
}
module.exports = { readTables, validateCards, saveCards, server };

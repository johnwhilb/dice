import http, { Server, ServerResponse } from 'http';
import path from 'path';
import { promises } from 'fs';
import { CellValue, Style, Workbook, Worksheet } from 'exceljs';

export interface EditorExcelConfig {
    PathExcel: string;
    PathJsonClient: string;
    PathTsClient: string;
}

interface EditorPoint {
    id: number;
    levelId: number;
    point: string;
    x: number;
    y: number;
    typeId: number;
    order: number;
}

interface SavePayload {
    levelId: number;
    points: EditorPoint[];
}

interface SheetRow {
    values: CellValue[];
    styles: Partial<Style>[];
    height: number;
}

let server: Server | null = null;
let busy = false;

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isPoint(value: unknown): value is EditorPoint {
    if (!isRecord(value)) {
        return false;
    }
    return typeof value.id === 'number' && Number.isInteger(value.id)
        && typeof value.levelId === 'number' && Number.isInteger(value.levelId)
        && typeof value.point === 'string' && !!value.point.trim() && value.point.length <= 32
        && typeof value.x === 'number' && Number.isFinite(value.x)
        && typeof value.y === 'number' && Number.isFinite(value.y)
        && typeof value.typeId === 'number' && Number.isInteger(value.typeId)
        && typeof value.order === 'number' && Number.isInteger(value.order);
}

function isPayload(value: unknown): value is SavePayload {
    return isRecord(value) && typeof value.levelId === 'number'
        && Number.isInteger(value.levelId) && Array.isArray(value.points)
        && value.points.length >= 6 && value.points.length <= 9999 && value.points.every(isPoint);
}

function columns(sheet: Worksheet) {
    const fields: Record<string, number> = {};
    sheet.getRow(2).eachCell((cell, index) => {
        fields[cell.text.replace(/_ENUM$/, '')] = index;
    });
    return fields;
}

function sheetRows(sheet: Worksheet) {
    const rows: SheetRow[] = [];
    sheet.eachRow((row, index) => {
        if (index > 5 && row.getCell(1).text) {
            const values: CellValue[] = [];
            const styles: Partial<Style>[] = [];
            row.eachCell({ includeEmpty: true }, (cell, column) => {
                values[column - 1] = cell.value;
                styles[column - 1] = cell.style;
            });
            rows.push({ values, styles, height: row.height });
        }
    });
    return rows;
}

function result(success: boolean, message: string) {
    return { success, message };
}

/** 等待三个源工作簿读取、原子写回岩点表，再运行项目原有配置生成器。 */
export async function saveClimbLevel(value: unknown, settings: EditorExcelConfig, regenerate: () => Promise<void>) {
    if (!isPayload(value) || !settings.PathExcel || !settings.PathJsonClient || !settings.PathTsClient) {
        return result(false, '保存参数无效，未修改 Excel');
    }
    const root = settings.PathExcel.replace('project://', path.resolve(__dirname, '../../..') + path.sep);
    const file = path.join(root, '3_ClimbHold.xlsx');
    const holds = new Workbook();
    const levels = new Workbook();
    const types = new Workbook();
    await Promise.all([
        holds.xlsx.readFile(file),
        levels.xlsx.readFile(path.join(root, '1_ClimbLevel.xlsx')),
        types.xlsx.readFile(path.join(root, '2_HoldType.xlsx'))
    ]);
    const sheet = holds.getWorksheet('3_ClimbHold');
    const levelSheet = levels.getWorksheet('1_ClimbLevel');
    const typeSheet = types.getWorksheet('2_HoldType');
    if (!sheet || !levelSheet || !typeSheet) {
        return result(false, '源工作表不存在，未修改 Excel');
    }
    const fields = columns(sheet);
    const levelFields = columns(levelSheet);
    const typeFields = columns(typeSheet);
    const required = ['id', 'levelId', 'point', 'x', 'y', 'typeId', 'order'];
    if (required.some((key) => {
        return !fields[key];
    })) {
        return result(false, '岩点表字段不完整，未修改 Excel');
    }
    const level = sheetRows(levelSheet).find((row) => {
        return Number(row.values[levelFields.id - 1]) === value.levelId;
    });
    if (!level) {
        return result(false, '关卡不存在，未修改 Excel');
    }
    const width = Number(level.values[levelFields.width - 1]);
    const height = Number(level.values[levelFields.height - 1]);
    const levelNumber = Number(level.values[levelFields.level - 1]);
    const starts = ['leftHandStart', 'rightHandStart', 'leftFootStart', 'rightFootStart'].map((key) => {
        return Number(level.values[levelFields[key] - 1]);
    });
    const kinds = new Map(sheetRows(typeSheet).map((row) => {
        return [Number(row.values[typeFields.id - 1]), String(row.values[typeFields.kind - 1])];
    }));
    const rows = sheetRows(sheet);
    const others = rows.filter((row) => {
        return Number(row.values[fields.levelId - 1]) !== value.levelId;
    });
    const occupied = new Set(others.map((row) => {
        return Number(row.values[fields.id - 1]);
    }));
    const validPoints = value.points.every((point) => {
        const kind = kinds.get(point.typeId);
        return point.levelId === value.levelId && Math.floor(point.id / 10000) === 3 && point.id % 10000 > 0
            && !occupied.has(point.id) && point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height
            && !!kind && !(levelNumber <= 3 && kind === 'Danger') && point.point === point.point.trim();
    });
    const validStarts = starts.every((id) => {
        return value.points.some((point) => {
            return point.id === id && kinds.get(point.typeId) === 'Normal';
        });
    });
    const validFinish = ['FinishLeft', 'FinishRight'].every((kind) => {
        return value.points.filter((point) => {
            return kinds.get(point.typeId) === kind;
        }).length === 1;
    });
    if (!validPoints || !validStarts || !validFinish || new Set(value.points.map((point) => {
        return point.id;
    })).size !== value.points.length || new Set(value.points.map((point) => {
        return point.point;
    })).size !== value.points.length) {
        return result(false, '主键、坐标、初始抓点或终点配置无效，未修改 Excel');
    }
    const existing = new Map(rows.map((row) => {
        return [Number(row.values[fields.id - 1]), row];
    }));
    const styleTemplate = rows.find((row) => {
        return Number(row.values[fields.levelId - 1]) === value.levelId;
    }) || rows[0];
    if (!styleTemplate) {
        return result(false, '岩点源表没有数据，未修改 Excel');
    }
    const replacement = value.points.map((point, index) => {
        const old = existing.get(point.id) || styleTemplate;
        const values = old.values.slice();
        const data: Record<string, CellValue> = { id: point.id, levelId: point.levelId, point: point.point, x: point.x, y: point.y, typeId: point.typeId, order: index + 1 };
        required.forEach((key) => {
            values[fields[key] - 1] = data[key];
        });
        return { values, styles: old.styles, height: old.height };
    });
    const output: SheetRow[] = [];
    let inserted = false;
    rows.forEach((row) => {
        if (Number(row.values[fields.levelId - 1]) === value.levelId) {
            if (!inserted) {
                output.push(...replacement);
                inserted = true;
            }
        }
        else {
            output.push(row);
        }
    });
    if (!inserted) {
        output.push(...replacement);
    }
    const oldCount = sheet.rowCount;
    output.forEach((data, index) => {
        const row = sheet.getRow(index + 6);
        row.values = data.values;
        row.height = data.height;
        data.styles.forEach((style, column) => {
            row.getCell(column + 1).style = style;
        });
    });
    Array.from({ length: Math.max(0, oldCount - output.length - 5) }, (entry, index) => {
        sheet.getRow(output.length + 6 + index).values = [];
    });
    const temporary = file + '.editor-tmp';
    await holds.xlsx.writeFile(temporary);
    await promises.rename(temporary, file);
    return regenerate().then(() => {
        return result(true, 'Excel 和客户端配置已保存');
    }, (error: Error) => {
        console.error('Excel 已写入，但配置生成失败', error);
        return result(false, 'Excel 已写入，但配置生成失败，请检查配表插件控制台后重试');
    });
}

function send(response: ServerResponse, success: boolean, message: string, status = 200) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(result(success, message)));
}

/** 仅为当前 Creator 项目的本机预览提供保存服务，路径由配表插件配置决定。 */
export function startClimbEditorServer(getSettings: () => Promise<EditorExcelConfig>, regenerate: () => Promise<void>) {
    if (server) {
        return;
    }
    server = http.createServer((request, response) => {
        const origin = request.headers.origin || '';
        if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            send(response, false, '仅支持本机 Creator 预览', 403);
            return;
        }
        if (origin) {
            response.setHeader('Access-Control-Allow-Origin', origin);
        }
        response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        response.setHeader('Access-Control-Allow-Private-Network', 'true');
        if (request.method === 'OPTIONS') {
            response.writeHead(204);
            response.end();
            return;
        }
        if (request.method !== 'POST' || request.url !== '/climb-editor/save' || !request.headers['content-type']?.startsWith('application/json')) {
            send(response, false, '接口不存在', 404);
            return;
        }
        if (busy) {
            send(response, false, '配表工具正在保存，请稍后重试', 409);
            return;
        }
        let body = '';
        let exceeded = false;
        request.setEncoding('utf8');
        request.on('data', (chunk: string) => {
            if (!exceeded) {
                body += chunk;
                if (Buffer.byteLength(body) > 1024 * 1024) {
                    exceeded = true;
                    body = '';
                }
            }
        });
        request.on('end', () => {
            if (exceeded) {
                send(response, false, '关卡数据过大', 413);
                return;
            }
            if (busy) {
                send(response, false, '配表工具正在保存，请稍后重试', 409);
                return;
            }
            busy = true;
            Promise.resolve().then(() => {
                const value: unknown = JSON.parse(body);
                return getSettings().then((settings) => {
                    return saveClimbLevel(value, settings, regenerate);
                });
            }).then((saved) => {
                busy = false;
                send(response, saved.success, saved.message);
            }, (error: Error) => {
                busy = false;
                console.error('关卡编辑器保存失败', error);
                send(response, false, '保存未完成：请关闭占用 Excel 的程序，并检查配表插件控制台', 500);
            });
        });
    });
    server.on('error', (error: Error) => {
        console.warn('关卡编辑器保存接口无法启动', error.message);
        server = null;
    });
    server.listen(17381, '127.0.0.1');
}

/** 扩展卸载时关闭编辑器保存接口。 */
export function stopClimbEditorServer() {
    if (server) {
        server.close();
        server = null;
    }
}

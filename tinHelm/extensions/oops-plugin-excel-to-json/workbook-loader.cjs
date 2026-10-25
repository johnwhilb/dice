const JSZip = require('./node_modules/jszip');

// 旧版ExcelJS不识别带x:前缀的SpreadsheetML；只规范内存副本，源文件保持不变。
async function loadWorkbook(workbook, buffer) {
    const zip = await JSZip.loadAsync(buffer);
    let changed = false;
    for (const name of Object.keys(zip.files)) {
        if (!name.endsWith('.xml')) {
            continue;
        }
        let xml = await zip.file(name).async('string');
        const namespaces = xml.match(/xmlns:[\w]+="http:\/\/schemas.openxmlformats.org\/spreadsheetml\/2006\/main"/g) || [];
        for (const match of namespaces) {
            const prefix = match.split(':')[1].split('=')[0];
            xml = xml.replace(match, 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')
                .replace(new RegExp('(<\\/?)' + prefix + ':', 'g'), '$1');
            changed = true;
        }
        if (namespaces.length) {
            zip.file(name, xml);
        }
    }
    await workbook.xlsx.load(changed ? await zip.generateAsync({ type: 'nodebuffer' }) : buffer);
    return workbook;
}

module.exports = { loadWorkbook };

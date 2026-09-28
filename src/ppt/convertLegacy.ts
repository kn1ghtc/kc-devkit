/**
 * Convert legacy binary .ppt to PPTX bytes via installed PowerPoint.
 */

import { spawn } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';

export async function convertPptToPptx(pptPath: string): Promise<Buffer> {
    const dir = await mkdtemp(path.join(tmpdir(), 'kc-ppt-'));
    const outPath = path.join(dir, 'converted.pptx');
    const scriptPath = path.join(dir, 'convert.ps1');
    const script = [
        "$ErrorActionPreference = 'Stop'",
        `$inputPath = ${psString(pptPath)}`,
        `$outputPath = ${psString(outPath)}`,
        '$app = New-Object -ComObject PowerPoint.Application',
        'try {',
        '  $pres = $app.Presentations.Open($inputPath, $true, $false, $false)',
        '  $pres.SaveAs($outputPath, 24)',
        '  $pres.Close()',
        '} finally {',
        '  $app.Quit()',
        '}',
    ].join('\n');
    try {
        await writeFile(scriptPath, `\uFEFF${script}`, 'utf8');
        await runPowerShell(scriptPath);
        return await readFile(outPath);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`无法读取 .ppt。需要安装 Microsoft PowerPoint，并用它转换为 PPTX。${message}`);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}

function psString(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}

function runPowerShell(scriptPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(
            'powershell.exe',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
            { windowsHide: true },
        );
        let stderr = '';
        child.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString();
        });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(stderr.trim() || `PowerPoint 转换失败，退出码 ${code}`));
        });
    });
}

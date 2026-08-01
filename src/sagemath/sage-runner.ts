/**
 * sage-runner.ts — SageMath File Runner with WSL Auto-Detection
 *
 * Provides the `kcDevKit.runSageFile` command which:
 * 1. Detects the current platform (Windows/Linux/macOS)
 * 2. On Windows: uses WSL if configured, otherwise tries native sage
 * 3. Creates or reuses a "SageMath" terminal
 * 4. Executes: cd "<dir>" && <sagePath> "<filename>"
 * 5. Optionally auto-deletes the generated .sage.py file
 */

import * as vscode from 'vscode';
import * as path from 'path';

/** Terminal instance reused across runs. */
let sageTerminal: vscode.Terminal | undefined;

/**
 * Activates the SageMath module.
 *
 * Registers the run command and listens for terminal close events
 * to clean up the cached terminal reference.
 */
export function activateSageMath(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('kcDevKit.runSageFile', runSageFile),
    );

    // Clean up terminal reference when it is closed
    context.subscriptions.push(
        vscode.window.onDidCloseTerminal((terminal: vscode.Terminal) => {
            if (terminal === sageTerminal) {
                sageTerminal = undefined;
            }
        }),
    );
}

/**
 * Runs the currently active .sage file in a SageMath terminal.
 */
async function runSageFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('KC DevKit: No active editor.');
        return;
    }

    const document = editor.document;
    if (document.languageId !== 'sage') {
        vscode.window.showWarningMessage(
            'KC DevKit: Current file is not a SageMath (.sage) file.',
        );
        return;
    }

    // Save document before running
    if (document.isDirty) {
        await document.save();
    }

    const config = vscode.workspace.getConfiguration('kcDevKit.sagemath');
    const interpreterPath = config.get<string>('interpreterPath', 'sage');
    const useWSL = config.get<boolean>('useWSL', false);
    const autoDelete = config.get<boolean>('autoDeleteGenerated', false);

    const filePath = document.uri.fsPath;
    const fileDir = path.dirname(filePath);
    const fileName = path.basename(filePath);

    // Build the execution command
    const command = buildCommand(interpreterPath, useWSL, fileDir, fileName, autoDelete);

    // Create or reuse terminal
    if (!sageTerminal || sageTerminal.exitStatus !== undefined) {
        sageTerminal = vscode.window.createTerminal({
            name: 'SageMath',
            cwd: fileDir,
        });
    }

    sageTerminal.show(true);
    sageTerminal.sendText(command);
}

/**
 * Builds the shell command for running a SageMath file.
 *
 * @param sage - Path to the sage interpreter
 * @param useWSL - Whether to run through WSL on Windows
 * @param dir - Directory containing the .sage file
 * @param filename - Name of the .sage file
 * @param autoDelete - Whether to auto-delete .sage.py after execution
 * @returns The full shell command string
 */
function buildCommand(
    sage: string,
    useWSL: boolean,
    dir: string,
    filename: string,
    autoDelete: boolean,
): string {
    const isWindows = process.platform === 'win32';
    const sagePyFile = `${filename}.py`;

    let runCmd: string;

    if (isWindows && useWSL) {
        // Convert Windows path to WSL path
        const wslDir = windowsToWslPath(dir);
        runCmd = `wsl bash -c 'cd "${wslDir}" && ${sage} "${filename}"'`;
    } else {
        // Wrap in quotes for paths with spaces
        runCmd = `cd "${dir}" && ${sage} "${filename}"`;
    }

    if (autoDelete) {
        const deleteCmd = isWindows
            ? `& if exist "${sagePyFile}" del "${sagePyFile}"`
            : `; rm -f "${sagePyFile}"`;
        runCmd += ` ${deleteCmd}`;
    }

    return runCmd;
}

/**
 * Converts a Windows path to a WSL path.
 * Example: `D:\projects\math` → `/mnt/d/projects/math`
 */
function windowsToWslPath(windowsPath: string): string {
    return windowsPath
        .replace(/^([A-Za-z]):/, (_, drive: string) => `/mnt/${drive.toLowerCase()}`)
        .replace(/\\/g, '/');
}

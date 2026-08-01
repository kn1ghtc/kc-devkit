/**
 * pycache-cleaner.ts — Python Cache File Cleanup
 *
 * Provides a command to recursively delete __pycache__ directories
 * and .pyc files from all workspace folders. Also supports auto-clean
 * on workspace open and a status bar indicator.
 */

import * as vscode from 'vscode';

/** Status bar item showing cleanup results. */
let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * Activates the Pycache Cleaner module.
 *
 * Registers the `kcDevKit.cleanPycache` command and optionally triggers
 * auto-cleanup on workspace open if configured.
 */
export function activatePycacheCleaner(context: vscode.ExtensionContext): void {
    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        50,
    );
    statusBarItem.command = 'kcDevKit.cleanPycache';
    statusBarItem.tooltip = 'Clean Python cache files';
    context.subscriptions.push(statusBarItem);

    // Register command
    context.subscriptions.push(
        vscode.commands.registerCommand('kcDevKit.cleanPycache', () =>
            cleanPycacheFiles(true),
        ),
    );

    // Auto-clean on open if configured
    const autoClean = vscode.workspace
        .getConfiguration('kcDevKit.pycache')
        .get<boolean>('autoCleanOnOpen', false);

    if (autoClean) {
        cleanPycacheFiles(false);
    }
}

/**
 * Performs the recursive pycache cleanup.
 *
 * @param showNotification - Whether to show an info notification with results
 */
async function cleanPycacheFiles(showNotification: boolean): Promise<void> {
    const excludePatterns = vscode.workspace
        .getConfiguration('kcDevKit.pycache')
        .get<string[]>('exclude', [
            '**/node_modules/**',
            '**/.venv/**',
            '**/venv/**',
        ]);

    // Build a composite exclude pattern for findFiles
    const excludeGlob = excludePatterns.length > 0
        ? `{${excludePatterns.join(',')}}`
        : undefined;

    let deletedCount = 0;

    try {
        // Phase 1: Find and delete __pycache__ directory contents
        const pycacheDirs = await vscode.workspace.findFiles(
            '**/__pycache__/**',
            excludeGlob,
            10000,
        );

        // Collect unique __pycache__ directory URIs
        const dirSet = new Set<string>();
        for (const fileUri of pycacheDirs) {
            const dirPath = getParentPycacheDir(fileUri);
            if (dirPath) {
                dirSet.add(dirPath);
            }
        }

        // Delete each __pycache__ directory recursively
        for (const dirPath of dirSet) {
            try {
                const dirUri = vscode.Uri.file(dirPath);
                await vscode.workspace.fs.delete(dirUri, { recursive: true });
                deletedCount++;
            } catch {
                // Directory may already be deleted or locked — skip
            }
        }

        // Phase 2: Find and delete standalone .pyc files (outside __pycache__)
        const pycFiles = await vscode.workspace.findFiles(
            '**/*.pyc',
            excludeGlob,
            10000,
        );

        for (const fileUri of pycFiles) {
            // Skip files already inside deleted __pycache__ dirs
            if (fileUri.fsPath.includes('__pycache__')) {
                continue;
            }
            try {
                await vscode.workspace.fs.delete(fileUri);
                deletedCount++;
            } catch {
                // File may be locked — skip
            }
        }
    } catch (err) {
        if (showNotification) {
            vscode.window.showErrorMessage(
                `Pycache cleanup failed: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
        return;
    }

    // Update status bar
    if (statusBarItem) {
        if (deletedCount > 0) {
            statusBarItem.text = `$(trash) ${deletedCount} cache items cleaned`;
            statusBarItem.show();

            // Auto-hide after 10 seconds
            setTimeout(() => statusBarItem?.hide(), 10000);
        } else {
            statusBarItem.text = '$(check) No cache files found';
            statusBarItem.show();
            setTimeout(() => statusBarItem?.hide(), 5000);
        }
    }

    // Show notification
    if (showNotification) {
        if (deletedCount > 0) {
            vscode.window.showInformationMessage(
                `KC DevKit: Cleaned ${deletedCount} Python cache item(s).`,
            );
        } else {
            vscode.window.showInformationMessage(
                'KC DevKit: No Python cache files found in workspace.',
            );
        }
    }
}

/**
 * Extracts the __pycache__ directory path from a file URI.
 * Returns the path of the closest __pycache__ ancestor directory.
 */
function getParentPycacheDir(uri: vscode.Uri): string | undefined {
    const parts = uri.fsPath.split(/[\\/]/);
    const idx = parts.lastIndexOf('__pycache__');
    if (idx >= 0) {
        return parts.slice(0, idx + 1).join('/');
    }
    return undefined;
}

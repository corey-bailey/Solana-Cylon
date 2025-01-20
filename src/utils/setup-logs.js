import fs from 'fs';
import path from 'path';

export function setupLogDirectories() {
    const logDir = 'logs';
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }

    // Ensure all log files exist
    const logFiles = [
        'combined.log',
        'error.log',
        'system.log',
        'user-wallet.log',
        'watched-wallets.log'
    ];

    logFiles.forEach(file => {
        const logPath = path.join(logDir, file);
        if (!fs.existsSync(logPath)) {
            fs.writeFileSync(logPath, '');
        }
    });
} 
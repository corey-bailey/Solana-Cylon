// Suppress specific deprecation warning
process.removeAllListeners('warning');
process.on('warning', (warning) => {
    if (warning.name === 'DeprecationWarning' && 
        warning.message.includes('punycode')) {
        return;
    }
    console.warn(warning);
});

// Import and run your app
import('../src/index.js').catch(console.error); 
// NexChat - PWA Icon Cache Helper
// Icons are now embedded as SVG data URIs directly in manifest.json
// This file remains for backwards compat and to update PWA status display

(function() {
    function updatePWAStatus() {
        const statusEl = document.getElementById('pwa-status');
        if (!statusEl) return;
        
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                             window.navigator.standalone === true;
        
        if (isStandalone) {
            statusEl.textContent = '✓ Running as installed app';
            statusEl.style.color = '#10b981';
        } else {
            statusEl.textContent = 'Running in browser';
        }
    }
    
    // Update on load and on display mode change
    if (document.readyState === 'complete') {
        updatePWAStatus();
    } else {
        window.addEventListener('load', updatePWAStatus);
    }
    
    window.matchMedia('(display-mode: standalone)').addEventListener('change', updatePWAStatus);
})();
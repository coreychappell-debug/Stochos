export function byId(id) { return document.getElementById(id); }

export function formatCurrency(v) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(v || 0);
}

export function vendorLabel(id) {
    return id === 'sg' ? 'Scientific Games' : id === 'pb' ? 'Pollard Banknote' : id === 'bs' ? 'Brightstar' : id;
}

export function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines.shift().split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.map(line => {
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        return headers.reduce((o, h, i) => { o[h] = values[i] ? values[i].trim().replace(/"/g, '') : ''; return o; }, {});
    });
}

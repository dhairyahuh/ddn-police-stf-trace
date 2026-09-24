const https = require('https');

// ProtonVPN official IP ranges from the code
const PROTON_RANGES = [
    '185.107.56.0/22',
    '193.4.56.0/24', 
    '103.254.155.0/24',
    '104.245.144.0/20',
    '149.126.0.0/17',
    '185.159.156.0/22'
];

function ipToInt(ip) {
    const parts = ip.split('.');
    return ((parseInt(parts[0]) << 24) |
            (parseInt(parts[1]) << 16) |
            (parseInt(parts[2]) << 8) |
            parseInt(parts[3])) >>> 0;
}

function isIPInCIDR(ip, cidr) {
    const [range, bits] = cidr.split('/');
    const mask = ~((1 << (32 - parseInt(bits))) - 1);
    const ipInt = ipToInt(ip);
    const rangeInt = ipToInt(range);
    return (ipInt & mask) === (rangeInt & mask);
}

const testIP = '185.159.159.148';
console.log(`Testing IP: ${testIP}\n`);

console.log('Checking against ProtonVPN ranges:');
let found = false;
PROTON_RANGES.forEach(range => {
    const match = isIPInCIDR(testIP, range);
    console.log(`  ${range}: ${match ? '✓ MATCH' : '✗ no match'}`);
    if (match) found = true;
});

if (found) {
    console.log(`\n✓ ${testIP} IS in ProtonVPN ranges`);
} else {
    console.log(`\n✗ ${testIP} is NOT in ProtonVPN ranges - FALSE POSITIVE!`);
}

// Let's also do a WHOIS lookup to verify
console.log('\n--- WHOIS Verification ---');
console.log('Checking actual ownership via WHOIS API...\n');

// Use ip-api.com for verification
http = require('http');
http.get(`http://ip-api.com/json/${testIP}`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const result = JSON.parse(data);
        console.log('Real-world verification:');
        console.log(`  IP: ${result.query}`);
        console.log(`  ISP: ${result.isp}`);
        console.log(`  Org: ${result.org}`);
        console.log(`  AS: ${result.as}`);
        console.log(`  Country: ${result.country}`);
        
        const isActuallyProton = result.org?.toLowerCase().includes('proton') || 
                                 result.isp?.toLowerCase().includes('proton') ||
                                 result.as?.includes('AS198310') || 
                                 result.as?.includes('AS213269');
        
        if (isActuallyProton) {
            console.log('\n✓ VERIFIED: This IP belongs to ProtonVPN');
        } else {
            console.log('\n✗ WARNING: This IP does NOT belong to ProtonVPN!');
            console.log('   Detection is INCORRECT - IP range is wrong');
        }
    });
}).on('error', (err) => {
    console.error('WHOIS lookup failed:', err.message);
});

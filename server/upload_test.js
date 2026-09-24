const http = require('http');
const fs = require('fs');
const path = require('path');

const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
const filePath = path.join(__dirname, 'temp_upload.csv');

try {
    const fileContent = fs.readFileSync(filePath);

    const postDataStart = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="caseNumber"',
        '',
        'TEST-CASE-NODE-UPLOAD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="file"; filename="temp_upload.csv"`,
        'Content-Type: text/csv',
        '',
        ''
    ].join('\r\n');

    const postDataEnd = `\r\n--${boundary}--`;

    const options = {
        hostname: '127.0.0.1',
        port: 8080,
        path: '/cdr/uploadCSV',
        method: 'POST',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': Buffer.byteLength(postDataStart) + fileContent.length + Buffer.byteLength(postDataEnd)
        }
    };

    console.log('Sending request to http://127.0.0.1:8080/cdr/uploadCSV...');

    const req = http.request(options, (res) => {
        console.log(`STATUS: ${res.statusCode}`);
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            console.log(`BODY: ${chunk}`);
        });
        res.on('end', () => {
            console.log('No more data in response.');
        });
    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    req.write(postDataStart);
    req.write(fileContent);
    req.write(postDataEnd);
    req.end();

} catch (err) {
    console.error('File Error:', err.message);
}

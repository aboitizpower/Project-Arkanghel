const http = require('http');

// Test the dashboard endpoint
const testDashboard = async () => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 8081,
            path: '/employee/dashboard/1',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`Status Code: ${res.statusCode}`);
                console.log('Response Headers:', JSON.stringify(res.headers, null, 2));
                console.log('Response Body:', data);
                resolve({ statusCode: res.statusCode, body: data });
            });
        });

        req.on('error', (error) => {
            console.error('Error:', error);
            reject(error);
        });

        req.end();
    });
};

// Run the test
testDashboard()
    .then(() => console.log('Test completed'))
    .catch(err => console.error('Test failed:', err));

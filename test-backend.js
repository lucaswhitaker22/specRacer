#!/usr/bin/env node

const http = require('http');

console.log('🔍 Testing Text Racing MMO Backend...\n');

function testEndpoint(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: jsonBody
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runTests() {
  const tests = [
    {
      name: 'Health Check',
      path: '/health',
      method: 'GET'
    },
    {
      name: 'Get Cars',
      path: '/api/cars',
      method: 'GET'
    },
    {
      name: 'Register User',
      path: '/api/auth/register',
      method: 'POST',
      data: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'testpass123'
      }
    }
  ];

  for (const test of tests) {
    try {
      console.log(`🧪 Testing ${test.name}...`);
      const result = await testEndpoint(test.path, test.method, test.data);
      
      if (result.status >= 200 && result.status < 300) {
        console.log(`✅ ${test.name}: ${result.status} - OK`);
      } else if (result.status === 409 && test.name === 'Register User') {
        console.log(`✅ ${test.name}: ${result.status} - User already exists (OK)`);
      } else {
        console.log(`⚠️  ${test.name}: ${result.status} - ${JSON.stringify(result.body)}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: Connection failed - ${error.message}`);
      if (error.code === 'ECONNREFUSED') {
        console.log('   💡 Backend server is not running. Start it with: npm run dev:backend');
        break;
      }
    }
    console.log('');
  }
}

runTests();
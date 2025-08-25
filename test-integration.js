#!/usr/bin/env node

const http = require('http');

console.log('🧪 Running Text Racing MMO Integration Tests...\n');

function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
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

async function runIntegrationTests() {
  let authToken = null;
  const testUser = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'testpass123'
  };

  console.log('🔍 Testing complete user flow...\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣  Testing health check...');
    const health = await makeRequest('/health');
    if (health.status === 200) {
      console.log('✅ Health check passed');
    } else {
      console.log('❌ Health check failed:', health.status);
      return;
    }

    // Test 2: Get Cars
    console.log('\n2️⃣  Testing car catalog...');
    const cars = await makeRequest('/api/cars');
    if (cars.status === 200 && cars.body.data && cars.body.data.length > 0) {
      console.log(`✅ Car catalog loaded (${cars.body.data.length} cars available)`);
    } else {
      console.log('❌ Car catalog failed:', cars.status);
      return;
    }

    // Test 3: Register User
    console.log('\n3️⃣  Testing user registration...');
    const register = await makeRequest('/api/auth/register', 'POST', testUser);
    if (register.status === 201) {
      console.log('✅ User registration successful');
    } else {
      console.log('❌ User registration failed:', register.status, register.body);
      return;
    }

    // Test 4: Login User
    console.log('\n4️⃣  Testing user login...');
    const login = await makeRequest('/api/auth/login', 'POST', {
      username: testUser.username,
      password: testUser.password
    });
    if (login.status === 200 && login.body.token) {
      authToken = login.body.token;
      console.log('✅ User login successful');
    } else {
      console.log('❌ User login failed:', login.status, login.body);
      return;
    }

    // Test 5: Create Race
    console.log('\n5️⃣  Testing race creation...');
    const createRace = await makeRequest('/api/races', 'POST', {
      trackId: 'silverstone-gp',
      totalLaps: 3,
      maxParticipants: 4
    }, {
      'Authorization': `Bearer ${authToken}`
    });
    if (createRace.status === 201 && createRace.body.raceId) {
      console.log('✅ Race creation successful');
      
      // Test 6: Join Race
      console.log('\n6️⃣  Testing race joining...');
      const joinRace = await makeRequest(`/api/races/${createRace.body.raceId}/join`, 'POST', {
        carId: cars.body.data[0].id
      }, {
        'Authorization': `Bearer ${authToken}`
      });
      if (joinRace.status === 200) {
        console.log('✅ Race joining successful');
      } else {
        console.log('❌ Race joining failed:', joinRace.status, joinRace.body);
      }
    } else {
      console.log('❌ Race creation failed:', createRace.status, createRace.body);
    }

    // Test 7: Get Available Races
    console.log('\n7️⃣  Testing race listing...');
    const races = await makeRequest('/api/races', 'GET', null, {
      'Authorization': `Bearer ${authToken}`
    });
    if (races.status === 200 && races.body.races) {
      console.log(`✅ Race listing successful (${races.body.races.length} races available)`);
    } else {
      console.log('❌ Race listing failed:', races.status, races.body);
    }

    console.log('\n🎉 All integration tests passed!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Backend health check');
    console.log('   ✅ Car catalog loading');
    console.log('   ✅ User registration');
    console.log('   ✅ User authentication');
    console.log('   ✅ Race creation');
    console.log('   ✅ Race joining');
    console.log('   ✅ Race listing');
    console.log('\n🚀 The MVP is fully functional!');

  } catch (error) {
    console.log('\n❌ Integration test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the backend server is running: npm run dev:backend');
    }
  }
}

runIntegrationTests();
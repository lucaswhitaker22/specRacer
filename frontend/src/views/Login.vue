<template>
  <div class="login-view">
    <div class="login-container">
      <div class="login-header">
        <h1>Text Racing MMO</h1>
        <p>Login to start racing</p>
      </div>

      <div class="login-form">
        <div class="form-tabs">
          <button 
            :class="{ active: activeTab === 'login' }"
            @click="activeTab = 'login'"
          >
            Login
          </button>
          <button 
            :class="{ active: activeTab === 'register' }"
            @click="activeTab = 'register'"
          >
            Register
          </button>
        </div>

        <!-- Login Form -->
        <form v-if="activeTab === 'login'" @submit.prevent="handleLogin" class="auth-form">
          <div class="form-group">
            <label for="username">Username</label>
            <input
              id="username"
              v-model="loginForm.username"
              type="text"
              required
              placeholder="Enter your username"
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              v-model="loginForm.password"
              type="password"
              required
              placeholder="Enter your password"
            />
          </div>

          <button type="submit" :disabled="isLoading" class="submit-button">
            {{ isLoading ? 'Logging in...' : 'Login' }}
          </button>
        </form>

        <!-- Register Form -->
        <form v-if="activeTab === 'register'" @submit.prevent="handleRegister" class="auth-form">
          <div class="form-group">
            <label for="reg-username">Username</label>
            <input
              id="reg-username"
              v-model="registerForm.username"
              type="text"
              required
              placeholder="Choose a username"
            />
          </div>

          <div class="form-group">
            <label for="reg-email">Email</label>
            <input
              id="reg-email"
              v-model="registerForm.email"
              type="email"
              required
              placeholder="Enter your email"
            />
          </div>

          <div class="form-group">
            <label for="reg-password">Password</label>
            <input
              id="reg-password"
              v-model="registerForm.password"
              type="password"
              required
              placeholder="Choose a password"
            />
          </div>

          <button type="submit" :disabled="isLoading" class="submit-button">
            {{ isLoading ? 'Creating Account...' : 'Register' }}
          </button>
        </form>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'
import { useErrorStore } from '../stores/error'

const router = useRouter()
const playerStore = usePlayerStore()
const errorStore = useErrorStore()

const activeTab = ref<'login' | 'register'>('login')
const isLoading = ref(false)
const errorMessage = ref('')

const loginForm = ref({
  username: '',
  password: ''
})

const registerForm = ref({
  username: '',
  email: '',
  password: ''
})

const handleLogin = async () => {
  if (isLoading.value) return
  
  isLoading.value = true
  errorMessage.value = ''

  try {
    await playerStore.login(loginForm.value)
    router.push('/')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Login failed'
  } finally {
    isLoading.value = false
  }
}

const handleRegister = async () => {
  if (isLoading.value) return
  
  isLoading.value = true
  errorMessage.value = ''

  try {
    await playerStore.register(registerForm.value)
    router.push('/')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Registration failed'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.login-view {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.login-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  width: 100%;
  max-width: 400px;
}

.login-header {
  background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
  color: white;
  padding: 2rem;
  text-align: center;
}

.login-header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 1.8rem;
  font-weight: 700;
}

.login-header p {
  margin: 0;
  opacity: 0.9;
}

.login-form {
  padding: 2rem;
}

.form-tabs {
  display: flex;
  margin-bottom: 2rem;
  border-bottom: 1px solid #ecf0f1;
}

.form-tabs button {
  flex: 1;
  padding: 1rem;
  border: none;
  background: none;
  color: #7f8c8d;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
}

.form-tabs button.active {
  color: #2c3e50;
  border-bottom-color: #3498db;
}

.form-tabs button:hover {
  color: #2c3e50;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: #2c3e50;
}

.form-group input {
  padding: 0.75rem;
  border: 2px solid #ecf0f1;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #3498db;
}

.submit-button {
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  border: none;
  padding: 1rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  background: #fdeaea;
  color: #e74c3c;
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid #fadbd8;
  margin-top: 1rem;
  text-align: center;
}

@media (max-width: 480px) {
  .login-view {
    padding: 1rem;
  }
  
  .login-container {
    max-width: none;
  }
  
  .login-header,
  .login-form {
    padding: 1.5rem;
  }
}
</style>
<template>
  <div class="error-notifications">
    <transition-group name="error" tag="div">
      <div
        v-for="error in visibleErrors"
        :key="error.id"
        :class="['error-notification', `error-${error.type}`]"
        @click="removeError(error.id)"
      >
        <div class="error-content">
          <div class="error-icon">
            <span v-if="error.type === 'error'">⚠️</span>
            <span v-else-if="error.type === 'warning'">⚠️</span>
            <span v-else>ℹ️</span>
          </div>
          <div class="error-message">
            <div class="error-text">{{ error.message }}</div>
            <div class="error-code">{{ error.code }}</div>
          </div>
          <button class="error-close" @click.stop="removeError(error.id)">
            ×
          </button>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useErrorStore } from '../stores/error'

const errorStore = useErrorStore()

const visibleErrors = computed(() => errorStore.errors)

function removeError(id: string) {
  errorStore.removeError(id)
}
</script>

<style scoped>
.error-notifications {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 1000;
  max-width: 400px;
}

.error-notification {
  margin-bottom: 10px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: all 0.3s ease;
}

.error-notification:hover {
  transform: translateX(-5px);
}

.error-error {
  background-color: #fee;
  border-left: 4px solid #e74c3c;
}

.error-warning {
  background-color: #fff8e1;
  border-left: 4px solid #f39c12;
}

.error-info {
  background-color: #e3f2fd;
  border-left: 4px solid #3498db;
}

.error-content {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
}

.error-icon {
  margin-right: 12px;
  font-size: 18px;
  line-height: 1;
}

.error-message {
  flex: 1;
  min-width: 0;
}

.error-text {
  font-weight: 500;
  color: #2c3e50;
  margin-bottom: 4px;
  word-wrap: break-word;
}

.error-code {
  font-size: 12px;
  color: #7f8c8d;
  font-family: monospace;
}

.error-close {
  background: none;
  border: none;
  font-size: 20px;
  color: #95a5a6;
  cursor: pointer;
  padding: 0;
  margin-left: 12px;
  line-height: 1;
  transition: color 0.2s ease;
}

.error-close:hover {
  color: #2c3e50;
}

/* Transition animations */
.error-enter-active,
.error-leave-active {
  transition: all 0.3s ease;
}

.error-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.error-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.error-move {
  transition: transform 0.3s ease;
}
</style>
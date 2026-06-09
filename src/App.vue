<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <div class="app-layout">
        <Sidebar />
        <main class="app-main">
          <router-view />
        </main>
      </div>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { NConfigProvider, NMessageProvider } from 'naive-ui'
import Sidebar from './components/Sidebar.vue'

const themeOverrides = {
  common: {
    primaryColor: '#1890ff',
    primaryColorHover: '#40a9ff',
    borderRadius: '4px',
  },
}
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
.app-main {
  flex: 1;
  overflow: hidden;
}
</style>

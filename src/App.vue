<template>
  <div class="app-layout">
    <TitleBar />
    <div class="app-body">
      <Sidebar />
      <main class="app-main">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import TitleBar from './components/TitleBar.vue'
import Sidebar from './components/Sidebar.vue'
</script>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.app-main {
  flex: 1;
  overflow: hidden;
}
</style>

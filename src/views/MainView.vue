<template>
  <div class="main-view">
    <FilterPanel />
    <FileTable />
  </div>
</template>

<script setup lang="ts">
import FilterPanel from '@/components/FilterPanel.vue'
import FileTable from '@/components/FileTable.vue'
</script>

<style scoped>
.main-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}
</style>

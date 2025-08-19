<template>
  <div id="app">
    <Match3 />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import Match3 from '/src/components/Game.vue';

export default defineComponent({
  name: 'App',
  components: { Match3 },
});
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
body {
  margin: 0;
}
</style>

<template>
    <div class="container field-play">
        <span class="text-play">{{ text }}</span>

<!--        <figure class="hold-icon sticky-icon">-->
<!--            <img src="/images/icon01.png" width="46" height="63" alt="image" class="animate-rotate">-->
<!--        </figure>-->
    </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'GameLoader',
  props: {
    text: {
      type: String,
      default: 'Game loading...',
    },
  },
});
</script>

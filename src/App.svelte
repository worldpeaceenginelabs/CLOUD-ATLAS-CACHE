<script lang="ts">
  import AddMapmarker from "./Cache.svelte";
  // import Appsearch from "./Dappstore/Appsearch.svelte";
  import { writable } from 'svelte/store';

</script>

<!-- Hidden component off-screen -->
<div style="position: absolute; left: -9999px; top: -9999px;">
  <AddMapmarker />
</div>
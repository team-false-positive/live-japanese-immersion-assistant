// Runs before capi.js. Creates the engine's Module object and a promise that
// resolves when the engine's runtime is ready. Kept in its own file because
// the extension policy blocks inline <script> blocks.
window.engineReady = new Promise((resolve) => {
  window.Module = { onRuntimeInitialized: () => resolve() };
});

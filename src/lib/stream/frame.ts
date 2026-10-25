/**
 * The next animation frame, or a 50 ms timeout if frames are throttled (an occluded or background
 * view never fires `requestAnimationFrame`), whichever comes first. Returns a cancel function.
 */
export function nextFrame(callback: (now: number) => void): () => void {
  let pending = true;
  const run = () => {
    if (!pending) return;
    cancel();
    callback(performance.now());
  };
  const raf = requestAnimationFrame(run);
  const timer = setTimeout(run, 50);
  function cancel() {
    pending = false;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
  }
  return cancel;
}

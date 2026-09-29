// Placeholder from the foundation package. Owner: puzzle-run package (replaces this file).
import * as ui from '../core/ui.js';

export default {
  id: 'run',
  chrome: 'none',
  title: ctx => ({college: 'College', mystery: 'Mystery player', grid: 'Grid'})[ctx.params.puzzle] || 'Puzzles',
  render(ctx) {
    const t = typeof this.title === 'function' ? this.title(ctx) : this.title;
    return '<div style="height:calc(56px + env(safe-area-inset-top,0px));padding:env(safe-area-inset-top,0px) 4px 0;display:flex;align-items:center">' + ui.iconButton({icon: 'close', label: 'Close', attrs: 'data-back'}) + '</div>' + ui.largeTitle({title: t}) + '<div class="mt-16">' + ui.skeleton('rows', 5) + '</div><p class="note">Building this screen.</p>';
  }
};

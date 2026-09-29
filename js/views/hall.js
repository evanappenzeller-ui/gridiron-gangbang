// Placeholder from the foundation package. Owner: hall package (replaces this file).
import * as ui from '../core/ui.js';

export default {
  id: 'hall',
  title: 'Hall',
  render(ctx) {
    const t = typeof this.title === 'function' ? this.title(ctx) : this.title;
    return ui.largeTitle({title: t}) + '<div class="mt-16">' + ui.skeleton('rows', 5) + '</div><p class="note">Building this screen.</p>';
  }
};

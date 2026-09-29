// Placeholder from the foundation package. Owner: profile package (replaces this file).
import * as ui from '../core/ui.js';
import {name} from '../core/data.js';
export default {
  id: 'profile',
  title: ctx => name(ctx.params.id),
  render(ctx) {
    const t = typeof this.title === 'function' ? this.title(ctx) : this.title;
    return ui.largeTitle({title: t}) + '<div class="mt-16">' + ui.skeleton('rows', 5) + '</div><p class="note">Building this screen.</p>';
  }
};

// Shared stadium artwork for legacy and current Rivals battles.
import * as D from '../core/dynasty.js';
import {esc} from '../core/data.js';

export function athleteHTML(id, role, label = (D.card(id) || D.trainer(id))?.name || 'Card') {
  const c = D.card(id), team = c && D.teamOf(c.team);
  // Vector athletes remain crisp at phone and desktop sizes and need no downloaded animation assets.
  return `<div class="db-cinema-player is-${role}" style="--jersey:${esc(team?.pri || '#436D7B')}"><svg class="db-athlete" viewBox="0 0 160 220" aria-hidden="true">
    <ellipse cx="80" cy="211" rx="50" ry="7" fill="#0004"/>
    <g stroke="#152530" stroke-width="4" stroke-linejoin="round">
      <path d="M55 143L77 146 65 192 43 196 45 184Z" fill="#F0EEE3"/><path d="M84 145L105 141 125 181 115 196 97 187Z" fill="#F0EEE3"/>
      <path d="M43 188L66 190 67 207 32 207Q30 198 43 188Z" fill="#23353D"/><path d="M110 187L126 184 139 203 114 209 102 201Z" fill="#23353D"/>
      <path d="M49 76L31 92 18 126 34 133 55 105Z" fill="var(--jersey)"/><path d="M109 76L129 89 146 115 133 129 105 104Z" fill="var(--jersey)"/>
      <path d="M20 119L35 126 49 114 58 127 35 144 14 133Z" fill="#C88E64"/><path d="M137 112L148 120 134 143 112 138 114 122 130 127Z" fill="#C88E64"/>
      <path d="M48 78Q80 62 111 78L111 116 104 151 55 151 47 115Z" fill="var(--jersey)"/>
      <path d="M54 144H105V155H54Z" fill="#F0EEE3"/>
      <rect x="68" y="55" width="25" height="22" rx="8" fill="#C88E64"/>
      <path d="M51 38Q51 9 80 9 111 9 112 40L107 61 91 71 61 63Z" fill="var(--jersey)"/>
      <path d="M75 12V32M58 38H111" fill="none" stroke="#F0EEE3" stroke-width="7"/>
      <path d="M87 40H113L109 62H86Z" fill="#162D3C"/><path d="M83 46H118V65H88Z" fill="none" stroke="#D5DFE0" stroke-width="3"/>
    </g><text x="80" y="124" transform="${role === 'defender' ? 'translate(160 0) scale(-1 1)' : ''}" text-anchor="middle" fill="#FFF" font-family="sans-serif" font-size="34" font-weight="900">${esc(c?.num || c?.pos || 'R')}</text>
    </svg><b>${esc(label)}</b><small>${role === 'attacker' ? 'On the attack' : 'Defending'}</small></div>`;
}

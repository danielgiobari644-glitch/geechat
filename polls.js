// GeeChat — polls: creation, live voting, real-time results.
import { store, votePoll, closePoll, createPoll, subscribeUser } from './database.js';
import { el, icon, avatarEl, openModal, toast, hydrateIcons } from './ui.js';

export function renderPollCard(poll, msg, { convId } = {}) {
  const card = el('div', {});
  const voters = Object.entries(poll.votes || {});
  const myVote = (poll.votes || {})[store.uid] || null;
  const expired = poll.expiresAt?.toMillis ? poll.expiresAt.toMillis() < Date.now() : false;
  const closed = poll.closed || expired;
  const counts = poll.options.map((_, i) => voters.filter(([, idxs]) => idxs.includes(i)).length);
  const total = poll.multiple ? voters.length : voters.length; // voters, not votes
  const maxCount = Math.max(1, ...counts);

  const head = el('div', { class: 'card-head' },
    el('span', { class: 'ch-icon' }, icon('bar-chart')),
    el('div', {},
      el('b', { text: poll.question }),
      el('small', { text: poll.multiple ? 'Select all that apply' : 'Choose one option' }),
    ),
  );
  const body = el('div', { class: 'card-body' });

  const refresh = () => {
    const voters2 = Object.entries(poll.votes || {});
    const my2 = (poll.votes || {})[store.uid] || null;
    const closed2 = poll.closed || (poll.expiresAt?.toMillis ? poll.expiresAt.toMillis() < Date.now() : false);
    const counts2 = poll.options.map((_, i) => voters2.filter(([, idxs]) => idxs.includes(i)).length);
    const total2 = Math.max(1, voters2.length);
    body.innerHTML = '';

    poll.options.forEach((opt, i) => {
      const pct = Math.round((counts2[i] / (poll.multiple ? Math.max(1, counts2.reduce((a, b) => a + b, 0)) : total2)) * 100);
      const lead = counts2[i] === Math.max(...counts2, 0) && counts2[i] > 0;
      const mine = my2?.includes(i);
      if (!my2 && !closed2) {
        const input = el('input', { type: poll.multiple ? 'checkbox' : 'radio', name: `poll-${poll.id}` });
        const row = el('label', { class: `poll-opt${poll.multiple ? ' multi' : ''}` },
          input,
          el('span', { class: 'opt-mark' }),
          el('span', { class: 'opt-text' }, el('span', { text: opt })),
        );
        input.addEventListener('change', () => {
          if (poll.multiple) return; // handled by submit button
          castVote([i]);
        });
        body.append(row);
      } else {
        const row = el('button', { type: 'button', class: `poll-opt${mine ? ' mine' : ''}`, style: 'width:100%;text-align:left;', onclick: () => {
          if (closed2) return;
          castVote(mine ? [i] : [i]); // re-vote / change vote
        } },
          el('span', { class: `opt-mark${mine ? ' checked' : ''}` }),
          el('span', { class: 'opt-row' },
            el('span', { class: 'opt-text' },
              el('span', {}, el('span', { text: opt }), mine ? el('span', { class: 'lead-lbl', text: 'Your vote' }) : null, lead && !mine ? el('span', { class: 'lead-lbl', text: 'Leading' }) : null),
              el('small', { text: `${pct}%` }),
            ),
            el('span', { class: `opt-bar${lead ? ' lead' : ''}` }, el('i', { style: `width:${pct}%` })),
          ),
        );
        row.querySelector('.opt-mark').style.cssText = mine ? 'border-color:var(--green);background:var(--pale);' : '';
        body.append(row);
      }
    });

    if (poll.multiple && !my2 && !closed2) {
      body.append(el('button', { class: 'btn-small', onclick: () => {
        const inputs = [...body.querySelectorAll('input')];
        const picks = inputs.map((inp, i) => (inp.checked ? i : -1)).filter(i => i >= 0);
        if (!picks.length) return toast('Select at least one option');
        castVote(picks);
      } }, icon('check'), 'Submit vote'));
    }

    const foot = el('div', { class: 'poll-foot' },
      el('div', { class: 'pf-left' },
        icon('users'),
        el('span', { text: `${voters2.length} vote${voters2.length === 1 ? '' : 's'}` }),
        poll.anonymous ? el('span', { class: 'pill-tag gray', text: 'Anonymous' }) : null,
      ),
      el('span', {},
        closed2
          ? el('span', { class: 'poll-closed', text: poll.closed ? 'Voting closed' : 'Expired' })
          : poll.expiresAt ? el('span', { text: `Ends ${new Date(poll.expiresAt.toMillis()).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` }) : null,
        (poll.createdBy === store.uid && !poll.closed)
          ? el('button', { class: 'linklike', style: 'margin-left:10px;', onclick: async () => { await closePoll(poll.id); toast('Poll closed', 'Voting is now closed for everyone.'); } }, 'Close poll') : null,
      ),
    );
    body.append(foot);
  };
  refresh();

  async function castVote(indexes) {
    try {
      await votePoll(poll.id, indexes, { multiple: poll.multiple });
      toast('Vote recorded', 'Results updated live for everyone.', { icon: 'bar-chart' });
    } catch (err) {
      toast('Vote failed', err.message, { error: true });
    }
  }

  card.append(head, body);
  hydrateIcons(card);
  return card;
}

// ---------- composer ----------
export function openPollComposer(convId, { preset = null } = {}) {
  const isCopy = !!preset;
  const question = el('input', { placeholder: 'Ask a question…', value: preset?.question || '', maxlength: 240 });
  question.style.cssText = inputCss();
  const optsWrap = el('div', { style: 'display:flex;flex-direction:column;gap:8px;' });
  const addOption = (val = '') => {
    if (optsWrap.children.length >= 8) return;
    const row = el('div', { style: 'display:flex;gap:8px;align-items:center;' });
    const inp = el('input', { placeholder: `Option ${optsWrap.children.length + 1}`, value: val, maxlength: 80 });
    inp.style.cssText = inputCss();
    const rm = el('button', { class: 'icon-btn plain', 'aria-label': 'Remove option', onclick: () => row.remove() }, icon('x'));
    row.append(inp, optsWrap.children.length >= 2 ? rm : el('span'));
    optsWrap.append(row);
  };
  addOption(preset?.options?.[0] || '');
  addOption(preset?.options?.[1] || '');
  if (preset) preset.options.slice(2).forEach(o => addOption(o));

  const multiple = el('input', { type: 'checkbox' });
  multiple.checked = !!preset?.multiple;
  const anonymous = el('input', { type: 'checkbox' });
  anonymous.checked = !!preset?.anonymous;
  const expiry = el('select');
  expiry.style.cssText = inputCss();
  expiry.append(
    el('option', { value: '0', text: 'No expiry' }),
    el('option', { value: '1', text: '1 hour' }),
    el('option', { value: '24', text: '1 day' }),
    el('option', { value: '72', text: '3 days' }),
  );

  const err = el('div', { class: 'auth-error hidden' });
  const body = el('div', {},
    question,
    el('div', { class: 'mini-title', text: 'Options', style: 'margin-top:10px;' }),
    optsWrap,
    el('button', { class: 'btn-ghost', style: 'align-self:flex-start;', onclick: () => addOption() }, icon('plus'), 'Add option'),
    el('div', { class: 'seg-row', style: 'padding:8px 0 0;' },
      el('label', { class: 'check' }, multiple, el('i'), el('span', { text: 'Allow multiple choices' })),
      el('label', { class: 'check' }, anonymous, el('i'), el('span', { text: 'Anonymous voting' })),
    ),
    el('div', { class: 'mini-title', text: 'Expiry', style: 'margin-top:8px;' }), expiry,
    err,
  );
  openModal({
    title: isCopy ? 'Forward poll' : 'Create poll', icon: 'bar-chart', body, wide: true,
    actions: [
      { label: 'Cancel', class: 'btn-ghost' },
      { label: 'Share poll', class: 'btn-small', onClick: async (close) => {
        const options = [...optsWrap.querySelectorAll('input')].map(i => i.value.trim()).filter(Boolean);
        try {
          if (!question.value.trim()) throw new Error('Please enter a question.');
          if (options.length < 2 || new Set(options.map(o => o.toLowerCase())).size !== options.length) {
            throw new Error('Add at least two different options.');
          }
          await createPoll(convId, {
            question: question.value.trim(), options,
            multiple: multiple.checked, anonymous: anonymous.checked,
            expiresHours: Number(expiry.value),
          });
          close();
          toast('Poll shared', 'Participants can vote right from the chat.');
        } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
      } },
    ],
  });
}

function inputCss() {
  return 'width:100%;padding:11px 14px;border-radius:14px;border:1px solid var(--border);background:var(--surface);color:var(--text);';
}

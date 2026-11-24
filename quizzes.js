// GeeChat — quizzes: builder, in-chat player with timer, scoring, results.
import { store, createQuiz, submitQuizAttempt, subscribeQuizAttempts, subscribeUser } from './database.js';
import { el, icon, openModal, toast, fmtDuration, hydrateIcons } from './ui.js';

// ---------- card ----------
export function renderQuizCard(quiz, msg, { convId } = {}) {
  const card = el('div', {});
  const attempted = quiz.attempts?.[store.uid];
  const myAttempt = quiz.myAttempt || null;

  const head = el('div', { class: 'card-head' },
    el('span', { class: 'ch-icon' }, icon('clipboard-check')),
    el('div', {},
      el('b', { text: quiz.title }),
      el('small', { text: quiz.description || `${quiz.questions.length} questions${quiz.timeLimitMin ? ` · ${quiz.timeLimitMin} min` : ''}` }),
    ),
  );
  const body = el('div', { class: 'card-body' });
  const foot = el('div', { class: 'card-foot' });

  // Track my attempt lazily
  let hasAttempt = null;
  const unsub = subscribeQuizAttempts(quiz.id, attempts => {
    const mine = attempts.find(a => a.uid === store.uid);
    hasAttempt = mine || null;
    if (quiz.createdBy === store.uid) {
      foot.innerHTML = '';
      foot.append(el('span', { text: `${attempts.length} attempt${attempts.length === 1 ? '' : 's'}` }),
        el('button', { class: 'linklike strong', onclick: () => openResults(quiz, attempts) }, 'View results'));
    } else if (mine) {
      foot.innerHTML = '';
      foot.append(el('span', { text: `Your score: ${mine.score}/${mine.total}` }),
        el('button', { class: 'linklike strong', onclick: () => openPlayer(quiz, true) }, 'Retake'));
    }
  });
  cardCleanup(quiz.id, unsub);

  const startBtn = el('button', { class: 'btn-small', style: 'align-self:center;', onclick: () => openPlayer(quiz, false) },
    icon('play'), quiz.createdBy === store.uid ? 'Preview quiz' : 'Start Quiz');
  body.append(startBtn);
  card.append(head, body, foot);
  hydrateIcons(card);
  return card;
}

const cardSubs = new Map();
function cardCleanup(quizId, unsub) {
  if (cardSubs.has(quizId)) cardSubs.get(quizId)();
  cardSubs.set(quizId, unsub);
}
export function teardownQuizSubs() {
  for (const u of cardSubs.values()) u();
  cardSubs.clear();
}

// ---------- player ----------
function openPlayer(quiz, retake = false) {
  const qs_ = quiz.questions;
  let idx = 0;
  let answers = new Array(qs_.length).fill(-1);
  let correct = 0;
  let timerIv = null;
  let timeLeft = (quiz.timeLimitMin || 0) * 60;

  const body = el('div', { class: 'quiz-player' });
  const progress = el('div', { class: 'quiz-progress' }, el('i', { style: 'width:0%' }));
  const timerLbl = el('div', { class: 'quiz-timer' }, el('span', { text: `Question 1 of ${qs_.length}` }),
    quiz.timeLimitMin ? el('span', { text: fmtDuration(timeLeft) }) : null);
  const qZone = el('div', {});

  const modal = openModal({ title: quiz.title, icon: 'clipboard-check', body, onClose: () => clearInterval(timerIv) });
  body.append(progress, timerLbl, qZone);

  const finish = async () => {
    clearInterval(timerIv);
    correct = qs_.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0);
    try {
      await submitQuizAttempt(quiz.id, quiz.conversationId || null, [...answers], correct, qs_.length);
    } catch (err) {
      toast('Could not save result', err.message, { error: true });
    }
    qZone.innerHTML = '';
    const pct = Math.round((correct / qs_.length) * 100);
    qZone.append(el('div', { class: 'quiz-score' },
      el('div', { class: 'big', text: `${correct}/${qs_.length}` }),
      el('p', { text: pct >= 80 ? 'Excellent work! 🎉' : pct >= 50 ? 'Nice effort — keep practising!' : 'Keep going, you will get there!' }),
      el('button', { class: 'btn-small', style: 'margin-top:8px;', onclick: () => modal.close() }, 'Done'),
    ));
    timerLbl.innerHTML = '';
    timerLbl.append(el('span', { text: 'Completed' }));
    progress.querySelector('i').style.width = '100%';
  };

  const startTimer = () => {
    if (!quiz.timeLimitMin) return;
    timerIv = setInterval(() => {
      timeLeft -= 1;
      timerLbl.querySelector('span:last-child').textContent = fmtDuration(Math.max(0, timeLeft));
      if (timeLeft <= 0) { finish(); }
    }, 1000);
  };

  function renderQ() {
    const q = qs_[idx];
    timerLbl.querySelector('span').textContent = `Question ${idx + 1} of ${qs_.length}`;
    progress.querySelector('i').style.width = `${(idx / qs_.length) * 100}%`;
    const zone = el('div', {});
    zone.append(el('div', { class: 'quiz-q' }, el('b', { text: `Q${idx + 1}. ` }), q.text));
    const ans = el('div', { class: 'quiz-ans', style: 'margin-top:10px;' });
    q.options.forEach((opt, oi) => {
      const btn = el('button', { text: opt, onclick: () => {
        answers[idx] = oi;
        const isRight = oi === q.correct;
        btn.classList.add(isRight ? 'correct' : 'wrong');
        if (!isRight) ans.children[q.correct].classList.add('correct');
        [...ans.children].forEach(b => b.disabled = true);
        if (q.explanation) zone.append(el('div', { class: 'quiz-exp', text: q.explanation }));
        setTimeout(() => { idx += 1; if (idx >= qs_.length) finish(); else renderQ(); }, 900);
      } });
      ans.append(btn);
    });
    zone.append(ans);
    qZone.innerHTML = '';
    qZone.append(zone);
  }

  startTimer();
  renderQ();
}

// ---------- results (creator) ----------
function openResults(quiz, attempts) {
  const list = el('div', { class: 'sr-list scroll-y', style: 'max-height:360px;' });
  if (!attempts.length) list.append(el('div', { class: 'pk-empty', text: 'No one has taken this quiz yet.' }));
  attempts.forEach(a => {
    subscribeUser(a.uid, u => {
      const row = el('div', { class: 'user-row', style: 'margin:0;' },
        el('div', { class: 'ur-mid' },
          el('b', { text: u?.displayName || 'User' }),
          el('small', { text: `@${u?.username || ''} · ${new Date(a.completedAt?.toMillis?.() || Date.now()).toLocaleString()}` }),
        ),
        el('span', { class: 'pill-tag', text: `${a.score}/${a.total}` }),
      );
      const existing = [...list.children].find(c => c.dataset.uid === a.uid);
      if (existing) existing.replaceWith(row);
      else { row.dataset.uid = a.uid; list.append(row); }
    });
  });
  openModal({ title: `Results — ${quiz.title}`, icon: 'bar-chart', body: list, wide: true });
}

// ---------- composer ----------
export function openQuizComposer(convId, { preset = null } = {}) {
  const isCopy = !!preset;
  const title = el('input', { placeholder: 'Quiz title', value: preset?.title || '', maxlength: 120 });
  const desc = el('input', { placeholder: 'Short description (optional)', value: preset?.description || '', maxlength: 240 });
  title.style.cssText = desc.style.cssText = inputCss();
  const qWrap = el('div', { style: 'display:flex;flex-direction:column;gap:12px;' });
  const timeLimit = el('select');
  timeLimit.style.cssText = inputCss();
  timeLimit.append(
    el('option', { value: '0', text: 'No time limit' }),
    el('option', { value: '1', text: '1 minute per quiz' }),
    el('option', { value: '3', text: '3 minutes' }),
    el('option', { value: '5', text: '5 minutes' }),
  );
  if (preset?.timeLimitMin) timeLimit.value = String(preset.timeLimitMin);

  const addQuestion = (q = null) => {
    if (qWrap.children.length >= 10) return;
    const num = qWrap.children.length + 1;
    const qText = el('input', { placeholder: `Question ${num}`, value: q?.text || '', maxlength: 240 });
    qText.style.cssText = inputCss();
    const optsWrap = el('div', { style: 'display:flex;flex-direction:column;gap:6px;' });
    let correctIdx = q?.correct ?? 0;
    const optInputs = [];
    const addOpt = (val = '', isCorrect = false) => {
      if (optsWrap.children.length >= 4) return;
      const oi = optInputs.length;
      const radio = el('input', { type: 'radio', name: `correct-${num}-${Date.now()}-${oi}` });
      radio.checked = isCorrect || (correctIdx === oi && optsWrap.children.length === correctIdx);
      radio.addEventListener('change', () => { correctIdx = oi; });
      const inp = el('input', { placeholder: `Option ${oi + 1}`, value: val, maxlength: 100 });
      inp.style.cssText = inputCss();
      const row = el('label', { style: 'display:flex;gap:8px;align-items:center;' }, radio, inp);
      optInputs.push({ inp, radio });
      optsWrap.append(row);
    };
    (q?.options || ['', '']).forEach((o, i) => addOpt(o, q?.correct === i));
    const expl = el('input', { placeholder: 'Explanation (optional)', value: q?.explanation || '', maxlength: 200 });
    expl.style.cssText = inputCss();
    const rm = el('button', { class: 'btn-ghost', onclick: () => card.remove() }, icon('trash-2', 'ic-16'), 'Remove question');
    const card = el('div', { style: 'border:1px solid var(--border);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;' },
      qText, optsWrap,
      el('div', { class: 'mini-title', text: 'Tick the correct answer' }),
      expl, rm);
    qWrap.append(card);
  };
  addQuestion(preset?.questions?.[0] || null);
  if (preset) preset.questions.slice(1).forEach(q => addQuestion(q));

  const err = el('div', { class: 'auth-error hidden' });
  openModal({
    title: isCopy ? 'Forward quiz' : 'Create quiz', icon: 'clipboard-check', wide: true,
    body: el('div', {}, title, desc,
      el('div', { class: 'mini-title', text: 'Questions', style: 'margin-top:10px;' }),
      qWrap,
      el('button', { class: 'btn-ghost', style: 'align-self:flex-start;', onclick: () => addQuestion() }, icon('plus'), 'Add question'),
      el('div', { class: 'mini-title', text: 'Time limit', style: 'margin-top:10px;' }),
      timeLimit, err),
    actions: [
      { label: 'Cancel', class: 'btn-ghost' },
      { label: 'Share quiz', class: 'btn-small', onClick: async (close) => {
        try {
          const questions = [...qWrap.children].map(card => {
            const nonRadio = [...card.querySelectorAll('input:not([type="radio"])')];
            const radios = [...card.querySelectorAll('input[type="radio"]')];
            const optIdx = radios.map((r, i) => r.checked ? i : -1).filter(i => i >= 0);
            const qText = nonRadio[0].value.trim();
            const opts = nonRadio.slice(1, -1).map(i => i.value.trim());
            const explanation = nonRadio.at(-1).value.trim();
            return { text: qText, options: opts, correct: optIdx[0] ?? 0, explanation };
          });
          if (!title.value.trim()) throw new Error('Please enter a quiz title.');
          if (!questions.length) throw new Error('Add at least one question.');
          for (const [i, q] of questions.entries()) {
            if (!q.text) throw new Error(`Question ${i + 1} needs text.`);
            if (q.options.filter(Boolean).length < 2) throw new Error(`Question ${i + 1} needs at least 2 options.`);
          }
          await createQuiz(convId, {
            title: title.value.trim(),
            description: desc.value.trim(),
            questions: questions.map(q => {
              // keep only filled options; keep the marked-correct one in position
              const kept = q.options.map((o, i) => ({ o, i })).filter(x => x.o);
              const correct = kept.findIndex(x => x.i === q.correct);
              return { text: q.text, options: kept.map(x => x.o), correct: correct >= 0 ? correct : 0, explanation: q.explanation };
            }),
            timeLimitMin: Number(timeLimit.value),
          });
          close();
          toast('Quiz shared', 'Participants can take it right from the chat.');
        } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
      } },
    ],
  });
}

function inputCss() {
  return 'width:100%;padding:11px 14px;border-radius:14px;border:1px solid var(--border);background:var(--surface);color:var(--text);';
}

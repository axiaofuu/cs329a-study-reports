const progress = document.querySelector('#progress');
const navLinks = [...document.querySelectorAll('#toc a')];
const sections = [...document.querySelectorAll('[data-section]')];

function updateProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = max > 0 ? window.scrollY / max : 0;
  progress.style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
}

const sectionObserver = new IntersectionObserver((entries) => {
  const visible = entries
    .filter((entry) => entry.isIntersecting)
    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  navLinks.forEach((link) => link.classList.toggle('active', link.hash === `#${visible.target.id}`));
}, { rootMargin: '-20% 0px -68% 0px', threshold: [0, .2, .5] });

sections.forEach((section) => sectionObserver.observe(section));
window.addEventListener('scroll', updateProgress, { passive: true });
updateProgress();

const search = document.querySelector('#transcript-search');
const transcriptBlocks = [...document.querySelectorAll('.transcript-block')];
function filterTranscript() {
  const query = search.value.trim().toLowerCase();
  transcriptBlocks.forEach((block) => {
    block.hidden = Boolean(query) && !block.dataset.search.includes(query);
  });
}
search.addEventListener('input', filterTranscript);
document.querySelector('#clear-search').addEventListener('click', () => {
  search.value = '';
  filterTranscript();
  search.focus();
});

const quizForm = document.querySelector('#quiz-form');
const copyStatus = document.querySelector('#copy-status');
document.querySelector('#copy-answers').addEventListener('click', async () => {
  const data = new FormData(quizForm);
  const answers = Array.from({ length: 8 }, (_, index) => {
    const key = `q${index + 1}`;
    return `${index + 1}. ${data.get(key) || '未答'}`;
  });
  const text = `CS329A Part 2 测试作答\n${answers.join('\n')}`;
  try {
    await navigator.clipboard.writeText(text);
    copyStatus.textContent = '答案已复制。';
  } catch {
    copyStatus.textContent = text;
  }
});

document.querySelector('#clear-answers').addEventListener('click', () => {
  quizForm.reset();
  copyStatus.textContent = '';
});

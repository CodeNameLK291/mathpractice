// Ensure the script runs after the DOM is ready and fail fast if critical elements are missing
document.addEventListener('DOMContentLoaded', () => {
	// 간단한 산수 문제 생성기 및 진행 로직
	(() => {
		// 요소 참조
		const el = id => document.getElementById(id);
		const minEl = el('min'), maxEl = el('max'), countEl = el('count');
		const startBtn = el('start'), submitBtn = el('submit'), nextBtn = el('next');
		const showAllBtn = el('show-all'), printBtn = el('print-all'), showAnswersChk = el('show-answers');
		const printColsEl = el('print-cols');
		const layoutEl = el('layout');
		const allowNegEl = el('allow-negative'); // 음수 허용 여부
		const questionEl = el('question'), answerEl = el('answer'), feedbackEl = el('feedback');
		const statusEl = el('status');
		const currentEl = el('current'), totalEl = el('total'), correctEl = el('correct'), wrongEl = el('wrong');
		const allListEl = el('allList'), allSectionEl = el('allQuestions');
		const modeInteractiveBtn = el('mode-interactive'), modePrintBtn = el('mode-print');

		function setMode(m){
			const interactiveControls = document.querySelector('.controls.interactive-controls');
			const printControls = document.querySelector('.controls.print-controls');
			if(m === 'print'){
				activeMode = 'print';
				if(interactiveControls) interactiveControls.style.display = 'none';
				if(printControls) printControls.style.display = 'flex';
				// hide the quiz UI (interactive) but keep all-questions visible
				document.querySelector('.quiz').style.display = 'none';
				document.querySelector('.scoreboard').style.display = 'none';
				// ensure all-questions shown and generated
				showAll();
				allSectionEl.style.display = 'block';
				modePrintBtn.classList.add('active'); modePrintBtn.setAttribute('aria-pressed','true');
				modeInteractiveBtn.classList.remove('active'); modeInteractiveBtn.setAttribute('aria-pressed','false');
			} else {
				activeMode = 'interactive';
				if(interactiveControls) interactiveControls.style.display = '';
				if(printControls) printControls.style.display = 'none';
				// show interactive UI
				document.querySelector('.quiz').style.display = '';
				document.querySelector('.scoreboard').style.display = '';
				allSectionEl.style.display = 'none';
				modeInteractiveBtn.classList.add('active'); modeInteractiveBtn.setAttribute('aria-pressed','true');
				modePrintBtn.classList.remove('active'); modePrintBtn.setAttribute('aria-pressed','false');
			}
		}

		let questions = [], idx = 0, stats = {correct:0, wrong:0};
		let activeMode = 'interactive'; // 'interactive' | 'print'

		function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }

		// 선택된 연산들 반환
		function getSelectedOps(){
			return Array.from(document.querySelectorAll('input[name="ops"]:checked')).map(i => i.value);
		}

		function makeOne(opOrArr,min,max){
			let a = randInt(min,max), b = randInt(min,max), q='', ans=0;
			let op = opOrArr;
			if(Array.isArray(opOrArr)){
				if(opOrArr.length === 0) op = 'add';
				else op = opOrArr[Math.floor(Math.random()*opOrArr.length)];
			}
			switch(op){
				case 'add': q=`${a} + ${b}`; ans = a+b; break;
				case 'sub':
					// 음수 허용 체크박스가 없거나 체크되어 있지 않으면 큰 수를 앞에 오게 함
					const allowNeg = !!(allowNegEl && allowNegEl.checked);
					if (!allowNeg && a < b) [a, b] = [b, a];
					q = `${a} - ${b}`; ans = a - b; break;
				case 'mul': q=`${a} × ${b}`; ans = a*b; break;
				case 'div':
					ans = randInt(Math.max(1,min),Math.max(1,max));
					b = randInt(Math.max(1,min),Math.max(1,max));
					a = ans * b;
					q = `${a} ÷ ${b}`; break;
			}
			return {q,ans};
		}

		function generate(op,min,max,count){
			const arr = [];
			for(let i=0;i<count;i++) arr.push(makeOne(op,min,max));
			return arr;
		}

		function render(){
			totalEl.textContent = questions.length;
			currentEl.textContent = Math.min(idx+1, questions.length);
			correctEl.textContent = stats.correct;
			wrongEl.textContent = stats.wrong;
			if(idx >= questions.length){
				statusEl.textContent = '끝났습니다.';
				questionEl.textContent = `결과: ${stats.correct} / ${questions.length} (정답률 ${Math.round((stats.correct/questions.length)*100)||0}%)`;
				answerEl.disabled = true;
				submitBtn.disabled = true;
				nextBtn.disabled = true;
				return;
			}
			statusEl.textContent = `문제 ${idx+1} / ${questions.length}`;
			// render question differently when in interactive mode: default to vertical layout
			if(activeMode === 'interactive'){
				// always prefer vertical for interactive per user request
				const it = questions[idx];
				const m = it.q.match(/^(.+)\s*([\+\-\×\÷])\s*(.+)$/);
				if(m){
					const a = m[1].trim(), op = m[2].trim(), b = m[3].trim();
					questionEl.innerHTML = `<div class="prob vertical">
						<div class="op-a">${a}</div>
						<div class="op-b"><span class="op-symbol">${op}</span><span class="op-num">${b}</span></div>
						<div class="rule"></div>
					</div>`;
				} else {
					questionEl.textContent = questions[idx].q;
				}
			} else {
				questionEl.textContent = questions[idx].q;
			}
			answerEl.value = '';
			answerEl.disabled = false;
			submitBtn.disabled = false;
			nextBtn.disabled = true;
			feedbackEl.textContent = '';
			answerEl.focus();
			updateButtonStyles();
		}

		function start(){
			const sel = getSelectedOps();
			const op = sel.length ? sel : ['add'];
			let min = parseInt(minEl.value,10) || 1;
			let max = parseInt(maxEl.value,10) || 10;
			const count = Math.max(1, parseInt(countEl.value,10) || 10);
			if(min > max) [min,max] = [max,min];
			questions = generate(op, min, max, count);
			idx = 0; stats = {correct:0, wrong:0};
			render();
		}

		function submitAnswer(){
			if(idx >= questions.length) return;
			const userRaw = answerEl.value.trim();
			if(userRaw === '') { feedbackEl.textContent = '답을 입력해 주세요.'; return; }
			const user = Number(userRaw);
			const real = questions[idx].ans;
			const isCorrect = Math.abs(user - real) < 1e-9;
			if(isCorrect){
				feedbackEl.textContent = '정답!';
				stats.correct++;
			} else {
				feedbackEl.textContent = `오답. 정답: ${real}`;
				stats.wrong++;
			}
			submitBtn.disabled = true;
			nextBtn.disabled = false;
			updateButtonStyles();
			render();
		}

		function next(){
			idx++;
			render();
			updateButtonStyles();
		}

		function updateButtonStyles(){
			if(!submitBtn || !nextBtn) return;
			// submit: enabled -> blue (no secondary), disabled -> gray (secondary)
			if(submitBtn.disabled) submitBtn.classList.add('secondary'); else submitBtn.classList.remove('secondary');
			// next: enabled -> blue, disabled -> gray
			if(nextBtn.disabled) nextBtn.classList.add('secondary'); else nextBtn.classList.remove('secondary');
		}

		// 캐시된 모두보기 목록 (생성 후 재사용)
		let cachedAllList = null;

		// 주어진 목록을 사용해 화면에 렌더 (정답 토글만 수행)
		function renderAll(list, showAnswers){
			// 항상 그리드 배치. 각 li는 번호(.num)와 내용(.content)으로 구성
			const cols = (printColsEl && printColsEl.value) ? printColsEl.value : 2;
			const layoutMode = (layoutEl && String(layoutEl.value || '').toLowerCase()) || 'vertical';
			const isVertical = layoutMode === 'vertical' || layoutMode.startsWith('vert');

			const itemsHtml = list.map((it, i) => {
				const idx = i + 1;
				if(isVertical){
					const m = it.q.match(/^(.+)\s*([\+\-\×÷])\s*(.+)$/);
					if(m){
						const a = m[1].trim(), op = m[2].trim(), b = m[3].trim();
						// op and number separated so the number can be right-aligned
						return `<li>
							<div class="num">${idx}.</div>
							<div class="content">
								<div class="prob vertical">
									<div class="op-a">${a}</div>
									<div class="op-b"><span class="op-symbol">${op}</span><span class="op-num">${b}</span></div>
									<div class="rule"></div>
									${showAnswers ? `<div class="ans">= ${it.ans}</div>` : ''}
								</div>
							</div>
						</li>`;
					}
				}
				// 가로형(기본): 항상 "=" 표기, 정답은 showAnswers에서만 보임
				return `<li>
					<div class="num">${idx}.</div>
					<div class="content"><div class="prob simple">${it.q} =${showAnswers ? ' ' + it.ans : ''}</div></div>
				</li>`;
			}).join('');

			const wrapperClass = isVertical ? 'all-list-wrap vertical-mode' : 'all-list-wrap';
			allListEl.innerHTML = `<div class="${wrapperClass}" style="--print-cols:${cols}"><ol class="grid">${itemsHtml}</ol></div>`;
			allSectionEl.style.display = 'block';
		}

		// 모두보기 (인쇄용 목록 생성)
		function showAll(){
			const sel = getSelectedOps();
			const op = sel.length ? sel : ['add'];
			let min = parseInt(minEl.value,10) || 1;
			let max = parseInt(maxEl.value,10) || 10;
			const count = Math.max(1, parseInt(countEl.value,10) || 10);
			if(min > max) [min,max] = [max,min];
			// 새로 생성한 목록을 캐시에 저장하고 렌더
			cachedAllList = generate(op, min, max, count);
			renderAll(cachedAllList, showAnswersChk.checked);
		}

		// print: 인쇄 시 정답을 강제하지 않음(사용자 체크 상태에 따름)
		printBtn.addEventListener('click', () => {
			if(allListEl.firstElementChild && printColsEl){
				const wrap = allListEl.querySelector('.all-list-wrap');
				if(wrap) wrap.style.setProperty('--print-cols', printColsEl.value);
			}
			window.print();
		});

		// Mode tab events
		if(modeInteractiveBtn) modeInteractiveBtn.addEventListener('click', () => setMode('interactive'));
		if(modePrintBtn) modePrintBtn.addEventListener('click', () => setMode('print'));

		// set default mode: interactive (mobile-friendly)
		setMode('interactive');
		// printCols 변경 시 미리보기 반영
		if(printColsEl) printColsEl.addEventListener('change', () => {
			const wrap = allListEl.querySelector('.all-list-wrap');
			if(wrap) wrap.style.setProperty('--print-cols', printColsEl.value);
		});
		showAnswersChk.addEventListener('change', () => {
			// 모두보기 영역이 보이는 상태이면 캐시된 목록 재사용해 정답 토글만 수행
			if(allSectionEl.style.display !== 'none'){
				if(cachedAllList) renderAll(cachedAllList, showAnswersChk.checked);
				else showAll(); // 캐시가 없으면 생성
			}
		});
		if (layoutEl) layoutEl.addEventListener('change', () => {
			if(allSectionEl.style.display !== 'none' && cachedAllList) renderAll(cachedAllList, showAnswersChk.checked);
		});
		answerEl.addEventListener('keydown', (e) => {
			if(e.key === 'Enter') submitAnswer();
		});

		// bind start button to begin the quiz
		if (startBtn) startBtn.addEventListener('click', start);
		// bind show-all button to display all generated problems
		if (showAllBtn) showAllBtn.addEventListener('click', showAll);

		// Guard: if key UI elements are missing, warn and stop to avoid silent no-op
		if (!el('start') || !el('answer') || !el('question')) {
			console.warn('app.js: required UI elements missing (start/answer/question). Verify IDs in index.html or script placement.');
			return;
		}

		// 초기 렌더
		render();
	})();
});

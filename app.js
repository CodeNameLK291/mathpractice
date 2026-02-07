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
		const wrongListEl = el('wrongList'), resultsSection = el('results');
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
				// ensure all-questions shown and generated (print view must NOT include answers or wrong-list)
				showAll();
				if(cachedAllList) renderAll(cachedAllList, false); // force hide answers in print
				allSectionEl.style.display = 'block';
				// hide wrong/results section for print
				if(resultsSection) resultsSection.style.display = 'none';
				if(wrongListEl) wrongListEl.style.display = 'none';
				// hide the show-answers checkbox control in print mode
				if(showAnswersChk) showAnswersChk.style.display = 'none';
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
				// restore show-answers control visibility
				if(showAnswersChk) showAnswersChk.style.display = '';
				if(resultsSection) resultsSection.style.display = 'none';
				if(wrongListEl) wrongListEl.style.display = '';
			}
		}

		let questions = [], idx = 0, stats = {correct:0, wrong:0};
		let wrongList = [];
		let answered = [];
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
				// show wrong list
				if(resultsSection) resultsSection.style.display = '';
				if(wrongListEl){
					if(wrongList.length === 0) wrongListEl.innerHTML = '<div>(모든 문제 정답)</div>';
					else {
						const html = wrongList.map((w,i) => `<div class="wrong-item"><strong>${w.index}.</strong> ${w.q} — 당신: ${w.user} · 정답: ${w.real}</div>`).join('');
						wrongListEl.innerHTML = html;
					}
				}
				return;
			}
			statusEl.textContent = `문제 ${idx+1} / ${questions.length}`;
			// render question differently when in interactive mode: default to vertical layout
			if(activeMode === 'interactive'){
				// prefer vertical for interactive; if multi-digit addition, render columnar digit boxes
				const it = questions[idx];
				const m = it.q.match(/^(.+)\s*([\+\-\×\÷])\s*(.+)$/);
				if(m){
					const a = m[1].trim(), op = m[2].trim(), b = m[3].trim();
					if((op === '+' || op === '-') && Math.max(a.length, b.length) >= 2){
						if(op === '+') renderColumnarAddition(a, b);
						else renderColumnarSubtraction(a, b);
					} else {
						questionEl.innerHTML = `<div class="prob vertical">
							<div class="op-a">${a}</div>
							<div class="op-b"><span class="op-symbol">${op}</span><span class="op-num">${b}</span></div>
							<div class="rule"></div>
						</div>`;
					}
				} else {
					questionEl.textContent = questions[idx].q;
				}
			} else {
				questionEl.textContent = questions[idx].q;
			}
			answerEl.value = '';
			answerEl.disabled = false;
			// Button rules: if not last question -> Next enabled, Submit disabled
			// if last question -> Submit enabled, Next disabled
			const lastIndex = Math.max(0, questions.length - 1);
			if(idx < lastIndex){
				submitBtn.disabled = true;
				nextBtn.disabled = false;
			} else {
				submitBtn.disabled = false;
				nextBtn.disabled = true;
			}
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
			wrongList = [];
			answered = new Array(questions.length).fill(false);
			if(resultsSection) resultsSection.style.display = 'none';
			render();
		}

		function submitAnswer(){
			if(idx >= questions.length) return;
			// If submit button is disabled, do nothing
			if(submitBtn && submitBtn.disabled) return;
			if(!evaluateCurrentAnswer()) return;
			// If this was the last question, advance index to mark completion and render results
			const lastIndex = Math.max(0, questions.length - 1);
			if(idx === lastIndex){
				idx = questions.length; // mark finished
				render();
				updateButtonStyles();
				return;
			}
			// fallback: enable next and render
			submitBtn.disabled = true;
			nextBtn.disabled = false;
			updateButtonStyles();
			render();
		}

		// Evaluate current answer and update stats/feedback. Returns true if evaluated (non-empty answer), false otherwise.
		function evaluateCurrentAnswer(){
			if(idx >= questions.length) return false;
			// avoid double-evaluating the same question
			if(answered[idx]) return true;
			// if columnar digit inputs present, read them
			const colContainer = questionEl.querySelector('.digit-grid');
			let user, real = questions[idx].ans, isCorrect;
			if(colContainer){
				// read answer digit inputs (data-pos from right)
				const inputs = Array.from(colContainer.querySelectorAll('input[data-role="ans"]'));
				if(inputs.length === 0) return false;
				const digitsByPos = {};
				inputs.forEach(inp => { digitsByPos[Number(inp.dataset.pos)] = inp.value.trim() || '0'; });
				const maxPos = Math.max(...inputs.map(i => Number(i.dataset.pos)));
				let s = '';
				for(let p = maxPos; p >= 0; p--){ s += (digitsByPos[p] || '0'); }
				user = Number(s);
				if(isNaN(user)) { return false; }
				// For columnar problems we do not simply compare whole number; prefer column validation
				// Fallback: allow full-number check as final guard
				isCorrect = Math.abs(user - real) < 1e-9;
			} else {
				const userRaw = answerEl.value.trim();
				if(userRaw === '') { return false; }
				user = Number(userRaw);
				isCorrect = Math.abs(user - real) < 1e-9;
			}
			if(isCorrect){
				stats.correct++;
			} else {
				stats.wrong++;
				// record wrong item
				wrongList.push({ index: idx+1, q: questions[idx].q, user: user, real: real });
			}
			answered[idx] = true;
			return true;
		}

		// Column-level validation helpers and keypad
		let activeColumn = 0; // 0 = ones
		function setActiveColumn(pos){
			activeColumn = pos;
			const boxes = questionEl.querySelectorAll('.digit-box');
			boxes.forEach(b => b.classList.remove('active'));
			const carry = questionEl.querySelector(`input[data-role="carry"][data-pos="${pos}"]`);
			const ans = questionEl.querySelector(`input[data-role="ans"][data-pos="${pos}"]`);
			if(carry) carry.parentElement.classList.add('active');
			if(ans) ans.parentElement.classList.add('active');
		}

		function validateColumn(pos, op){
			// returns true if column passes
			const maxLen = Math.max(...Array.from(questionEl.querySelectorAll('input[data-role="ans"]')).map(i=>Number(i.dataset.pos)));
			const aDigits = Array.from(questionEl.querySelectorAll('.digit-row'));// not used here
			// read digits from displayed a/b rows
			const aElems = questionEl.querySelectorAll('.prob .op-a, .digit-grid .op-num');
			// simpler: parse original question string
			const it = questions[idx];
			const m = it.q.match(/^(.+)\s*([\+\-\×\÷])\s*(.+)$/);
			if(!m) return false;
			const A = m[1].trim(); const B = m[3].trim();
			const aDigitsArr = A.split('').map(x=>Number(x));
			const bDigitsArr = B.split('').map(x=>Number(x));
			const getDigit = (arr, pos) => {
				const idx = arr.length - 1 - pos;
				return idx>=0? arr[idx] : 0;
			};
			const posFromRight = pos;
			if(op === '+'){
				const carryInInput = questionEl.querySelector(`input[data-role="carry"][data-pos="${pos}"]`);
				const ansInput = questionEl.querySelector(`input[data-role="ans"][data-pos="${pos}"]`);
				const userCarryIn = pos===0?0: Number((carryInInput && carryInInput.value.trim())||'0');
				const userAns = Number((ansInput && ansInput.value.trim())||'');
				if(Number.isNaN(userAns)) { return false; }
				const a = getDigit(aDigitsArr,posFromRight), b = getDigit(bDigitsArr,posFromRight);
				const sum = a + b + userCarryIn;
				const expectedAns = sum % 10;
				const expectedCarryOut = Math.floor(sum/10);
				if(userAns !== expectedAns){ ansInput.parentElement.classList.add('wrong'); return false; }
				// mark correct ans
				ansInput.parentElement.classList.remove('wrong'); ansInput.parentElement.classList.add('correct');
				// now check next column's carry_in if exists (user must enter carry somewhere else)
				const nextCarry = questionEl.querySelector(`input[data-role="carry"][data-pos="${pos+1}"]`);
				if(nextCarry){
					const userNextCarry = Number((nextCarry.value.trim())||'0');
					if(userNextCarry !== expectedCarryOut){ nextCarry.parentElement.classList.add('wrong'); return false; }
					nextCarry.parentElement.classList.remove('wrong'); nextCarry.parentElement.classList.add('correct');
				}
                
				return true;
			} else if(op === '-'){
				const borrowInput = questionEl.querySelector(`input[data-role="carry"][data-pos="${pos}"]`);
				const ansInput = questionEl.querySelector(`input[data-role="ans"][data-pos="${pos}"]`);
				const userBorrow = (borrowInput && borrowInput.value.trim() === '10') ? 1 : 0;
				const userAns = Number((ansInput && ansInput.value.trim())||'');
				if(Number.isNaN(userAns)) { return false; }
				const a = getDigit(aDigitsArr,posFromRight), b = getDigit(bDigitsArr,posFromRight);
				// borrow semantics: if userBorrow is 1, that means they borrow from next higher digit
				const prevRaw = pos===0? '0' : ((questionEl.querySelector(`input[data-role="carry"][data-pos="${pos-1}"]`)||{value:'0'}).value.trim() || '0');
				const prevBorrow = (prevRaw === '10') ? 1 : 0;
				const a_eff = a - prevBorrow;
				const a_eff2 = a_eff + (userBorrow ? 10 : 0);
				const expectedAns = a_eff2 - b;
				if(userAns !== expectedAns){ ansInput.parentElement.classList.add('wrong'); return false; }
				ansInput.parentElement.classList.remove('wrong'); ansInput.parentElement.classList.add('correct');
                
				return true;
			}
			return false;
		}

		function moveToNextColumn(op){
			const maxPos = Math.max(...Array.from(questionEl.querySelectorAll('input[data-role="ans"]')).map(i=>Number(i.dataset.pos)));
			if(activeColumn < maxPos){ setActiveColumn(activeColumn+1); }
			else {
				// finished columns
				answered[idx] = true;
				// update stats and buttons
				stats.correct++;
				const lastIndex = Math.max(0, questions.length - 1);
				if(idx === lastIndex){ submitBtn.disabled = false; nextBtn.disabled = true; }
				else { submitBtn.disabled = true; nextBtn.disabled = false; }
				updateButtonStyles();
			}
		}

		// Keypad UI
		let activeInput = null;
		function createKeypad(){
			if(document.querySelector('.num-keypad')) return;
			const kp = document.createElement('div'); kp.className = 'num-keypad';
			kp.innerHTML = `
				<div class="keys">
					<button class="key">1</button><button class="key">2</button><button class="key">3</button>
					<button class="key">4</button><button class="key">5</button><button class="key">6</button>
					<button class="key">7</button><button class="key">8</button><button class="key">9</button>
					<button class="key">0</button><button class="key">↺</button><button class="key">✕</button>
				</div>
				<div class="controls"><button class="ok-keypad">확인</button><button class="close-keypad">닫기</button></div>`;
			document.body.appendChild(kp);
			// helper to commit current active input (validate and maybe advance)
			function commitActiveInput(){
				if(!activeInput) return;
				const pos = Number(activeInput.dataset.pos || 0);
				const op = questionEl.dataset.op || '+';
				const ok = validateColumn(pos, op);
				if(ok){ moveToNextColumn(op); }
				kp.classList.remove('show'); activeInput = null;
			}
			kp.addEventListener('click', (e)=>{
				const t = e.target;
				if(!t.classList.contains('key') && !t.classList.contains('close-keypad') && !t.classList.contains('ok-keypad')) return;
				if(!activeInput){ if(t.classList.contains('close-keypad')){ kp.classList.remove('show'); } return; }
				if(t.classList.contains('close-keypad')){ kp.classList.remove('show'); activeInput = null; return; }
				if(t.classList.contains('ok-keypad')){ commitActiveInput(); return; }
				const v = t.textContent.trim();
				if(v === '✕'){ activeInput.value = ''; activeInput.parentElement.classList.remove('correct','wrong'); return; }
				if(v === '↺'){ activeInput.value = activeInput.value.slice(0,-1); return; }
				// digit handling
				const maxlen = Number(activeInput.dataset.maxlen) || 1;
				if(maxlen === 1){ activeInput.value = v; commitActiveInput(); }
				else { activeInput.value = (activeInput.value + v).slice(-maxlen); }
			});
		}

		function showKeypadFor(inp){ createKeypad(); const kp = document.querySelector('.num-keypad'); activeInput = inp; kp.classList.add('show'); }


		function renderColumnarAddition(aStr, bStr){
			// digits as arrays
			const aDigits = aStr.split('').map(d => d);
			const bDigits = bStr.split('').map(d => d);
			const maxLen = Math.max(aDigits.length, bDigits.length);
			// compute sum length (BigInt-safe) and allow extra most-significant digit
			let sumVal;
			try { sumVal = (BigInt(aStr) + BigInt(bStr)).toString(); } catch(e) { sumVal = String(Number(aStr) + Number(bStr)); }
			const ansLen = Math.max(maxLen, sumVal.length);
			// build rows: carry (empty inputs), a row, b row (with +), rule, answer row (inputs)
			let carryHtml = '<div class="digit-row digit-carry-row">';
			for(let i=0;i<ansLen;i++) carryHtml += `<div class="digit-box"><input data-role="carry" data-pos="${i}" maxlength="1" inputmode="numeric" pattern="[0-9]" /></div>`;
			carryHtml += '</div>';
			let aHtml = '<div class="digit-row">';
			// pad left so a row has ansLen boxes and is right-aligned
			const lead = ansLen - maxLen;
			for(let i=0;i<lead;i++) aHtml += `<div class="digit-box"></div>`;
			for(let i=0;i<maxLen;i++){
				const d = aDigits[aDigits.length - maxLen + i] || '';
				aHtml += `<div class="digit-box"><div class="op-num">${d}</div></div>`;
			}
			aHtml += '</div>';
			let bHtml = '<div class="digit-row">';
			// pad left so b row aligns with a and answer; then place operator before the rightmost digits
			for(let i=0;i<lead;i++) bHtml += `<div class="digit-box"></div>`;
			bHtml += `<div class="op-symbol">+</div>`;
			for(let i=0;i<maxLen;i++){
				const d = bDigits[bDigits.length - maxLen + i] || '';
				bHtml += `<div class="digit-box"><div class="op-num">${d}</div></div>`;
			}
			bHtml += '</div>';
			const ruleHtml = '<div class="digit-rule"></div>';
			let ansHtml = '<div class="digit-row answer-row">';
			for(let i=0;i<ansLen;i++){
				const pos = ansLen - 1 - i; // pos from right
				ansHtml += `<div class="digit-box"><input data-role="ans" data-pos="${pos}" maxlength="1" inputmode="numeric" pattern="[0-9]" /></div>`;
			}
			ansHtml += '</div>';
			questionEl.innerHTML = `<div class="digit-grid">${carryHtml}${aHtml}${bHtml}${ruleHtml}${ansHtml}</div>`;
			questionEl.dataset.op = '+';
			// add simple input handlers: allow only digits and show keypad on focus/click
			const inputs = questionEl.querySelectorAll('input[data-role]');
			inputs.forEach(inp => {
				inp.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^0-9]/g,'').slice(-1); });
				inp.addEventListener('focus', (e) => { showKeypadFor(e.target); e.target.select(); });
				inp.addEventListener('click', (e) => { showKeypadFor(e.target); });
			});
			// initialize active column to ones (pos 0)
			activeColumn = 0;
			setActiveColumn(0);
			createKeypad();
		}

		function renderColumnarSubtraction(aStr, bStr){
			// use carry inputs as borrow inputs for subtraction (0/1)
			const aDigits = aStr.split('').map(d => d);
			const bDigits = bStr.split('').map(d => d);
			const maxLen = Math.max(aDigits.length, bDigits.length);
			// borrow inputs: allow up to 2 chars (e.g., show '10') for transformed display
			let borrowHtml = '<div class="digit-row digit-carry-row">';
			for(let i=0;i<maxLen;i++) borrowHtml += `<div class="digit-box"><input data-role="carry" data-pos="${i}" data-maxlen="2" maxlength="2" inputmode="numeric" pattern="[0-9]*" /></div>`;
			borrowHtml += '</div>';
			let aHtml = '<div class="digit-row">';
			for(let i=0;i<maxLen;i++){
				const posFromRight = maxLen - 1 - i;
				const d = aDigits[aDigits.length - maxLen + i] || '';
				// add data-role/data-pos so user can toggle struck by clicking
				aHtml += `<div class="digit-box" data-role="top-digit" data-pos="${posFromRight}"><div class="op-num">${d}</div></div>`;
			}
			aHtml += '</div>';
			let bHtml = '<div class="digit-row">';
			bHtml += `<div class="op-symbol">-</div>`;
			for(let i=0;i<maxLen;i++){
				const d = bDigits[bDigits.length - maxLen + i] || '';
				bHtml += `<div class="digit-box"><div class="op-num">${d}</div></div>`;
			}
			bHtml += '</div>';
			const ruleHtml = '<div class="digit-rule"></div>';
			let ansHtml = '<div class="digit-row answer-row">';
			for(let i=0;i<maxLen;i++){
				const pos = maxLen - 1 - i;
				ansHtml += `<div class="digit-box"><input data-role="ans" data-pos="${pos}" maxlength="1" inputmode="numeric" pattern="[0-9]" /></div>`;
			}
			ansHtml += '</div>';
			// single innerHTML assignment (no automatic transformed hints)
			questionEl.innerHTML = `<div class="digit-grid">${borrowHtml}${aHtml}${bHtml}${ruleHtml}${ansHtml}</div>`;
			questionEl.dataset.op = '-';
			const inputs = questionEl.querySelectorAll('input[data-role]');
			inputs.forEach(inp => {
				inp.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^0-9]/g,'').slice(0, Number(inp.dataset.maxlen) || 1); });
				inp.addEventListener('focus', (e) => { showKeypadFor(e.target); e.target.select(); });
				inp.addEventListener('click', (e) => { showKeypadFor(e.target); });
			});
			// allow users to toggle struck on top digits by clicking the top digit box
			const topDigits = questionEl.querySelectorAll('.digit-box[data-role="top-digit"]');
			topDigits.forEach(td => td.addEventListener('click', () => td.classList.toggle('struck')));
			activeColumn = 0; setActiveColumn(0); createKeypad();
		}

		function next(){
			// Evaluate current answer first; require an answer to advance
			if(!evaluateCurrentAnswer()) return;
			// advance to next question
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
			if(e.key === 'Enter'){
				if(submitBtn && !submitBtn.disabled) submitAnswer();
				else if(nextBtn && !nextBtn.disabled) next();
			}
		});

		// bind start button to begin the quiz
		if (startBtn) startBtn.addEventListener('click', start);
		// bind show-all button to display all generated problems
		if (showAllBtn) showAllBtn.addEventListener('click', showAll);

		// bind submit/next buttons
		if (submitBtn) submitBtn.addEventListener('click', submitAnswer);
		if (nextBtn) nextBtn.addEventListener('click', next);

		// Guard: if key UI elements are missing, warn and stop to avoid silent no-op
		if (!el('start') || !el('answer') || !el('question')) {
			console.warn('app.js: required UI elements missing (start/answer/question). Verify IDs in index.html or script placement.');
			return;
		}

		// 초기 렌더
		render();
	})();
});

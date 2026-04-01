const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSis_C0X3WkqRuCSpnxDPx0nkZBYnD2EUgyTpPQvAbSG_fTw3yVLjv4eCxyPjHW4xk_4RAWT7Hi_uIu/pub?output=tsv';

const introScreen = document.getElementById('intro-screen');
const worldviewScreen = document.getElementById('worldview-screen');
const gameScreen = document.getElementById('game-screen');
const titleEl = document.getElementById('stage-title');
const descEl = document.getElementById('stage-desc');
const inputEl = document.getElementById('answer-input');
const messageEl = document.getElementById('message-text');
const successPopup = document.getElementById('success-popup');
const hintPopup = document.getElementById('hint-popup');
const hintTextEl = document.getElementById('hint-text');
const popupKeyword = document.getElementById('popup-keyword');
const popupText = document.getElementById('popup-text');
const celebrationOverlay = document.getElementById('celebration-overlay');
const prevBtn = document.getElementById('prev-btn');
const mainContainer = document.getElementById('main-ui');

let gameData = [];
let currentStageIndex = 0;
let noiseAnimId = null; // TV 노이즈 애니메이션 ID

async function fetchGameData() {
    try {
        const cacheBuster = `&t=${new Date().getTime()}`;
        const response = await fetch(SHEET_URL + cacheBuster);
        const data = await response.text();
        const rows = data.split('\n');
        const headers = rows[0].split('\t').map(header => header.trim());
        gameData = []; 
        for (let i = 1; i < rows.length; i++) {
            if (!rows[i].trim()) continue; 
            const values = rows[i].split('\t');
            let stageObj = {};
            for (let j = 0; j < headers.length; j++) {
                stageObj[headers[j]] = values[j] ? values[j].trim() : "";
            }
            gameData.push(stageObj);
        }
    } catch (error) { console.error("데이터 연동 실패:", error); }
}

// 배경 이미지 preload 유틸 (Promise 반환, 로딩 완료 후 resolve)
function preloadImage(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => resolve(url); // 실패해도 진행
        img.src = url;
    });
}

// 다음 스테이지 배경 이미지 미리 캐싱 (백그라운드 preload)
function preloadNextBackground(currentIndex) {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= gameData.length) return;
    const nextUrl = (nextIndex === gameData.length - 1)
        ? 'bg_clear.webp'
        : `bg_stage${nextIndex + 1}.webp`;
    preloadImage(nextUrl); // 결과 무시, 캐시 목적
}

window.onload = function() {
    document.body.style.backgroundImage = "url('bg_intro.webp')";
    fetchGameData(); 
    successPopup.classList.add('hidden');
    hintPopup.classList.add('hidden');
};

function showWorldview() {
    introScreen.classList.add('hidden');
    worldviewScreen.classList.remove('hidden');
    document.body.style.backgroundImage = "url('bg_default.webp')";
    const video = document.getElementById('prologue-video');
    video.play().catch(() => { video.muted = true; video.play(); });
    window.scrollTo(0, 0); // 💡 상단 이동
}

function checkMissionCode() {
    const inputCode = document.getElementById('mission-code-input').value.trim();
    const requiredCode = gameData[0]?.missionCode?.toString().trim() || "0303";
    if (inputCode === requiredCode) {
        document.getElementById('prologue-video').pause();
        startGame(); 
    } else {
        const err = document.getElementById('mission-error-text');
        err.innerText = "❌ 접근 거부: 코드 오류";
        err.style.animation = "shake 0.3s";
        setTimeout(() => err.style.animation = "", 300);
    }
}

function startGame() { worldviewScreen.classList.add('hidden'); loadStage(); }

/* ─────────────────────────────────────────
   📺 스테이지 인트로: 배경 위 지직 효과
   흐름: 배경 표시 → 지직거리며 3초 → 게임 컨테이너 페이드인
───────────────────────────────────────── */

// 노이즈 캔버스: 낮은 해상도로 픽셀 노이즈 렌더링 (배경 위에 살짝만)
function renderNoise(canvas) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const imageData = ctx.createImageData(W, H);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const v = Math.random() * 255 | 0;
        data[i] = v; data[i+1] = v; data[i+2] = v;
        data[i+3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
}

// 간헐적 글리치 가로선: 가끔만 등장해서 지직 느낌
function maybeGlitchLine(canvas) {
    if (Math.random() > 0.92) { // 8% 확률로만 등장
        const ctx = canvas.getContext('2d');
        const y = Math.random() * canvas.height | 0;
        const h = (Math.random() * 3 + 1) | 0;
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.15})`;
        ctx.fillRect(0, y, canvas.width, h);
    }
}

// 스테이지 인트로 실행
// 1) 스테이지 배경을 body에 적용 (전면에 보이도록)
// 2) game-container는 숨긴 채 지직 오버레이만 올림
// 3) 3초 후 지직 페이드아웃 → 게임 컨테이너 페이드인
function showStageIntro(stageIndex, callback) {
    const glitchEl = document.getElementById('glitch-overlay');
    const canvas   = document.getElementById('noise-canvas');
    const mainUI   = document.getElementById('main-ui');

    // ① 캔버스 저해상도 설정 (픽셀 뭉개짐으로 레트로 노이즈 느낌)
    canvas.width  = 120;
    canvas.height = 213;

    // ④ 지직 오버레이 표시
    glitchEl.classList.remove('hidden', 'fade-out');
    glitchEl.style.opacity = '1';

    // ⑤ 노이즈 루프 시작
    if (noiseAnimId) cancelAnimationFrame(noiseAnimId);
    let frame = 0;
    function noiseLoop() {
        // 매 2프레임마다 노이즈 갱신 (너무 빠르지 않게)
        if (frame % 2 === 0) renderNoise(canvas);
        maybeGlitchLine(canvas);
        frame++;
        noiseAnimId = requestAnimationFrame(noiseLoop);
    }
    noiseLoop();

    // ⑥ 2.4초 후 지직 페이드아웃 시작 (총 3초 = 2.4s + 0.6s 페이드)
    setTimeout(() => {
        glitchEl.classList.add('fade-out');

        // ⑦ 페이드아웃 완료 후: 노이즈 중단 + 게임 컨테이너 등장
        setTimeout(() => {
            cancelAnimationFrame(noiseAnimId);
            noiseAnimId = null;
            glitchEl.classList.add('hidden');
            glitchEl.classList.remove('fade-out');
            callback(); // → loadStage 콜백에서 컨테이너 페이드인
        }, 600);
    }, 2400);
}

function loadStage() {
    window.scrollTo(0, 0);

    const stage = gameData[currentStageIndex];
    const nextBtn = document.getElementById('next-mission-btn');
    const inputSection = document.getElementById('mission-input-section');
    const storyBox = document.querySelector('.story-box');

    // 공통 초기화
    nextBtn.classList.remove('hidden');
    inputSection.classList.add('hidden');
    messageEl.innerText = "";
    inputEl.value = "";
    celebrationOverlay.classList.add('hidden');
    celebrationOverlay.innerHTML = '';
    successPopup.classList.add('hidden');
    hintPopup.classList.add('hidden');
    mainContainer.classList.remove('corona-effect');
    storyBox.classList.remove('clear-mode');

    // ① 배경 이미지 URL 결정 (WebP 우선)
    const bgUrl = (currentStageIndex === gameData.length - 1)
        ? 'bg_clear.webp'
        : `bg_stage${currentStageIndex + 1}.webp`;

    // ② game-container를 투명하게만 (display는 유지 → 나중에 opacity로 페이드인)
    mainContainer.style.opacity = '0';
    mainContainer.style.transition = 'none';

    // ③ 배경 이미지 preload 완료 후 배경 적용 + 지직 효과 시작
    preloadImage(bgUrl).then(() => {
        document.body.style.backgroundImage = `url('${bgUrl}')`;

    // ④ 지직 효과 실행 (배경 로딩 완료 후 시작)
    showStageIntro(currentStageIndex, () => {

        // ④ 지직 끝 → 스테이지 내용 세팅 후 페이드인
        if (currentStageIndex === gameData.length - 1) {
            titleEl.innerHTML = `<span class="golden-glow-animated">🧬 우리라는 이름의 기적 🧬</span>`;
            descEl.innerHTML = stage.desc;
            nextBtn.classList.add('hidden');
            inputSection.classList.add('hidden');
            if (prevBtn) prevBtn.classList.add('hidden');
            mainContainer.classList.add('corona-effect');
            storyBox.classList.add('clear-mode');
            document.getElementById('audio-clear-bgm').play().catch(() => {});
            showCelebrationEffect();
        } else {
            const titleParts = stage.title.split(':');
            if (titleParts.length > 1) {
                titleEl.innerHTML = `${titleParts[0]}<br><span class="stage-subtitle">"${titleParts[1].trim()}"</span>`;
            } else {
                titleEl.innerHTML = stage.title;
            }
            descEl.innerHTML = stage.desc;
            if (prevBtn) {
                if (currentStageIndex === 0) prevBtn.classList.add('hidden');
                else prevBtn.classList.remove('hidden');
            }
        }

        // ⑤ game-screen 표시 확인 후 컨테이너 페이드인
        gameScreen.classList.remove('hidden');
        window.scrollTo(0, 0);
        requestAnimationFrame(() => {
            mainContainer.style.transition = 'opacity 0.7s ease';
            mainContainer.style.opacity = '1';
        });

        // ⑥ 다음 스테이지 배경 미리 캐싱 (백그라운드)
        preloadNextBackground(currentStageIndex);
    }); // showStageIntro 끝
    }); // preloadImage 끝
}

function showMission() {
    window.scrollTo(0, 0); // 미션 확인 시에도 상단으로
    const stage = gameData[currentStageIndex];
    const nextBtn = document.getElementById('next-mission-btn');
    const inputSection = document.getElementById('mission-input-section');
    descEl.innerHTML = `
        <div class="mission-title-box">${stage.missionTitle || "미션 설명"}</div>
        <div class="mission-part"><div class="mission-label">🎯 미션 상세</div><div class="mission-text">${stage.missionDesc}</div></div>
        <div class="mission-part"><div class="mission-label condition">✅ 완료 조건</div><div class="mission-text">${stage.missionCondition}</div></div>
    `;
    nextBtn.classList.add('hidden');
    inputSection.classList.remove('hidden');
    if (prevBtn) prevBtn.classList.remove('hidden');
}

function goBack() {
    const inputSection = document.getElementById('mission-input-section');
    if (!inputSection.classList.contains('hidden')) { loadStage(); } 
    else if (currentStageIndex > 0) { currentStageIndex--; loadStage(); }
}

function checkAnswer() {
    const stage = gameData[currentStageIndex];
    const userAns = inputEl.value.trim();
    if (userAns === "") return;
    if (userAns === stage.answer) {
        popupKeyword.innerHTML = `🃏 <span class="highlight-item">핵심가치: ${stage.keyword}</span> 카드 획득!`;
        popupText.innerHTML = stage.clearText;
        successPopup.classList.remove('hidden'); 
    } else { 
        messageEl.innerText = "❌ 코드 불일치"; 
        messageEl.className = "error";
    }
}

function closePopupAndNext() { successPopup.classList.add('hidden'); currentStageIndex++; loadStage(); }
function showHint() { hintTextEl.innerText = gameData[currentStageIndex].hint; hintPopup.classList.remove('hidden'); }
function closeHint() { hintPopup.classList.add('hidden'); }

function showCelebrationEffect() {
    celebrationOverlay.classList.remove('hidden');
    for (let i = 0; i < 100; i++) { createParticle(); }
}
function createParticle() {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.innerHTML = Math.random() > 0.5 ? '🧬' : '⭐';
    particle.style.left = `${Math.random() * 100}vw`;
    particle.style.animationDuration = `${Math.random() * 3 + 4}s`;
    particle.style.fontSize = `${Math.random() * 1.5 + 1}rem`;
    particle.style.color = '#ffd700';
    celebrationOverlay.appendChild(particle);
    setTimeout(() => { particle.remove(); if (currentStageIndex === gameData.length - 1) createParticle(); }, 5000);
}
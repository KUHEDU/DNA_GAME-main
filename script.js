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
   🎬 스테이지 인트로: 배경 위 짧은 영상 효과
   흐름: 영상 재생(3초) → 페이드아웃 → 게임 컨테이너 페이드인
   각 스테이지별 영상: stage1_intro.mp4 ~ stage5_intro.mp4
───────────────────────────────────────── */

const STAGE_VIDEOS = [
    'stage1_intro.mp4',
    'stage2_intro.mp4',
    'stage3_intro.mp4',
    'stage4_intro.mp4',
    'stage5_intro.mp4'
];

// 스테이지 인트로 영상 재생
// 1) 스테이지 배경을 body에 적용
// 2) 해당 스테이지 영상을 오버레이로 재생 (약 3초)
// 3) 페이드아웃 후 게임 컨테이너 페이드인
function showStageIntro(stageIndex, callback) {
    const overlay  = document.getElementById('stage-video-overlay');
    const videoEl  = document.getElementById('stage-intro-video');
    const fadeEl   = document.getElementById('stage-video-fade');

    const videoSrc = STAGE_VIDEOS[stageIndex] || STAGE_VIDEOS[0];

    // 영상 소스 설정 및 오버레이 표시
    videoEl.src = videoSrc;
    videoEl.currentTime = 0;
    fadeEl.style.opacity = '0';
    fadeEl.style.transition = 'none';

    overlay.classList.remove('hidden', 'svo-fadeout');
    overlay.style.opacity = '1';

    // 영상 로드 후 재생
    videoEl.load();
    videoEl.play().catch(() => {
        // autoplay 실패 시에도 3초 후 콜백
    });

    // 2.4초 후 페이드 오버레이(검정) 페이드인 → 영상 위를 덮어 자연스럽게 전환
    setTimeout(() => {
        fadeEl.style.transition = 'opacity 0.6s ease';
        fadeEl.style.opacity = '1';

        // 0.6초 후 오버레이 제거 & 콜백
        setTimeout(() => {
            videoEl.pause();
            videoEl.src = '';
            overlay.classList.add('hidden');
            overlay.style.opacity = '';
            fadeEl.style.opacity = '0';
            fadeEl.style.transition = 'none';
            callback();
        }, 600);
    }, 2400);
}

/* ─────────────────────────────────────────
   🏆 미션 클리어 전환 효과
   흐름:
     0.15s : 황금 플래시 폭발
     0.4s  : 빛줄기 + 텍스트 팝 등장
     1.4s  : 오버레이 페이드아웃 (배경 드러남)
     1.9s  : 오버레이 완전 제거 → 배경만 2초 노출
     3.9s  : 스토리박스(mainContainer) 페이드인
───────────────────────────────────────── */
function showClearIntro(stageIndex, callback) {
    const overlay = document.getElementById('clear-intro-overlay');
    overlay.innerHTML = '';
    overlay.classList.remove('hidden', 'ci-fadeout');
    overlay.style.opacity = '';

    // ① 황금 플래시 레이어
    const flash = document.createElement('div');
    flash.className = 'ci-flash';
    overlay.appendChild(flash);

    // ② 빛줄기 방사 레이어
    const rays = document.createElement('div');
    rays.className = 'ci-rays';
    overlay.appendChild(rays);

    // ③ 중앙 텍스트
    const label = document.createElement('div');
    label.className = 'ci-label';
    label.innerHTML = '🏆<br>MISSION<br>CLEAR';
    overlay.appendChild(label);

    // ④ 외곽 링 펄스
    const ring = document.createElement('div');
    ring.className = 'ci-ring';
    overlay.appendChild(ring);

    // ⑤ 0.15s: 플래시 폭발
    setTimeout(() => flash.classList.add('ci-flash-burst'), 150);

    // ⑥ 0.4s: 빛줄기 + 텍스트 팝 등장
    setTimeout(() => {
        rays.classList.add('ci-rays-show');
        label.classList.add('ci-label-show');
        ring.classList.add('ci-ring-show');
    }, 400);

    // ⑦ 1.4s: 오버레이 페이드아웃 시작 → 배경화면이 드러남
    setTimeout(() => overlay.classList.add('ci-fadeout'), 1400);

    // ⑧ 1.9s: 오버레이 완전 제거 → 배경만 보이는 상태 진입
    setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('ci-fadeout');
        overlay.innerHTML = '';
        // ⑨ 배경화면을 2초간 노출 후 스토리박스 등장
        setTimeout(() => callback(), 2000);
    }, 1900);
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
    if (celebrationTimer) { clearInterval(celebrationTimer); celebrationTimer = null; }
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

    const isClearStage = (currentStageIndex === gameData.length - 1);

    // ③ 배경 이미지 preload 완료 후 배경 적용 + 전환 효과 시작
    preloadImage(bgUrl).then(() => {
        document.body.style.backgroundImage = `url('${bgUrl}')`;

    // ④ 클리어 화면 / 일반 스테이지 분기
    const introFn = isClearStage ? showClearIntro : showStageIntro;
    introFn(currentStageIndex, () => {

        // ⑤ 전환 끝 → 스테이지 내용 세팅 후 페이드인
        if (isClearStage) {
            titleEl.innerHTML = `<span class="golden-glow-animated">🧬 우리라는 이름의 기적 🧬</span><span class="mission-clear-badge">🏆 MISSION CLEAR 🏆</span>`;
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

        // ⑥ game-screen 표시 확인 후 컨테이너 페이드인
        gameScreen.classList.remove('hidden');
        window.scrollTo(0, 0);
        requestAnimationFrame(() => {
            mainContainer.style.transition = 'opacity 0.7s ease';
            mainContainer.style.opacity = '1';
        });

        // ⑦ 다음 스테이지 배경 미리 캐싱 (백그라운드)
        preloadNextBackground(currentStageIndex);
    }); // introFn 끝
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

let celebrationTimer = null;

function showCelebrationEffect() {
    celebrationOverlay.classList.remove('hidden');
    // 시간차를 두고 분산 생성 (0~3초 사이에 20개를 펼침)
    for (let i = 0; i < 20; i++) {
        setTimeout(() => createParticle(), Math.random() * 3000);
    }
    // 이후 지속적으로 소량씩 생성 (1초당 3~4개)
    celebrationTimer = setInterval(() => {
        if (currentStageIndex === gameData.length - 1) {
            const count = Math.floor(Math.random() * 2) + 3;
            for (let i = 0; i < count; i++) {
                setTimeout(() => createParticle(), Math.random() * 800);
            }
        } else {
            clearInterval(celebrationTimer);
        }
    }, 1000);
}

function createParticle() {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.innerHTML = Math.random() > 0.5 ? '🧬' : '⭐';
    particle.style.left = `${Math.random() * 100}vw`;
    const duration = Math.random() * 3 + 4; // 4~7초
    particle.style.animationDuration = `${duration}s`;
    particle.style.fontSize = `${Math.random() * 1.5 + 1}rem`;
    celebrationOverlay.appendChild(particle);
    // 떨어지고 나면 DOM에서 제거
    setTimeout(() => particle.remove(), duration * 1000 + 200);
}
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

// 다음 스테이지 영상 미리 fetch (브라우저 캐시에 올려두기)
function preloadNextVideo(currentIndex) {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= gameData.length - 1) return; // 마지막(클리어) 스테이지는 영상 없음
    const src = STAGE_VIDEOS[nextIndex];
    if (!src) return;
    const link = document.createElement('link');
    link.rel  = 'prefetch';
    link.as   = 'video';
    link.href = src;
    document.head.appendChild(link);
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
   🎬 스테이지 인트로: 스테이지별 짧은 영상 재생
   흐름:
     배경 preload 완료 → 영상 로딩 → 충분히 버퍼링 후 재생 시작
     5초 풀 재생 (0.7s / 3.0s 두 번 지직) → 0.6s 검정 페이드 → 콜백
───────────────────────────────────────── */

const STAGE_VIDEOS = [
    'stage1_intro.mp4',
    'stage2_intro.mp4',
    'stage3_intro.mp4',
    'stage4_intro.mp4',
    'stage5_intro.mp4'
];

function showStageIntro(stageIndex, callback) {
    const overlay  = document.getElementById('stage-video-overlay');
    const videoEl  = document.getElementById('stage-intro-video');
    const fadeEl   = document.getElementById('stage-video-fade');
    const glitchEl = document.getElementById('video-glitch-layer');

    const videoSrc = STAGE_VIDEOS[stageIndex] || STAGE_VIDEOS[0];

    // ① 초기화
    fadeEl.style.opacity  = '0';
    fadeEl.style.transition = 'none';
    glitchEl.classList.remove('vg-active');
    overlay.classList.remove('hidden');

    // ② 영상 속성 설정
    videoEl.muted    = true;
    videoEl.autoplay = false;
    videoEl.loop     = false;
    videoEl.src      = videoSrc;

    // 이전 타이머 정리용
    let effectTimers = [];
    function clearEffectTimers() {
        effectTimers.forEach(t => clearTimeout(t));
        effectTimers = [];
    }

    // ③ 5초 재생 + 지직 2회 + 마지막 페이드아웃
    function startPlayback() {
        clearEffectTimers();
        videoEl.currentTime = 0;

        const playPromise = videoEl.play();
        if (playPromise) playPromise.catch(() => {});

        // 지직 1회: 0.7초
        effectTimers.push(setTimeout(() => triggerGlitch(glitchEl, 220), 700));
        // 지직 2회: 3.0초
        effectTimers.push(setTimeout(() => triggerGlitch(glitchEl, 200), 3000));

        // 4.4초 후 검정 페이드인 (0.6초) → 총 5초
        effectTimers.push(setTimeout(() => {
            fadeEl.style.transition = 'opacity 0.6s ease';
            fadeEl.style.opacity    = '1';
            effectTimers.push(setTimeout(() => {
                videoEl.pause();
                videoEl.src = '';
                overlay.classList.add('hidden');
                fadeEl.style.opacity   = '0';
                fadeEl.style.transition = 'none';
                glitchEl.classList.remove('vg-active');
                callback();
            }, 600));
        }, 4400));
    }

    // ④ 로딩 상태 감지 - readyState 3(HAVE_FUTURE_DATA) 이상이면 즉시 재생
    //    모바일 faststart mp4 기준 보통 0.3~0.8초 내 도달
    function tryStart() {
        if (videoEl.readyState >= 3) {
            startPlayback();
            return true;
        }
        return false;
    }

    // ⑤ canplaythrough 이벤트로 대기
    videoEl.oncanplaythrough = null;
    videoEl.oncanplay        = null;

    videoEl.addEventListener('canplay', function onReady() {
        videoEl.removeEventListener('canplay', onReady);
        startPlayback();
    }, { once: true });

    videoEl.load();

    // ⑥ load() 직후 이미 버퍼 충분하면 바로 시작 (캐시된 경우)
    if (tryStart()) {
        videoEl.removeEventListener('canplay', () => {});
    }
}

// 지직 한 번 번쩍이기
function triggerGlitch(el, durationMs) {
    el.classList.add('vg-active');
    setTimeout(() => el.classList.remove('vg-active'), durationMs);
}

/* ─────────────────────────────────────────
   🏆 미션 클리어 전환 효과
   흐름:
     0.15s : 황금 플래시 폭발
     0.4s  : 빛줄기 + 텍스트 팝 등장
     1.4s  : 오버레이 페이드아웃
     1.9s  : 오버레이 제거 → 클리어 영상 5초 재생
     6.9s  : 영상 페이드아웃 → 스토리박스 등장
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

    // ⑦ 1.4s: 오버레이 페이드아웃 시작
    setTimeout(() => overlay.classList.add('ci-fadeout'), 1400);

    // ⑧ 1.9s: 오버레이 제거 → 클리어 영상 재생
    setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('ci-fadeout');
        overlay.innerHTML = '';
        // ⑨ 클리어 영상 5초 재생 후 콜백
        playClearVideo(callback);
    }, 1900);
}

// 클리어 영상 재생 (지직 없이, 5초 풀재생 후 페이드아웃)
function playClearVideo(callback) {
    const overlay = document.getElementById('stage-video-overlay');
    const videoEl = document.getElementById('stage-intro-video');
    const fadeEl  = document.getElementById('stage-video-fade');

    fadeEl.style.opacity   = '0';
    fadeEl.style.transition = 'none';
    overlay.classList.remove('hidden');

    videoEl.muted    = true;
    videoEl.autoplay = false;
    videoEl.loop     = false;
    videoEl.src      = 'clear_intro.mp4';

    let timers = [];

    function startClearPlay() {
        videoEl.currentTime = 0;
        const p = videoEl.play();
        if (p) p.catch(() => {});

        // 4.4s 후 검정 페이드인 (0.6s) → 총 5초
        timers.push(setTimeout(() => {
            fadeEl.style.transition = 'opacity 0.6s ease';
            fadeEl.style.opacity    = '1';
            timers.push(setTimeout(() => {
                videoEl.pause();
                videoEl.src = '';
                overlay.classList.add('hidden');
                fadeEl.style.opacity   = '0';
                fadeEl.style.transition = 'none';
                callback();
            }, 600));
        }, 4400));
    }

    videoEl.addEventListener('canplay', function onReady() {
        videoEl.removeEventListener('canplay', onReady);
        startClearPlay();
    }, { once: true });

    videoEl.load();
    // 캐시된 경우 즉시 시작
    if (videoEl.readyState >= 3) startClearPlay();
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

        // ⑦ 다음 스테이지 배경·영상 미리 캐싱 (백그라운드)
        preloadNextBackground(currentStageIndex);
        preloadNextVideo(currentStageIndex);
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
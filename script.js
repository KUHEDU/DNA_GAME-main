const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSis_C0X3WkqRuCSpnxDPx0nkZBYnD2EUgyTpPQvAbSG_fTw3yVLjv4eCxyPjHW4xk_4RAWT7Hi_uIu/pub?output=tsv';

/* ─── DOM 참조 ─────────────────────────────── */
const introScreen       = document.getElementById('intro-screen');
const worldviewScreen   = document.getElementById('worldview-screen');
const gameScreen        = document.getElementById('game-screen');
const titleEl           = document.getElementById('stage-title');
const descEl            = document.getElementById('stage-desc');
const inputEl           = document.getElementById('answer-input');
const messageEl         = document.getElementById('message-text');
const successPopup      = document.getElementById('success-popup');
const hintPopup         = document.getElementById('hint-popup');
const hintTextEl        = document.getElementById('hint-text');
const popupKeyword      = document.getElementById('popup-keyword');
const popupText         = document.getElementById('popup-text');
const celebrationOverlay= document.getElementById('celebration-overlay');
const prevBtn           = document.getElementById('prev-btn');
const mainContainer     = document.getElementById('main-ui');

/* ─── 상태 ──────────────────────────────────── */
let gameData         = [];
let currentStageIndex= 0;
let celebrationTimer = null;

/* ═══════════════════════════════════════════
   영상 목록
   ═══════════════════════════════════════════ */
const VIDEOS = {
    intro:        'intro_scene.mp4',    // 인트로 화면 → 시스템 접속 후
    missionEntry: 'mission_entry.mp4',  // intro_scene 종료 후 연속 재생
    stages:       [
        'stage1_intro.mp4',
        'stage2_intro.mp4',
        'stage3_intro.mp4',
        'stage4_intro.mp4',
        'stage5_intro.mp4',
    ],
    clear:        'clear_intro.mp4',
};

/* ═══════════════════════════════════════════
   영상 오버레이 컨트롤러
   ─────────────────────────────────────────
   핵심 원칙:
   · 오버레이는 절대 display:none(hidden)으로 없애지 않는다.
     visibility + opacity로만 제어 → 배경 노출 플래시 원천 차단.
   · 연속 재생(chainPlay)은 오버레이를 유지한 채 src만 교체.
   · playVideo() 호출 즉시 오버레이가 검정으로 화면 덮음.
   ═══════════════════════════════════════════ */
const VideoCtrl = (() => {
    /* 내부 상태 */
    let _timers    = [];
    let _isActive  = false;
    let _forceTimer = null;

    const _ov       = () => document.getElementById('stage-video-overlay');
    const _vid      = () => document.getElementById('stage-intro-video');
    const _fade     = () => document.getElementById('stage-video-fade');
    const _glitch   = () => document.getElementById('video-glitch-layer');

    function _clearTimers() {
        _timers.forEach(t => clearTimeout(t));
        _timers = [];
        if (_forceTimer) { clearTimeout(_forceTimer); _forceTimer = null; }
    }

    /* 오버레이 즉시 표시 (검정) — 배경 완전히 덮음 */
    function _showOverlay() {
        const ov = _ov();
        ov.style.transition  = 'none';
        ov.style.opacity     = '1';
        ov.style.visibility  = 'visible';
        ov.style.display     = 'flex';
    }

    /* 오버레이 페이드아웃 후 숨김 */
    function _hideOverlay(cb) {
        const ov   = _ov();
        const fade = _fade();

        // fade 레이어도 완전 검정으로 유지
        fade.style.transition = 'none';
        fade.style.opacity    = '1';

        // 오버레이 자체 페이드아웃
        ov.style.transition = 'opacity 0.35s ease';
        ov.style.opacity    = '0';

        _timers.push(setTimeout(() => {
            ov.style.visibility = 'hidden';
            ov.style.display    = 'none';
            fade.style.opacity  = '0';
            _isActive = false;
            if (cb) cb();
        }, 360));
    }

    /* 단일 영상 재생 내부 로직 */
    function _play(src, { glitch = false, fadeDuration = 4400, onEnd, _keepOverlay = false } = {}) {
        const vid      = _vid();
        const fade     = _fade();
        const glitchEl = _glitch();

        _clearTimers();

        // ① 오버레이 검정으로 즉시 덮기 (배경 노출 방지)
        _showOverlay();
        fade.style.transition = 'none';
        fade.style.opacity    = '1';   // 검정으로 덮어 영상 준비 전 노출 차단
        if (glitchEl) glitchEl.classList.remove('vg-active');

        // ② 영상 완전 초기화 — src 비우고 flush
        vid.pause();
        vid.removeAttribute('src');
        vid.load();

        let started = false;

        function startPlayback() {
            if (started) return;
            started = true;
            if (_forceTimer) { clearTimeout(_forceTimer); _forceTimer = null; }

            // fade 레이어 걷어내서 영상 보이게
            fade.style.transition = 'opacity 0.2s ease';
            fade.style.opacity    = '0';

            vid.currentTime = 0;
            vid.play().catch(e => console.warn('[VideoCtrl] play failed:', e));

            // 지직 효과 (스테이지 인트로 전용)
            if (glitch && glitchEl) {
                _timers.push(setTimeout(() => _triggerGlitch(glitchEl, 220), 700));
                _timers.push(setTimeout(() => _triggerGlitch(glitchEl, 200), 3000));
            }

            // 페이드아웃 → 종료
            _timers.push(setTimeout(() => {
                fade.style.transition = 'opacity 0.5s ease';
                fade.style.opacity    = '1';

                _timers.push(setTimeout(() => {
                    vid.pause();
                    vid.removeAttribute('src');
                    vid.load();
                    if (glitchEl) glitchEl.classList.remove('vg-active');

                    if (_keepOverlay) {
                        fade.style.transition = 'none';
                        fade.style.opacity    = '1';
                        if (onEnd) onEnd();
                    } else {
                        _hideOverlay(onEnd);
                    }
                }, 500));
            }, fadeDuration));
        }

        // ③ canplay 먼저 등록 → src 설정 → load()
        //    (일부 브라우저에서 src 할당 직후 canplay가 동기 발화할 수 있어
        //     반드시 리스너를 먼저 달아야 함)
        vid.muted       = true;
        vid.autoplay    = false;
        vid.loop        = false;
        vid.playsInline = true;

        vid.addEventListener('canplay', function onReady() {
            vid.removeEventListener('canplay', onReady);
            startPlayback();
        }, { once: true });

        vid.src = src;
        vid.load();

        // ④ 이미 충분히 버퍼된 경우(캐시) 즉시 시작
        if (vid.readyState >= 3) {
            startPlayback();
            return;
        }

        // ⑤ 안전망: 3초 안에 canplay 안 오면 강제 재생
        _forceTimer = setTimeout(() => {
            console.warn('[VideoCtrl] canplay timeout — forcing playback:', src);
            startPlayback();
        }, 3000);
    }

    function _triggerGlitch(el, ms) {
        el.classList.add('vg-active');
        setTimeout(() => el.classList.remove('vg-active'), ms);
    }

    /* ── 공개 API ── */
    return {
        /**
         * 단일 영상 재생
         * @param {string} src
         * @param {object} opts  { glitch, fadeDuration, onEnd }
         */
        play(src, opts = {}) {
            _isActive = true;
            _play(src, { ...opts, _keepOverlay: false });
        },

        /**
         * 연속 영상 재생 (오버레이 유지한 채 src만 교체)
         * @param {Array<{src, glitch, fadeDuration}>} playlist
         * @param {function} onAllEnd  전체 종료 후 콜백
         */
        chain(playlist, onAllEnd) {
            _isActive = true;
            let idx = 0;

            function playNext() {
                if (idx >= playlist.length) {
                    // 모두 재생 완료 → 오버레이 숨기고 콜백
                    _hideOverlay(onAllEnd);
                    return;
                }
                const item = playlist[idx++];
                const isLast = (idx >= playlist.length);
                _play(item.src, {
                    glitch:       item.glitch       || false,
                    fadeDuration: item.fadeDuration  || 4400,
                    onEnd:        playNext,
                    _keepOverlay: true,  // 항상 오버레이 유지 (마지막도 chain이 처리)
                });
            }
            playNext();
        },

        get isActive() { return _isActive; }
    };
})();

/* ─── 지직 (외부 노출용) ─── */
function triggerGlitch(el, ms) {
    el.classList.add('vg-active');
    setTimeout(() => el.classList.remove('vg-active'), ms);
}

/* ═══════════════════════════════════════════
   prefetch 유틸 — 배경 이미지 / 다음 영상
   ═══════════════════════════════════════════ */
function preloadImage(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = img.onerror = () => resolve(url);
        img.src = url;
    });
}

function prefetchVideo(src) {
    if (!src) return;
    if (document.querySelector(`link[href="${src}"]`)) return;
    const link = document.createElement('link');
    link.rel  = 'prefetch';
    link.as   = 'video';
    link.href = src;
    document.head.appendChild(link);
}

function preloadNextAssets(currentIndex) {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= gameData.length) return;
    const isClear = nextIndex === gameData.length - 1;
    preloadImage(isClear ? 'bg_clear.webp' : `bg_stage${nextIndex + 1}.webp`);
    if (!isClear) prefetchVideo(VIDEOS.stages[nextIndex]);
    else          prefetchVideo(VIDEOS.clear);
}

/* ═══════════════════════════════════════════
   초기화
   ═══════════════════════════════════════════ */
async function fetchGameData() {
    try {
        const res  = await fetch(SHEET_URL + `&t=${Date.now()}`);
        const text = await res.text();
        const rows = text.split('\n');
        const headers = rows[0].split('\t').map(h => h.trim());
        gameData = [];
        for (let i = 1; i < rows.length; i++) {
            if (!rows[i].trim()) continue;
            const vals = rows[i].split('\t');
            const obj  = {};
            headers.forEach((h, j) => { obj[h] = vals[j] ? vals[j].trim() : ''; });
            gameData.push(obj);
        }
    } catch (e) { console.error('데이터 연동 실패:', e); }
}

window.onload = function () {
    document.body.style.backgroundImage = "url('bg_intro.webp')";
    fetchGameData();
    successPopup.classList.add('hidden');
    hintPopup.classList.add('hidden');

    // 오버레이 초기 상태: 숨김 (투명 + display none)
    const ov = document.getElementById('stage-video-overlay');
    ov.style.opacity    = '0';
    ov.style.visibility = 'hidden';
    ov.style.display    = 'none';

    // 인트로·미션엔트리 영상 미리 prefetch
    prefetchVideo(VIDEOS.intro);
    prefetchVideo(VIDEOS.missionEntry);
};

/* ═══════════════════════════════════════════
   ① 인트로 화면 → "시스템 접속" 클릭
      intro_scene.mp4 (5s) → mission_entry.mp4 (5s) 연속 재생
      → 월드뷰 화면 표시
   ═══════════════════════════════════════════ */
function showWorldview() {
    // UI 즉시 숨기기 (opacity 0, 오버레이가 덮기 전 노출 방지)
    mainContainer.style.transition = 'none';
    mainContainer.style.opacity    = '0';
    introScreen.classList.add('hidden');

    // 두 영상 연속 재생 (오버레이 유지)
    VideoCtrl.chain(
        [
            { src: VIDEOS.intro,        glitch: false, fadeDuration: 4400 },
            { src: VIDEOS.missionEntry, glitch: false, fadeDuration: 4400 },
        ],
        () => {
            // 두 영상 모두 종료 → 월드뷰 화면 전환
            document.body.style.backgroundImage = "url('bg_default.webp')";
            worldviewScreen.classList.remove('hidden');
            mainContainer.style.transition = 'opacity 0.5s ease';
            mainContainer.style.opacity    = '1';
            const video = document.getElementById('prologue-video');
            video.play().catch(() => { video.muted = true; video.play(); });
            window.scrollTo(0, 0);
        }
    );
}

/* ═══════════════════════════════════════════
   ② 미션 코드 입력 → 확인 → 스테이지1 진입
   ═══════════════════════════════════════════ */
function checkMissionCode() {
    const inputCode   = document.getElementById('mission-code-input').value.trim();
    const requiredCode= gameData[0]?.missionCode?.toString().trim() || '0303';

    if (inputCode !== requiredCode) {
        const err = document.getElementById('mission-error-text');
        err.innerText = '❌ 접근 거부: 코드 오류';
        err.style.animation = 'none';
        requestAnimationFrame(() => { err.style.animation = 'shake 0.3s'; });
        setTimeout(() => { err.style.animation = ''; }, 300);
        return;
    }

    // 프롤로그 영상 정지, 화면 숨기기
    document.getElementById('prologue-video').pause();
    mainContainer.style.transition = 'none';
    mainContainer.style.opacity    = '0';
    worldviewScreen.classList.add('hidden');

    startGame();
}

function startGame() {
    worldviewScreen.classList.add('hidden');
    loadStage();
}

/* ═══════════════════════════════════════════
   ③ 스테이지 인트로 — stageN_intro.mp4 (5s, 지직 2회)
   ═══════════════════════════════════════════ */
function showStageIntro(stageIndex, callback) {
    VideoCtrl.play(VIDEOS.stages[stageIndex] || VIDEOS.stages[0], {
        glitch: true,
        fadeDuration: 4400,
        onEnd: callback
    });
}

/* ═══════════════════════════════════════════
   ④ 미션 클리어 전환 효과
      황금빛 플래시(1.9s) → clear_intro.mp4 (5s) → 콜백
   ═══════════════════════════════════════════ */
function showClearIntro(stageIndex, callback) {
    const overlay = document.getElementById('clear-intro-overlay');
    overlay.innerHTML = '';
    overlay.classList.remove('hidden', 'ci-fadeout');
    overlay.style.opacity = '';

    const flash = document.createElement('div'); flash.className = 'ci-flash';
    const rays  = document.createElement('div'); rays.className  = 'ci-rays';
    const label = document.createElement('div'); label.className = 'ci-label';
    label.innerHTML = '🏆<br>MISSION<br>CLEAR';
    const ring  = document.createElement('div'); ring.className  = 'ci-ring';
    overlay.append(flash, rays, label, ring);

    setTimeout(() => flash.classList.add('ci-flash-burst'), 150);
    setTimeout(() => {
        rays.classList.add('ci-rays-show');
        label.classList.add('ci-label-show');
        ring.classList.add('ci-ring-show');
    }, 400);
    setTimeout(() => overlay.classList.add('ci-fadeout'), 1400);
    setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('ci-fadeout');
        overlay.innerHTML = '';
        // 클리어 영상 재생 (지직 없음)
        VideoCtrl.play(VIDEOS.clear, {
            glitch: false,
            fadeDuration: 4400,
            onEnd: callback
        });
    }, 1900);
}

/* ═══════════════════════════════════════════
   loadStage — 스테이지 로딩 공통 로직
   ═══════════════════════════════════════════ */
function loadStage() {
    window.scrollTo(0, 0);

    const stage        = gameData[currentStageIndex];
    const nextBtn      = document.getElementById('next-mission-btn');
    const inputSection = document.getElementById('mission-input-section');
    const storyBox     = document.querySelector('.story-box');

    // 공통 초기화
    nextBtn.classList.remove('hidden');
    inputSection.classList.add('hidden');
    messageEl.innerText = '';
    inputEl.value = '';
    if (celebrationTimer) { clearInterval(celebrationTimer); celebrationTimer = null; }
    celebrationOverlay.classList.add('hidden');
    celebrationOverlay.innerHTML = '';
    successPopup.classList.add('hidden');
    hintPopup.classList.add('hidden');
    mainContainer.classList.remove('corona-effect');
    storyBox.classList.remove('clear-mode');

    // 배경 URL 결정
    const isClear = currentStageIndex === gameData.length - 1;
    const bgUrl   = isClear ? 'bg_clear.webp' : `bg_stage${currentStageIndex + 1}.webp`;

    // 컨테이너 투명 (인트로 영상 뒤 페이드인 준비)
    mainContainer.style.opacity    = '0';
    mainContainer.style.transition = 'none';

    // 배경 preload 완료 후 인트로 시작
    preloadImage(bgUrl).then(() => {
        document.body.style.backgroundImage = `url('${bgUrl}')`;

        const introFn = isClear ? showClearIntro : showStageIntro;
        introFn(currentStageIndex, () => {

            // 스테이지 내용 세팅
            if (isClear) {
                titleEl.innerHTML = `<span class="golden-glow-animated">🧬 우리라는 이름의 기적 🧬</span><span class="mission-clear-badge">🏆 MISSION CLEAR 🏆</span>`;
                descEl.innerHTML  = stage.desc;
                nextBtn.classList.add('hidden');
                inputSection.classList.add('hidden');
                if (prevBtn) prevBtn.classList.add('hidden');
                mainContainer.classList.add('corona-effect');
                storyBox.classList.add('clear-mode');
                document.getElementById('audio-clear-bgm').play().catch(() => {});
                showCelebrationEffect();
            } else {
                const parts = stage.title.split(':');
                titleEl.innerHTML = parts.length > 1
                    ? `${parts[0]}<br><span class="stage-subtitle">"${parts[1].trim()}"</span>`
                    : stage.title;
                descEl.innerHTML = stage.desc;
                if (prevBtn) prevBtn.classList.toggle('hidden', currentStageIndex === 0);
            }

            // 컨테이너 페이드인
            gameScreen.classList.remove('hidden');
            window.scrollTo(0, 0);
            requestAnimationFrame(() => {
                mainContainer.style.transition = 'opacity 0.7s ease';
                mainContainer.style.opacity    = '1';
            });

            // 다음 스테이지 에셋 미리 캐싱
            preloadNextAssets(currentStageIndex);
        });
    });
}

/* ═══════════════════════════════════════════
   게임 플레이 함수들
   ═══════════════════════════════════════════ */
function showMission() {
    window.scrollTo(0, 0);
    const stage        = gameData[currentStageIndex];
    const nextBtn      = document.getElementById('next-mission-btn');
    const inputSection = document.getElementById('mission-input-section');
    descEl.innerHTML = `
        <div class="mission-title-box">${stage.missionTitle || '미션 설명'}</div>
        <div class="mission-part">
            <div class="mission-label">🎯 미션 상세</div>
            <div class="mission-text">${stage.missionDesc}</div>
        </div>
        <div class="mission-part">
            <div class="mission-label condition">✅ 완료 조건</div>
            <div class="mission-text">${stage.missionCondition}</div>
        </div>
    `;
    nextBtn.classList.add('hidden');
    inputSection.classList.remove('hidden');
    if (prevBtn) prevBtn.classList.remove('hidden');
}

function goBack() {
    const inputSection = document.getElementById('mission-input-section');
    if (!inputSection.classList.contains('hidden')) loadStage();
    else if (currentStageIndex > 0) { currentStageIndex--; loadStage(); }
}

function checkAnswer() {
    const stage   = gameData[currentStageIndex];
    const userAns = inputEl.value.trim();
    if (!userAns) return;
    if (userAns === stage.answer) {
        popupKeyword.innerHTML = `🃏 <span class="highlight-item">핵심가치: ${stage.keyword}</span> 카드 획득!`;
        popupText.innerHTML    = stage.clearText;
        successPopup.classList.remove('hidden');
    } else {
        messageEl.innerText   = '❌ 코드 불일치';
        messageEl.className   = 'error';
    }
}

function closePopupAndNext() {
    successPopup.classList.add('hidden');
    currentStageIndex++;
    loadStage();
}
function showHint()  { hintTextEl.innerText = gameData[currentStageIndex].hint; hintPopup.classList.remove('hidden'); }
function closeHint() { hintPopup.classList.add('hidden'); }

/* ═══════════════════════════════════════════
   파티클 (클리어 화면)
   ═══════════════════════════════════════════ */
function showCelebrationEffect() {
    celebrationOverlay.classList.remove('hidden');
    for (let i = 0; i < 20; i++) {
        setTimeout(() => createParticle(), Math.random() * 3000);
    }
    celebrationTimer = setInterval(() => {
        if (currentStageIndex === gameData.length - 1) {
            const n = Math.floor(Math.random() * 2) + 3;
            for (let i = 0; i < n; i++) setTimeout(() => createParticle(), Math.random() * 800);
        } else {
            clearInterval(celebrationTimer);
        }
    }, 1000);
}

function createParticle() {
    const p = document.createElement('div');
    p.className = 'particle';
    p.innerHTML = Math.random() > 0.5 ? '🧬' : '⭐';
    p.style.left              = `${Math.random() * 100}vw`;
    const dur = Math.random() * 3 + 4;
    p.style.animationDuration = `${dur}s`;
    p.style.fontSize          = `${Math.random() * 1.5 + 1}rem`;
    celebrationOverlay.appendChild(p);
    setTimeout(() => p.remove(), dur * 1000 + 200);
}

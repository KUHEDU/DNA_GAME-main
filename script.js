const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSis_C0X3WkqRuCSpnxDPx0nkZBYnD2EUgyTpPQvAbSG_fTw3yVLjv4eCxyPjHW4xk_4RAWT7Hi_uIu/pub?output=tsv';

/* ─── DOM 참조 ─────────────────────────────── */
const introScreen        = document.getElementById('intro-screen');
const worldviewScreen    = document.getElementById('worldview-screen');
const gameScreen         = document.getElementById('game-screen');
const titleEl            = document.getElementById('stage-title');
const descEl             = document.getElementById('stage-desc');
const inputEl            = document.getElementById('answer-input');
const messageEl          = document.getElementById('message-text');
const successPopup       = document.getElementById('success-popup');
const hintPopup          = document.getElementById('hint-popup');
const hintTextEl         = document.getElementById('hint-text');
const popupKeyword       = document.getElementById('popup-keyword');
const popupText          = document.getElementById('popup-text');
const celebrationOverlay = document.getElementById('celebration-overlay');
const prevBtn            = document.getElementById('prev-btn');
const mainContainer      = document.getElementById('main-ui');

/* ─── 상태 ──────────────────────────────────── */
let gameData          = [];
let currentStageIndex = 0;
let celebrationTimer  = null;

/* ═══════════════════════════════════════════
   영상 목록
   ═══════════════════════════════════════════ */
const VIDEOS = {
    intro:        'intro_scene.mp4',
    missionEntry: 'mission_entry.mp4',
    stages: [
        'stage1_intro.mp4',
        'stage2_intro.mp4',
        'stage3_intro.mp4',
        'stage4_intro.mp4',
        'stage5_intro.mp4',
    ],
    clear: 'clear_intro.mp4',
};

/* ═══════════════════════════════════════════
   VideoPlayer — 단순하고 확실한 영상 재생기
   ─────────────────────────────────────────
   설계 원칙:
   1. 오버레이는 opacity로만 숨김/표시 (display:none 사용 안 함)
   2. 영상 교체 시 src만 바꾸고 load() 1회만 호출
   3. canplay 이벤트 + 2.5초 강제시작 이중 안전망
   4. 연속재생(chain)은 오버레이 유지한 채 src만 교체
   ═══════════════════════════════════════════ */
const VideoPlayer = (() => {
    let timers     = [];
    let forceTimer = null;
    let started    = false;

    function getEls() {
        return {
            overlay:  document.getElementById('stage-video-overlay'),
            vid:      document.getElementById('stage-intro-video'),
            fade:     document.getElementById('stage-video-fade'),
            glitch:   document.getElementById('video-glitch-layer'),
        };
    }

    function clearAll() {
        timers.forEach(clearTimeout);
        timers = [];
        if (forceTimer) { clearTimeout(forceTimer); forceTimer = null; }
    }

    /* 오버레이 보이기 (즉시, 검정) */
    function showOverlay() {
        const { overlay, fade } = getEls();
        overlay.classList.remove('hidden');   // .hidden { display:none !important } 방어
        overlay.style.transition = 'none';
        overlay.style.opacity    = '1';
        overlay.style.visibility = 'visible';
        overlay.style.display    = 'block';
        /* 모바일 Safari 대비: overlay 크기 명시 강제 */
        overlay.style.position = 'fixed';
        overlay.style.top      = '0';
        overlay.style.left     = '0';
        overlay.style.width    = '100vw';
        overlay.style.height   = '100vh';
        fade.style.transition    = 'none';
        fade.style.opacity       = '1';  // 영상 준비 전 검정으로 가림
    }

    /* 오버레이 숨기기 — fade는 검정(opacity:1) 유지한 채 오버레이 전체를 페이드아웃
       ※ fade를 0으로 만들면 video가 멈춘 순간 body 배경이 비쳐 깜빡이므로 절대 0으로 바꾸지 않음 */
    function hideOverlay(cb) {
        const { overlay, fade } = getEls();
        /* fade는 그대로 opacity:1(검정) 유지 — 건드리지 않음 */
        fade.style.transition    = 'none';
        fade.style.opacity       = '1';
        /* 오버레이 전체를 검정인 채로 서서히 페이드아웃 */
        overlay.style.transition = 'opacity 0.35s ease';
        overlay.style.opacity    = '0';
        setTimeout(() => {
            overlay.style.visibility = 'hidden';
            overlay.style.display    = 'none';
            overlay.style.opacity    = '1';  // 다음 showOverlay()를 위해 복원
            overlay.classList.remove('hidden');
            if (cb) cb();
        }, 370);
    }

    /* 지직 효과 한 번 */
    function glitchOnce(el, ms) {
        if (!el) return;
        el.classList.add('vg-active');
        setTimeout(() => el.classList.remove('vg-active'), ms);
    }

    /* ─── 핵심: 단일 영상 재생 ─── */
    function playOne(src, opts, onDone) {
        const { vid, fade, glitch: glitchEl } = getEls();
        const glitch      = opts.glitch      || false;
        const fadeDuration = opts.fadeDuration != null ? opts.fadeDuration : 4400;

        clearAll();
        started = false;

        /* fade를 검정으로 유지한 채 영상만 교체 */
        fade.style.transition = 'none';
        fade.style.opacity    = '1';
        if (glitchEl) glitchEl.classList.remove('vg-active');

        /* 이전 영상 완전 정지 (src는 아직 건드리지 않음) */
        vid.pause();

        function beginPlay() {
            if (started) return;
            started = true;
            clearAll();

            vid.currentTime = 0;
            /* fade를 걷어내서 영상 표시 */
            fade.style.transition = 'opacity 0.2s ease';
            fade.style.opacity    = '0';

            vid.play().catch(err => console.warn('[VP] play():', err));

            /* 지직 효과 */
            if (glitch && glitchEl) {
                timers.push(setTimeout(() => glitchOnce(glitchEl, 220),  700));
                timers.push(setTimeout(() => glitchOnce(glitchEl, 200), 3000));
            }

            /* fadeDuration 후 검정으로 페이드아웃 → 완료 콜백 */
            timers.push(setTimeout(() => {
                fade.style.transition = 'opacity 0.5s ease';
                fade.style.opacity    = '1';
                timers.push(setTimeout(() => {
                    vid.pause();
                    if (glitchEl) glitchEl.classList.remove('vg-active');
                    if (onDone) onDone();
                }, 520));
            }, fadeDuration));
        }

        /* src 설정 → canplay 대기 → 재생 */
        vid.muted       = true;
        vid.autoplay    = false;
        vid.loop        = false;
        vid.playsInline = true;
        /* 모바일 Safari 등에서 position:fixed 내 absolute 오작동 방어 — 인라인 강제 지정 */
        vid.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center center;display:block;background:#000;z-index:1;';
        vid.src         = src;

        /* canplay 이벤트 */
        vid.oncanplay = function () {
            vid.oncanplay = null;
            beginPlay();
        };

        vid.load();

        /* 이미 버퍼된 경우 즉시 시작 */
        if (vid.readyState >= 3) {
            vid.oncanplay = null;
            beginPlay();
            return;
        }

        /* 안전망: 2.5초 후 강제 시작 */
        forceTimer = setTimeout(() => {
            console.warn('[VP] canplay timeout, forcing:', src);
            vid.oncanplay = null;
            beginPlay();
        }, 2500);
    }

    /* ─── 공개 API ─── */
    return {
        /** 단일 영상 재생 후 콜백 */
        play(src, opts = {}, onEnd) {
            showOverlay();
            playOne(src, opts, () => hideOverlay(onEnd));
        },

        /** 여러 영상 연속 재생 — 오버레이 유지한 채 src만 교체 */
        chain(list, onAllEnd) {
            showOverlay();
            let i = 0;
            function next() {
                if (i >= list.length) { hideOverlay(onAllEnd); return; }
                const item = list[i++];
                playOne(item.src, item, next);
            }
            next();
        },
    };
})();

/* ═══════════════════════════════════════════
   프리로드 유틸
   ─────────────────────────────────────────
   prefetch(hint) 대신 fetch()로 직접 브라우저 캐시에 강제 저장.
   모바일에서도 확실하게 동작하며, 재생 시 즉시 로드됨.
   ═══════════════════════════════════════════ */
function preloadImage(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = img.onerror = () => resolve(url);
        img.src = url;
    });
}

/* 이미 요청 중인 영상 추적 (중복 fetch 방지) */
const _preloadedVideos = new Set();

function preloadVideo(src) {
    if (!src || _preloadedVideos.has(src)) return;
    _preloadedVideos.add(src);
    fetch(src, { priority: 'low' })
        .then(res => {
            if (!res.ok) console.warn('[Preload] 실패:', src, res.status);
            else res.blob().then(() => console.log('[Preload] 완료:', src));
        })
        .catch(err => console.warn('[Preload] 오류:', src, err));
}

/* 현재 스테이지 기준으로 다음 영상+이미지 프리로드 */
function preloadNextAssets(idx) {
    const next = idx + 1;
    if (next >= gameData.length) return;
    const isClear = next === gameData.length - 1;
    preloadImage(isClear ? 'bg_clear.webp' : `bg_stage${next + 1}.webp`);
    preloadVideo(isClear ? VIDEOS.clear : VIDEOS.stages[next]);
}

/* ═══════════════════════════════════════════
   초기화
   ═══════════════════════════════════════════ */
async function fetchGameData() {
    try {
        const res     = await fetch(SHEET_URL + `&t=${Date.now()}`);
        const text    = await res.text();
        const rows    = text.split('\n');
        const headers = rows[0].split('\t').map(h => h.trim());
        gameData = [];
        for (let i = 1; i < rows.length; i++) {
            if (!rows[i].trim()) continue;
            const vals = rows[i].split('\t');
            const obj  = {};
            headers.forEach((h, j) => { obj[h] = (vals[j] || '').trim(); });
            gameData.push(obj);
        }
    } catch (e) { console.error('데이터 연동 실패:', e); }
}

window.onload = function () {
    document.body.style.backgroundImage = "url('bg_intro.webp')";
    fetchGameData();
    successPopup.classList.add('hidden');
    hintPopup.classList.add('hidden');

    /* 오버레이 초기 숨김 — display:none + opacity:0 (hidden 클래스 사용 안 함) */
    const ov = document.getElementById('stage-video-overlay');
    ov.classList.remove('hidden');
    ov.style.opacity    = '0';
    ov.style.visibility = 'hidden';
    ov.style.display    = 'none';

    /* 첫 화면에서 다음에 나올 영상들 즉시 프리로드 */
    preloadVideo(VIDEOS.intro);          // 시스템접속 클릭 시 바로 재생
    preloadVideo(VIDEOS.missionEntry);   // intro 다음 재생 (미션코드 입력 후)
};

/* ═══════════════════════════════════════════
   ① 시스템 접속 → intro_scene → mission_entry → 월드뷰
   ═══════════════════════════════════════════ */
function showWorldview() {
    mainContainer.style.transition = 'none';
    mainContainer.style.opacity    = '0';
    introScreen.classList.add('hidden');

    /* intro_scene 재생 — 시작과 동시에 다음 영상(mission_entry) 프리로드 */
    preloadVideo(VIDEOS.missionEntry);   // intro 재생 중 미리 캐시
    VideoPlayer.play(
        VIDEOS.intro,
        { glitch: false, fadeDuration: 4400 },
        () => {
            document.body.style.backgroundImage = "url('bg_intro.webp')";
            worldviewScreen.classList.remove('hidden');
            mainContainer.style.transition = 'opacity 0.5s ease';
            mainContainer.style.opacity    = '1';
            const pv = document.getElementById('prologue-video');
            pv.muted = true;
            pv.play().catch(() => {});
            window.scrollTo(0, 0);
            /* 월드뷰 표시 후 stage1 + mission_entry 확실히 캐시 (중복 방지됨) */
            preloadVideo(VIDEOS.missionEntry);
            preloadVideo(VIDEOS.stages[0]);
            preloadImage('bg_stage1.webp');
        }
    );
}

/* ═══════════════════════════════════════════
   ② 미션 코드 입력 → 스테이지 1 진입
   ═══════════════════════════════════════════ */
function checkMissionCode() {
    const inputCode    = document.getElementById('mission-code-input').value.trim();
    const requiredCode = (gameData[0]?.missionCode || '0303').toString().trim();

    if (inputCode !== requiredCode) {
        const err = document.getElementById('mission-error-text');
        err.innerText        = '❌ 접근 거부: 코드 오류';
        err.style.animation  = 'none';
        requestAnimationFrame(() => { err.style.animation = 'shake 0.3s'; });
        setTimeout(() => { err.style.animation = ''; }, 300);
        return;
    }

    /* 코드 정상 — 프롤로그 중지, mission_entry 영상 재생 후 스테이지 진입 */
    document.getElementById('prologue-video').pause();
    mainContainer.style.transition = 'none';
    mainContainer.style.opacity    = '0';
    worldviewScreen.classList.add('hidden');

    /* mission_entry 재생 중 stage1 영상+배경 프리로드 */
    preloadVideo(VIDEOS.stages[0]);
    preloadImage('bg_stage1.webp');
    VideoPlayer.play(
        VIDEOS.missionEntry,
        { glitch: false, fadeDuration: 4400 },
        () => { loadStage(); }
    );
}

/* ═══════════════════════════════════════════
   ③ 스테이지 인트로 (지직 2회)
   ═══════════════════════════════════════════ */
function showStageIntro(stageIndex, callback) {
    /* 이 스테이지 영상 재생 중에 다음 스테이지 영상 프리로드 */
    const nextIdx  = stageIndex + 1;
    const isClear  = nextIdx >= VIDEOS.stages.length;
    if (isClear) {
        preloadVideo(VIDEOS.clear);
        preloadImage('bg_clear.webp');
    } else if (nextIdx < VIDEOS.stages.length) {
        preloadVideo(VIDEOS.stages[nextIdx]);
        preloadImage(`bg_stage${nextIdx + 1}.webp`);
    }
    VideoPlayer.play(
        VIDEOS.stages[stageIndex] || VIDEOS.stages[0],
        { glitch: true, fadeDuration: 4400 },
        callback
    );
}

/* ═══════════════════════════════════════════
   ④ 미션 클리어: 황금 플래시 → clear_intro.mp4 → 콜백
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
        VideoPlayer.play(VIDEOS.clear, { glitch: false, fadeDuration: 4400 }, callback);
    }, 1900);
}

/* ═══════════════════════════════════════════
   loadStage
   ═══════════════════════════════════════════ */
function loadStage() {
    window.scrollTo(0, 0);

    const stage        = gameData[currentStageIndex];
    const nextBtn      = document.getElementById('next-mission-btn');
    const inputSection = document.getElementById('mission-input-section');
    const storyBox     = document.querySelector('.story-box');

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
    const prevVid = document.getElementById('mission-guide-video');
    if (prevVid) prevVid.remove();
    const prevImg = document.getElementById('mission-guide-img');
    if (prevImg) prevImg.remove();

    const isClear = currentStageIndex === gameData.length - 1;
    const bgUrl   = isClear ? 'bg_clear.webp' : `bg_stage${currentStageIndex + 1}.webp`;

    mainContainer.style.opacity    = '0';
    mainContainer.style.transition = 'none';

    preloadImage(bgUrl).then(() => {
        document.body.style.backgroundImage = `url('${bgUrl}')`;

        const introFn = isClear ? showClearIntro : showStageIntro;
        introFn(currentStageIndex, () => {
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

            gameScreen.classList.remove('hidden');
            window.scrollTo(0, 0);
            requestAnimationFrame(() => {
                mainContainer.style.transition = 'opacity 0.7s ease';
                mainContainer.style.opacity    = '1';
            });

            preloadNextAssets(currentStageIndex);
        });
    });
}

/* ═══════════════════════════════════════════
   게임 플레이
   ═══════════════════════════════════════════ */
function showMission() {
    window.scrollTo(0, 0);
    const stage        = gameData[currentStageIndex];
    const nextBtn      = document.getElementById('next-mission-btn');
    const inputSection = document.getElementById('mission-input-section');

    /* 미션 설명 영상 맵 (0-based 인덱스: 스테이지3=2, 스테이지4=3) */
    const missionVideoMap = { 2: 'stage3_mission.mp4', 3: 'stage4_mission.mp4' };
    const missionVidSrc   = missionVideoMap[currentStageIndex] || null;

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

    /* 기존 미디어(영상/이미지) 제거 */
    const oldVid = document.getElementById('mission-guide-video');
    if (oldVid) oldVid.remove();
    const oldImg = document.getElementById('mission-guide-img');
    if (oldImg) oldImg.remove();

    /* 스테이지 1 — 미션 안내 이미지 삽입 */
    if (currentStageIndex === 0) {
        const img = document.createElement('img');
        img.id  = 'mission-guide-img';
        img.src = 'stage1_mission.jpg';
        img.alt = '미션 예시';
        img.style.cssText = [
            'display:block',
            'width:100%',
            'max-width:100%',
            'border-radius:8px',
            'margin-top:14px',
            'border:1px solid rgba(46,213,115,0.28)',
        ].join(';');
        descEl.parentNode.appendChild(img);
    }

    /* 스테이지 3·4 — 미션 안내 영상 삽입 */
    if (missionVidSrc) {
        const vid = document.createElement('video');
        vid.id          = 'mission-guide-video';
        vid.src         = missionVidSrc;
        vid.autoplay    = true;
        vid.loop        = true;
        vid.muted       = true;
        vid.playsInline = true;
        vid.style.cssText = [
            'display:block',
            'width:100%',
            'max-width:100%',
            'border-radius:8px',
            'margin-top:14px',
            'border:1px solid rgba(46,213,115,0.28)',
            'background:#000',
        ].join(';');
        descEl.parentNode.appendChild(vid);
        vid.load();
        vid.play().catch(() => {});
    }

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
        messageEl.innerText = '❌ 코드 불일치';
        messageEl.className = 'error';
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
   파티클 (클리어)
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

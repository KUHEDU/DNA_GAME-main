const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSis_C0X3WkqRuCSpnxDPx0nkZBYnD2EUgyTpPQvAbSG_fTw3yVLjv4eCxyPjHW4xk_4RAWT7Hi_uIu/pub?output=tsv';

const introScreen = document.getElementById('intro-screen');
const worldviewScreen = document.getElementById('worldview-screen');
const gameScreen = document.getElementById('game-screen');
const titleEl = document.getElementById('stage-title');
const descEl = document.getElementById('stage-desc');
const inputEl = document.getElementById('answer-input');
const messageEl = document.getElementById('message-text');
const hintBoxEl = document.getElementById('hint-box');
const successPopup = document.getElementById('success-popup');
const popupKeyword = document.getElementById('popup-keyword');
const popupText = document.getElementById('popup-text');
const effectOverlay = document.getElementById('effect-overlay');
const celebrationOverlay = document.getElementById('celebration-overlay');

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
    } catch (error) {
        console.error("데이터 연동 실패:", error);
    }
}

window.onload = function() {
    document.body.style.backgroundImage = "url('bg_intro.png')";
    fetchGameData(); 
};

function showWorldview() {
    introScreen.classList.add('hidden');
    worldviewScreen.classList.remove('hidden');
    document.body.style.backgroundImage = "url('bg_default.png')";
    const video = document.getElementById('prologue-video');
    video.play().catch(() => { video.muted = true; video.play(); });
}

function checkMissionCode() {
    const inputCode = document.getElementById('mission-code-input').value.trim();
    const requiredCode = gameData[0]?.missionCode?.toString().trim() || "0303";

    if (inputCode === requiredCode) {
        document.getElementById('prologue-video').pause();
        startGame(); 
    } else {
        const err = document.getElementById('mission-error-text');
        err.innerText = "❌ 접근 거부: 잘못된 미션 코드입니다.";
        err.style.animation = "shake 0.3s";
        setTimeout(() => err.style.animation = "", 300);
    }
}

function startGame() {
    worldviewScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    loadStage();
}

function loadStage() {
    const stage = gameData[currentStageIndex];
    const nextBtn = document.getElementById('next-mission-btn');
    const inputSection = document.getElementById('mission-input-section');
    const storyBox = document.querySelector('.story-box');

    // UI 기본 청소
    nextBtn.classList.remove('hidden');
    inputSection.classList.add('hidden');
    hintBoxEl.classList.add('hidden');
    messageEl.innerText = "";
    inputEl.value = "";
    effectOverlay.className = "";
    celebrationOverlay.classList.add('hidden');
    celebrationOverlay.innerHTML = '';

    // 💡 [핵심수정] 에필로그(마지막 행) 처리
    if (currentStageIndex === gameData.length - 1) {
        // 타이틀 설정
        titleEl.innerHTML = `<span class="golden-glow-animated ending-title">🧬 우리라는 이름의 기적 🧬</span><br><span class="golden-neon ending-subtitle">작전명 DNA — MISSION CLEAR</span>`;
        
        // 💡 중요: 이전 스테이지의 '미션 설명' 레이아웃을 싹 지우고 순수 스토리 텍스트만 주입!
        descEl.innerHTML = stage.desc; 
        
        // 버튼 및 입력창 완전 봉인
        nextBtn.classList.add('hidden');
        inputSection.classList.add('hidden');
        
        // 황금빛 엔딩 박스 스타일 적용
        storyBox.classList.add('clear-mode');
        document.body.style.backgroundImage = "url('bg_clear.png')";
        
        // 사운드 및 파티클 재생
        document.getElementById('audio-clear-bgm').play().catch(()=>{});
        document.getElementById('audio-clear-effect').play().catch(()=>{});
        showCelebrationEffect();
        return;
    }

    // 일반 스테이지 연출
    if (currentStageIndex === 0) effectOverlay.classList.add('effect-glitch-red');
    if (currentStageIndex === 4) effectOverlay.classList.add('effect-future-blue');

    const titleParts = stage.title.split(':');
    titleEl.innerHTML = titleParts.length > 1 ? `${titleParts[0]}<br><span class="stage-subtitle">${titleParts[1].trim()}</span>` : stage.title;
    
    // 일반 스테이지 진입 시 descEl 초기화 (이전 미션 박스 잔상 제거)
    descEl.innerHTML = stage.desc; 
    
    document.body.style.backgroundImage = `url('bg_stage${currentStageIndex + 1}.png')`;
}

function showMission() {
    const stage = gameData[currentStageIndex];
    const nextBtn = document.getElementById('next-mission-btn');
    const inputSection = document.getElementById('mission-input-section');

    const mTitle = stage.missionTitle || "미션 설명";
    const mDesc = stage.missionDesc || "데이터 없음";
    const mCond = stage.missionCondition || "데이터 없음";

    // 미션 버튼 클릭 시에만 특수 레이아웃 주입
    descEl.innerHTML = `
        <div class="mission-title-box">${mTitle}</div>
        <div class="mission-part">
            <div class="mission-label">🎯 미션 상세</div>
            <div class="mission-text">${mDesc}</div>
        </div>
        <div class="mission-part">
            <div class="mission-label condition">✅ 완료 조건</div>
            <div class="mission-text">${mCond}</div>
        </div>
    `;
    
    nextBtn.classList.add('hidden');
    inputSection.classList.remove('hidden');
}

function checkAnswer() {
    const stage = gameData[currentStageIndex];
    if (inputEl.value.trim() === stage.answer) {
        document.body.style.animation = 'shake-body 0.3s';
        setTimeout(() => document.body.style.animation = '', 300);

        popupKeyword.innerHTML = `<span class="highlight-item">🃏 핵심가치: ${stage.keyword}</span> 카드 획득!`;
        popupText.innerHTML = stage.clearText;
        successPopup.classList.remove('hidden'); 
    } else {
        messageEl.innerText = "❌ 승인 거부: 코드가 일치하지 않습니다.";
        messageEl.className = "error";
    }
}

function closePopupAndNext() { successPopup.classList.add('hidden'); currentStageIndex++; loadStage(); }
function showHint() { hintBoxEl.innerText = `[AI 통제실 단서]: ${gameData[currentStageIndex].hint}`; hintBoxEl.classList.toggle('hidden'); }

function showCelebrationEffect() {
    celebrationOverlay.classList.remove('hidden');
    const count = 100;
    for (let i = 0; i < count; i++) { createParticle(); }
}

function createParticle() {
    const particle = document.createElement('div');
    const shape = Math.random() > 0.5 ? '🧬' : '⭐';
    particle.className = 'particle';
    particle.innerHTML = shape;
    particle.style.left = `${Math.random() * 100}vw`;
    particle.style.animationDuration = `${Math.random() * 3 + 4}s`;
    particle.style.animationDelay = `${Math.random() * 2}s`;
    particle.style.fontSize = `${Math.random() * 1.5 + 1}rem`;
    particle.style.color = Math.random() > 0.3 ? '#ffd700' : '#ffffff';
    particle.style.textShadow = `0 0 10px ${particle.style.color}`;
    celebrationOverlay.appendChild(particle);
    setTimeout(() => {
        particle.remove();
        if (currentStageIndex === gameData.length - 1) createParticle();
    }, (parseFloat(particle.style.animationDuration) + parseFloat(particle.style.animationDelay)) * 1000);
}
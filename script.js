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

window.onload = function() {
    document.body.style.backgroundImage = "url('bg_intro.png')";
    fetchGameData(); 
    successPopup.classList.add('hidden');
    hintPopup.classList.add('hidden');
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
        err.innerText = "❌ 접근 거부: 코드 오류";
        err.style.animation = "shake 0.3s";
        setTimeout(() => err.style.animation = "", 300);
    }
}

function startGame() { worldviewScreen.classList.add('hidden'); gameScreen.classList.remove('hidden'); loadStage(); }

function loadStage() {
    const stage = gameData[currentStageIndex];
    const nextBtn = document.getElementById('next-mission-btn');
    const inputSection = document.getElementById('mission-input-section');
    const storyBox = document.querySelector('.story-box');

    nextBtn.classList.remove('hidden');
    inputSection.classList.add('hidden');
    messageEl.innerText = "";
    inputEl.value = "";
    celebrationOverlay.classList.add('hidden');
    celebrationOverlay.innerHTML = '';
    successPopup.classList.add('hidden');
    hintPopup.classList.add('hidden');
    mainContainer.classList.remove('corona-effect');

    if (currentStageIndex === gameData.length - 1) {
        titleEl.innerHTML = `<span class="golden-glow-animated">🧬 우리라는 이름의 기적 🧬</span>`;
        descEl.innerHTML = stage.desc; 
        nextBtn.classList.add('hidden');
        inputSection.classList.add('hidden');
        if (prevBtn) prevBtn.classList.add('hidden');
        mainContainer.classList.add('corona-effect');
        storyBox.classList.add('clear-mode');
        document.body.style.backgroundImage = "url('bg_clear.png')";
        document.getElementById('audio-clear-bgm').play().catch(()=>{});
        showCelebrationEffect();
        return;
    }

    const titleParts = stage.title.split(':');
    if (titleParts.length > 1) {
        titleEl.innerHTML = `${titleParts[0]}<br><span class="stage-subtitle">"${titleParts[1].trim()}"</span>`;
    } else {
        titleEl.innerHTML = stage.title;
    }

    descEl.innerHTML = stage.desc; 
    document.body.style.backgroundImage = `url('bg_stage${currentStageIndex + 1}.png')`;

    if (prevBtn) {
        if (currentStageIndex === 0) prevBtn.classList.add('hidden');
        else prevBtn.classList.remove('hidden');
    }
}

function showMission() {
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
// SladeMini Game Lab - Basic Clicker Logic

document.addEventListener('DOMContentLoaded', () => {
    const clickBtn = document.getElementById('click-btn');
    const scoreValue = document.getElementById('score-value');
    let score = 0;

    clickBtn.addEventListener('click', () => {
        score += 1;
        scoreValue.textContent = score;
    });
});

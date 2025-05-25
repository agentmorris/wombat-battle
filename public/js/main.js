let socket;
let game;
let gameId;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize game
    const canvas = document.getElementById('gameBoard');
    game = new WombatBattleGame(canvas);
    
    // Menu event listeners
    document.getElementById('createGame').addEventListener('click', createGame);
    document.getElementById('joinGame').addEventListener('click', showJoinForm);
    document.getElementById('playAI').addEventListener('click', playAI);
    document.getElementById('joinGameBtn').addEventListener('click', joinGame);
    document.getElementById('cancelJoin').addEventListener('click', hideJoinForm);
    document.getElementById('backToMenu').addEventListener('click', backToMenu);
    document.getElementById('readyBtn').addEventListener('click', playerReady);
    document.getElementById('playAgain').addEventListener('click', playAgain);
    
    // Game action buttons
    document.getElementById('moveBtn').addEventListener('click', () => game.setAction('move'));
    document.getElementById('digBtn').addEventListener('click', () => game.setAction('dig'));
    
    // Enter key support for game code input
    document.getElementById('gameCodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinGame();
        }
    });
    
    // Initialize socket
    initializeSocket();
});

function initializeSocket() {
    socket = io();
    
    socket.on('gameCreated', (data) => {
        gameId = data.gameId;
        document.getElementById('displayGameCode').textContent = data.gameCode;
        showScreen('lobby');
    });
    
    socket.on('gameJoined', (data) => {
        gameId = data.gameId;
        game.setPlayerSide(data.playerSide);
        game.setBoard(data.board);
        game.gameId = gameId;
        showScreen('lobby');
        document.getElementById('readyBtn').classList.remove('hidden');
    });
    
    socket.on('playerJoined', (data) => {
        updatePlayersDisplay(data.players);
        if (data.canStart) {
            document.getElementById('readyBtn').classList.remove('hidden');
        }
    });
    
    socket.on('gameStarted', (data) => {
        game.setBoard(data.board);
        game.setCurrentTurn(data.currentTurn);
        showScreen('game');
    });
    
    socket.on('moveApplied', (data) => {
        game.setBoard(data.board);
        game.setHoles(data.holes);
        game.setCurrentTurn(data.currentTurn);
    });
    
    socket.on('gameOver', (data) => {
        game.showGameOver(data.winner);
    });
    
    socket.on('playerLeft', () => {
        alert('Your opponent has left the game');
        backToMenu();
    });
    
    socket.on('error', (message) => {
        alert('Error: ' + message);
    });
    
    socket.on('invalidMove', (message) => {
        alert('Invalid move: ' + message);
    });
}

function createGame() {
    socket.emit('createGame');
}

function showJoinForm() {
    document.querySelector('.menu-options').classList.add('hidden');
    document.getElementById('joinForm').classList.remove('hidden');
    document.getElementById('gameCodeInput').focus();
}

function hideJoinForm() {
    document.querySelector('.menu-options').classList.remove('hidden');
    document.getElementById('joinForm').classList.add('hidden');
    document.getElementById('gameCodeInput').value = '';
}

function joinGame() {
    const gameCode = document.getElementById('gameCodeInput').value.trim().toUpperCase();
    if (gameCode.length === 6) {
        socket.emit('joinGame', gameCode);
        hideJoinForm();
    } else {
        alert('Please enter a valid 6-character game code');
    }
}

function playAI() {
    game.setGameMode('ai');
    game.initializeBoard();
    game.setPlayerSide('wombat');
    game.updateTurnDisplay();
    showScreen('game');
}

function playerReady() {
    socket.emit('playerReady', gameId);
    document.getElementById('readyBtn').disabled = true;
    document.getElementById('readyBtn').textContent = 'Waiting...';
}

function backToMenu() {
    showScreen('menu');
    hideJoinForm();
    
    // Reset game state
    if (gameId && socket) {
        socket.disconnect();
        initializeSocket();
    }
    gameId = null;
    
    // Reset ready button
    const readyBtn = document.getElementById('readyBtn');
    readyBtn.disabled = false;
    readyBtn.textContent = 'Ready';
    readyBtn.classList.add('hidden');
}

function playAgain() {
    if (game.gameMode === 'ai') {
        game.initializeBoard();
        game.setPlayerSide('wombat');
        game.updateTurnDisplay();
        showScreen('game');
    } else {
        backToMenu();
    }
}

function showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    
    // Show requested screen
    document.getElementById(screenName).classList.remove('hidden');
}

function updatePlayersDisplay(players) {
    const playersDiv = document.getElementById('players');
    playersDiv.innerHTML = '';
    
    Object.values(players).forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.className = 'player';
        playerElement.textContent = `${player.side.toUpperCase()} - ${player.ready ? 'Ready' : 'Not Ready'}`;
        playersDiv.appendChild(playerElement);
    });
}

// Utility functions
function showGameStatus(message) {
    document.getElementById('gameStatus').textContent = message;
}

// Game state management
function resetGame() {
    game.initializeBoard();
    game.selectedCell = null;
    game.currentAction = 'move';
    game.setAction('move');
    showGameStatus('');
}
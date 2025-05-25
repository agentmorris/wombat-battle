const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));

const games = new Map();

function generateGameCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createInitialBoard() {
  const board = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Place wombats (bottom two rows)
  for (let row = 6; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 0) {
        board[row][col] = { type: 'wombat', player: 'wombat' };
      }
    }
  }
  
  // Place jackals (top two rows)
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 0) {
        board[row][col] = { type: 'jackal', player: 'jackal' };
      }
    }
  }
  
  return board;
}

function createGame() {
  return {
    id: uuidv4(),
    code: generateGameCode(),
    players: {},
    board: createInitialBoard(),
    currentTurn: 'wombat',
    holes: new Set(),
    gameStarted: false,
    winner: null
  };
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('createGame', () => {
    const game = createGame();
    games.set(game.id, game);
    socket.join(game.id);
    
    socket.emit('gameCreated', {
      gameId: game.id,
      gameCode: game.code
    });
  });

  socket.on('joinGame', (gameCode) => {
    const game = Array.from(games.values()).find(g => g.code === gameCode);
    
    if (!game) {
      socket.emit('error', 'Game not found');
      return;
    }

    if (Object.keys(game.players).length >= 2) {
      socket.emit('error', 'Game is full');
      return;
    }

    socket.join(game.id);
    
    const playerSide = Object.keys(game.players).length === 0 ? 'wombat' : 'jackal';
    game.players[socket.id] = {
      id: socket.id,
      side: playerSide,
      ready: false
    };

    socket.emit('gameJoined', {
      gameId: game.id,
      playerSide: playerSide,
      board: game.board
    });

    io.to(game.id).emit('playerJoined', {
      players: game.players,
      canStart: Object.keys(game.players).length === 2
    });
  });

  socket.on('playerReady', (gameId) => {
    const game = games.get(gameId);
    if (!game || !game.players[socket.id]) return;

    game.players[socket.id].ready = true;
    
    const allReady = Object.values(game.players).every(p => p.ready);
    if (allReady && Object.keys(game.players).length === 2) {
      game.gameStarted = true;
      io.to(gameId).emit('gameStarted', {
        board: game.board,
        currentTurn: game.currentTurn
      });
    }
  });

  socket.on('makeMove', (data) => {
    const { gameId, from, to, action } = data;
    const game = games.get(gameId);
    
    if (!game || !game.gameStarted || game.winner) return;
    
    const player = game.players[socket.id];
    if (!player || player.side !== game.currentTurn) return;

    const validMove = validateMove(game, from, to, action, player.side);
    if (!validMove) {
      socket.emit('invalidMove', 'Invalid move');
      return;
    }

    applyMove(game, from, to, action);
    
    game.currentTurn = game.currentTurn === 'wombat' ? 'jackal' : 'wombat';
    
    const winner = checkWinner(game);
    if (winner) {
      game.winner = winner;
      io.to(gameId).emit('gameOver', { winner });
    } else {
      io.to(gameId).emit('moveApplied', {
        board: game.board,
        holes: Array.from(game.holes),
        currentTurn: game.currentTurn
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    for (const [gameId, game] of games.entries()) {
      if (game.players[socket.id]) {
        delete game.players[socket.id];
        
        if (Object.keys(game.players).length === 0) {
          games.delete(gameId);
        } else {
          io.to(gameId).emit('playerLeft');
        }
        break;
      }
    }
  });
});

function validateMove(game, from, to, action, playerSide) {
  const { row: fromRow, col: fromCol } = from;
  const { row: toRow, col: toCol } = to;
  
  const piece = game.board[fromRow][fromCol];
  if (!piece || piece.player !== playerSide) return false;
  
  if (action === 'dig' && piece.type === 'wombat') {
    return game.board[toRow][toCol] === null && !game.holes.has(`${toRow},${toCol}`);
  }
  
  if (action === 'move') {
    const distance = Math.abs(fromRow - toRow) + Math.abs(fromCol - toCol);
    if (distance !== 1) return false;
    
    return game.board[toRow][toCol] === null || 
           (game.board[toRow][toCol].player !== playerSide);
  }
  
  return false;
}

function applyMove(game, from, to, action) {
  const { row: fromRow, col: fromCol } = from;
  const { row: toRow, col: toCol } = to;
  
  if (action === 'dig') {
    game.holes.add(`${toRow},${toCol}`);
  } else if (action === 'move') {
    const piece = game.board[fromRow][fromCol];
    game.board[toRow][toCol] = piece;
    game.board[fromRow][fromCol] = null;
  }
}

function checkWinner(game) {
  const wombatCount = game.board.flat().filter(cell => cell && cell.type === 'wombat').length;
  const jackalCount = game.board.flat().filter(cell => cell && cell.type === 'jackal').length;
  
  if (wombatCount === 0) return 'jackal';
  if (jackalCount === 0) return 'wombat';
  
  return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Wombat Battle server running on port ${PORT}`);
});
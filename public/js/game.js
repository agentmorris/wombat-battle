class WombatBattleGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.boardSize = 8;
        this.cellSize = 80;
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        this.holes = new Set();
        this.selectedCell = null;
        this.currentAction = 'move';
        this.playerSide = null;
        this.currentTurn = 'wombat';
        this.gameMode = 'online'; // 'online' or 'ai'
        
        // Image loading
        this.images = {};
        this.imagesLoaded = false;
        
        this.setupCanvas();
        this.loadImages();
        this.bindEvents();
    }

    setupCanvas() {
        this.canvas.width = this.boardSize * this.cellSize;
        this.canvas.height = this.boardSize * this.cellSize;
    }

    loadImages() {
        const imageFiles = {
            wombat: 'images/wombat.png',
            jackal: 'images/jackal.png'
        };
        
        let loadedCount = 0;
        const totalImages = Object.keys(imageFiles).length;
        
        for (const [key, src] of Object.entries(imageFiles)) {
            const img = new Image();
            img.onload = () => {
                loadedCount++;
                if (loadedCount === totalImages) {
                    this.imagesLoaded = true;
                    this.render(); // Re-render once images are loaded
                }
            };
            img.onerror = () => {
                console.warn(`Failed to load image: ${src}, falling back to emoji`);
                loadedCount++;
                if (loadedCount === totalImages) {
                    this.imagesLoaded = true;
                    this.render();
                }
            };
            img.src = src;
            this.images[key] = img;
        }
    }

    bindEvents() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        
        if (row < 0 || row >= this.boardSize || col < 0 || col >= this.boardSize) return;
        
        if (this.gameMode === 'ai' || this.playerSide === this.currentTurn) {
            this.handleCellClick(row, col);
        }
    }

    handleCellClick(row, col) {
        if (this.selectedCell) {
            if (this.selectedCell.row === row && this.selectedCell.col === col) {
                this.selectedCell = null;
            } else {
                this.attemptMove(this.selectedCell, { row, col });
            }
        } else {
            const piece = this.board[row][col];
            if (piece && (this.gameMode === 'ai' || piece.player === this.playerSide)) {
                this.selectedCell = { row, col };
            }
        }
        this.render();
    }

    attemptMove(from, to) {
        const piece = this.board[from.row][from.col];
        const targetCell = this.board[to.row][to.col];
        
        if (this.currentAction === 'dig' && piece.type === 'wombat') {
            if (targetCell === null && !this.holes.has(`${to.row},${to.col}`)) {
                this.makeMove(from, to, 'dig');
            }
        } else if (this.currentAction === 'move') {
            const distance = Math.abs(from.row - to.row) + Math.abs(from.col - to.col);
            if (distance === 1) {
                if (targetCell === null || targetCell.player !== piece.player) {
                    if (this.holes.has(`${to.row},${to.col}`) && piece.type === 'jackal') {
                        // Jackals fall into holes and are removed
                        this.board[from.row][from.col] = null;
                        this.selectedCell = null;
                        this.switchTurn();
                        return;
                    }
                    this.makeMove(from, to, 'move');
                }
            }
        }
    }

    makeMove(from, to, action) {
        if (this.gameMode === 'online') {
            socket.emit('makeMove', {
                gameId: this.gameId,
                from: from,
                to: to,
                action: action
            });
        } else {
            this.applyMove(from, to, action);
            this.switchTurn();
            
            if (this.currentTurn !== this.playerSide && this.gameMode === 'ai') {
                setTimeout(() => this.makeAIMove(), 1000);
            }
        }
        this.selectedCell = null;
    }

    applyMove(from, to, action) {
        if (action === 'dig') {
            this.holes.add(`${to.row},${to.col}`);
        } else if (action === 'move') {
            const piece = this.board[from.row][from.col];
            this.board[to.row][to.col] = piece;
            this.board[from.row][from.col] = null;
        }
        this.render(); // Force re-render after applying move
    }

    switchTurn() {
        this.currentTurn = this.currentTurn === 'wombat' ? 'jackal' : 'wombat';
        this.updateTurnDisplay();
        
        const winner = this.checkWinner();
        if (winner) {
            this.showGameOver(winner);
        }
    }

    checkWinner() {
        const wombatCount = this.board.flat().filter(cell => cell && cell.type === 'wombat').length;
        const jackalCount = this.board.flat().filter(cell => cell && cell.type === 'jackal').length;
        
        if (wombatCount === 0) return 'jackal';
        if (jackalCount === 0) return 'wombat';
        
        return null;
    }

    makeAIMove() {
        const aiMove = this.getAIMove();
        if (aiMove) {
            this.applyMove(aiMove.from, aiMove.to, aiMove.action);
            this.switchTurn();
        }
    }

    getAIMove() {
        const pieces = [];
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const piece = this.board[row][col];
                if (piece && piece.player === this.currentTurn) {
                    pieces.push({ row, col, piece });
                }
            }
        }

        const possibleMoves = [];
        
        for (const { row, col, piece } of pieces) {
            // Try move actions
            const directions = [[-1,0], [1,0], [0,-1], [0,1]];
            for (const [dr, dc] of directions) {
                const newRow = row + dr;
                const newCol = col + dc;
                
                if (newRow >= 0 && newRow < this.boardSize && newCol >= 0 && newCol < this.boardSize) {
                    const target = this.board[newRow][newCol];
                    
                    if (target === null || target.player !== piece.player) {
                        if (!this.holes.has(`${newRow},${newCol}`) || piece.type === 'wombat') {
                            possibleMoves.push({
                                from: { row, col },
                                to: { row: newRow, col: newCol },
                                action: 'move',
                                priority: target ? 10 : 1 // Prioritize captures
                            });
                        }
                    }
                }
            }
            
            // Try dig actions (wombats only)
            if (piece.type === 'wombat') {
                for (const [dr, dc] of directions) {
                    const newRow = row + dr;
                    const newCol = col + dc;
                    
                    if (newRow >= 0 && newRow < this.boardSize && newCol >= 0 && newCol < this.boardSize) {
                        if (this.board[newRow][newCol] === null && !this.holes.has(`${newRow},${newCol}`)) {
                            possibleMoves.push({
                                from: { row, col },
                                to: { row: newRow, col: newCol },
                                action: 'dig',
                                priority: 5
                            });
                        }
                    }
                }
            }
        }

        if (possibleMoves.length === 0) return null;
        
        // Sort by priority and pick randomly from top priorities
        possibleMoves.sort((a, b) => b.priority - a.priority);
        const topPriority = possibleMoves[0].priority;
        const topMoves = possibleMoves.filter(move => move.priority === topPriority);
        
        return topMoves[Math.floor(Math.random() * topMoves.length)];
    }

    setBoard(board) {
        this.board = board;
        this.render();
    }

    setHoles(holes) {
        this.holes = new Set(holes);
        this.render();
    }

    setCurrentTurn(turn) {
        this.currentTurn = turn;
        this.updateTurnDisplay();
    }

    setPlayerSide(side) {
        this.playerSide = side;
        document.getElementById('playerSide').textContent = `You are: ${side.toUpperCase()}`;
    }

    setGameMode(mode) {
        this.gameMode = mode;
        if (mode === 'ai') {
            this.playerSide = 'wombat';
            this.setPlayerSide('wombat');
        }
    }

    setAction(action) {
        this.currentAction = action;
        document.querySelectorAll('.action-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(action + 'Btn').classList.add('active');
    }

    updateTurnDisplay() {
        const turnElement = document.getElementById('currentTurn');
        turnElement.textContent = `Current turn: ${this.currentTurn.toUpperCase()}`;
        turnElement.style.color = this.currentTurn === this.playerSide ? '#27ae60' : '#e74c3c';
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw board
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const x = col * this.cellSize;
                const y = row * this.cellSize;
                
                // Checkerboard pattern
                this.ctx.fillStyle = (row + col) % 2 === 0 ? '#f4a261' : '#e76f51';
                this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
                
                // Holes
                if (this.holes.has(`${row},${col}`)) {
                    this.ctx.fillStyle = '#2d3436';
                    this.ctx.beginPath();
                    this.ctx.arc(x + this.cellSize/2, y + this.cellSize/2, this.cellSize/3, 0, 2 * Math.PI);
                    this.ctx.fill();
                }
                
                // Pieces
                const piece = this.board[row][col];
                if (piece) {
                    this.drawPiece(x, y, piece.type);
                }
                
                // Selection highlight
                if (this.selectedCell && this.selectedCell.row === row && this.selectedCell.col === col) {
                    this.ctx.strokeStyle = '#00b894';
                    this.ctx.lineWidth = 4;
                    this.ctx.strokeRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
                }
                
                // Grid lines
                this.ctx.strokeStyle = '#2d3436';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);
            }
        }
    }

    drawPiece(x, y, type) {
        const centerX = x + this.cellSize / 2;
        const centerY = y + this.cellSize / 2;
        
        if (this.imagesLoaded && this.images[type] && this.images[type].complete) {
            // Draw custom PNG image
            const imageSize = this.cellSize * 0.7; // 70% of cell size for good proportions
            const imageX = centerX - imageSize / 2;
            const imageY = centerY - imageSize / 2;
            
            this.ctx.drawImage(this.images[type], imageX, imageY, imageSize, imageSize);
        } else {
            // Fallback to emoji if images aren't loaded yet
            const fontSize = this.cellSize * 0.6;
            this.ctx.font = `${fontSize}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            if (type === 'wombat') {
                this.ctx.fillText('🦫', centerX, centerY);
            } else if (type === 'jackal') {
                this.ctx.fillText('🐺', centerX, centerY);
            }
        }
    }

    showGameOver(winner) {
        document.getElementById('game').classList.add('hidden');
        document.getElementById('gameOver').classList.remove('hidden');
        document.getElementById('winnerText').textContent = `${winner.toUpperCase()} wins!`;
    }

    initializeBoard() {
        // Clear board
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        // Place wombats (bottom two rows)
        for (let row = 6; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 === 0) {
                    this.board[row][col] = { type: 'wombat', player: 'wombat' };
                }
            }
        }
        
        // Place jackals (top two rows)
        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 === 0) {
                    this.board[row][col] = { type: 'jackal', player: 'jackal' };
                }
            }
        }
        
        this.holes.clear();
        this.currentTurn = 'wombat';
        this.selectedCell = null;
        this.render();
    }
}
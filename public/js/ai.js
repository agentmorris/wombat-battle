class WombatBattleAI {
    constructor(game) {
        this.game = game;
        this.difficulty = 'medium'; // easy, medium, hard
    }

    makeMove() {
        const move = this.getBestMove();
        if (move) {
            this.game.applyMove(move.from, move.to, move.action);
            this.game.switchTurn();
        }
    }

    getBestMove() {
        const moves = this.getAllPossibleMoves();
        if (moves.length === 0) return null;

        switch (this.difficulty) {
            case 'easy':
                return this.getRandomMove(moves);
            case 'medium':
                return this.getMediumMove(moves);
            case 'hard':
                return this.getHardMove(moves);
            default:
                return this.getMediumMove(moves);
        }
    }

    getAllPossibleMoves() {
        const moves = [];
        const currentPlayer = this.game.currentTurn;

        for (let row = 0; row < this.game.boardSize; row++) {
            for (let col = 0; col < this.game.boardSize; col++) {
                const piece = this.game.board[row][col];
                if (piece && piece.player === currentPlayer) {
                    moves.push(...this.getPieceMove(row, col, piece));
                }
            }
        }

        return moves;
    }

    getPieceMove(row, col, piece) {
        const moves = [];
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;

            if (this.isValidPosition(newRow, newCol)) {
                // Movement
                const target = this.game.board[newRow][newCol];
                if (target === null || target.player !== piece.player) {
                    // Check if it's safe (not a hole for jackals)
                    if (!this.game.holes.has(`${newRow},${newCol}`) || piece.type === 'wombat') {
                        moves.push({
                            from: { row, col },
                            to: { row: newRow, col: newCol },
                            action: 'move',
                            piece: piece
                        });
                    }
                }

                // Digging (wombats only)
                if (piece.type === 'wombat' && target === null && !this.game.holes.has(`${newRow},${newCol}`)) {
                    moves.push({
                        from: { row, col },
                        to: { row: newRow, col: newCol },
                        action: 'dig',
                        piece: piece
                    });
                }
            }
        }

        return moves;
    }

    isValidPosition(row, col) {
        return row >= 0 && row < this.game.boardSize && col >= 0 && col < this.game.boardSize;
    }

    getRandomMove(moves) {
        return moves[Math.floor(Math.random() * moves.length)];
    }

    getMediumMove(moves) {
        // Score moves based on simple heuristics
        const scoredMoves = moves.map(move => ({
            ...move,
            score: this.evaluateMove(move)
        }));

        scoredMoves.sort((a, b) => b.score - a.score);

        // Add some randomness - pick from top 3 moves
        const topMoves = scoredMoves.slice(0, Math.min(3, scoredMoves.length));
        return topMoves[Math.floor(Math.random() * topMoves.length)];
    }

    getHardMove(moves) {
        // Use minimax with limited depth
        return this.minimax(moves, 2, true).move;
    }

    evaluateMove(move) {
        let score = 0;
        const currentPlayer = this.game.currentTurn;
        const opponentPlayer = currentPlayer === 'wombat' ? 'jackal' : 'wombat';

        // Capture moves are valuable
        const target = this.game.board[move.to.row][move.to.col];
        if (target && target.player === opponentPlayer) {
            score += 100;
        }

        // Digging holes is valuable for wombats
        if (move.action === 'dig') {
            score += 30;
            
            // Extra points if it blocks enemy movement
            const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dr, dc] of directions) {
                const checkRow = move.to.row + dr;
                const checkCol = move.to.col + dc;
                if (this.isValidPosition(checkRow, checkCol)) {
                    const nearbyPiece = this.game.board[checkRow][checkCol];
                    if (nearbyPiece && nearbyPiece.player === opponentPlayer) {
                        score += 20;
                    }
                }
            }
        }

        // Moving towards center is generally good
        const centerDistance = Math.abs(move.to.row - 3.5) + Math.abs(move.to.col - 3.5);
        score += (7 - centerDistance) * 2;

        // Avoid moving into dangerous positions (near enemy pieces for wombats)
        if (move.piece.type === 'wombat') {
            const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dr, dc] of directions) {
                const checkRow = move.to.row + dr;
                const checkCol = move.to.col + dc;
                if (this.isValidPosition(checkRow, checkCol)) {
                    const nearbyPiece = this.game.board[checkRow][checkCol];
                    if (nearbyPiece && nearbyPiece.type === 'jackal') {
                        score -= 25;
                    }
                }
            }
        }

        // Jackals should avoid holes
        if (move.piece.type === 'jackal' && this.game.holes.has(`${move.to.row},${move.to.col}`)) {
            score -= 1000; // This should never happen due to validation, but safety check
        }

        return score;
    }

    minimax(moves, depth, isMaximizing) {
        if (depth === 0) {
            return { score: this.evaluatePosition(), move: null };
        }

        const currentMoves = isMaximizing ? moves : this.getAllPossibleMovesForPlayer(
            this.game.currentTurn === 'wombat' ? 'jackal' : 'wombat'
        );

        if (currentMoves.length === 0) {
            return { score: isMaximizing ? -1000 : 1000, move: null };
        }

        let bestMove = null;
        let bestScore = isMaximizing ? -Infinity : Infinity;

        for (const move of currentMoves.slice(0, 5)) { // Limit branching factor
            // Simulate move
            const originalBoard = this.game.board.map(row => [...row]);
            const originalHoles = new Set(this.game.holes);
            const originalTurn = this.game.currentTurn;

            this.game.applyMove(move.from, move.to, move.action);
            this.game.currentTurn = this.game.currentTurn === 'wombat' ? 'jackal' : 'wombat';

            const result = this.minimax([], depth - 1, !isMaximizing);

            // Restore game state
            this.game.board = originalBoard;
            this.game.holes = originalHoles;
            this.game.currentTurn = originalTurn;

            if (isMaximizing) {
                if (result.score > bestScore) {
                    bestScore = result.score;
                    bestMove = move;
                }
            } else {
                if (result.score < bestScore) {
                    bestScore = result.score;
                    bestMove = move;
                }
            }
        }

        return { score: bestScore, move: bestMove };
    }

    getAllPossibleMovesForPlayer(player) {
        const moves = [];

        for (let row = 0; row < this.game.boardSize; row++) {
            for (let col = 0; col < this.game.boardSize; col++) {
                const piece = this.game.board[row][col];
                if (piece && piece.player === player) {
                    moves.push(...this.getPieceMove(row, col, piece));
                }
            }
        }

        return moves;
    }

    evaluatePosition() {
        let score = 0;
        const currentPlayer = this.game.currentTurn;

        // Count pieces
        let wombatCount = 0;
        let jackalCount = 0;

        for (let row = 0; row < this.game.boardSize; row++) {
            for (let col = 0; col < this.game.boardSize; col++) {
                const piece = this.game.board[row][col];
                if (piece) {
                    if (piece.type === 'wombat') {
                        wombatCount++;
                    } else {
                        jackalCount++;
                    }
                }
            }
        }

        // Material advantage
        if (currentPlayer === 'wombat') {
            score += (wombatCount - jackalCount) * 10;
        } else {
            score += (jackalCount - wombatCount) * 10;
        }

        // Mobility advantage
        const currentMoves = this.getAllPossibleMoves().length;
        score += currentMoves * 2;

        return score;
    }

    setDifficulty(difficulty) {
        this.difficulty = difficulty;
    }
}
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wombat Battle is a 2D turn-based board game where wombats fight jackals. Wombats have the special ability to dig holes to evade jackal attacks, while jackals are stronger in direct combat.

## Development Commands

```bash
# Install dependencies
npm install

# Start the server
npm start

# Start with auto-reload for development
npm run dev
```

## Architecture

### Server (server.js)
- Express.js web server serving static files
- Socket.IO for real-time multiplayer communication
- Game state management with in-memory storage
- Room-based multiplayer with game codes

### Client-Side
- **main.js**: UI management, socket event handling, screen transitions
- **game.js**: Core game engine, canvas rendering, move validation
- **ai.js**: AI opponent with multiple difficulty levels
- **index.html**: Game interface with lobby, game board, and menus
- **style.css**: Responsive design with colorful game aesthetics

## Game Mechanics

- **Board**: 8x8 grid with checkerboard pattern
- **Pieces**: Wombats start at bottom, jackals at top
- **Wombat special ability**: Can dig holes in adjacent empty cells
- **Jackal vulnerability**: Fall into holes and are eliminated
- **Win condition**: Eliminate all enemy pieces

## Deployment

The game runs on port 3000 by default. For production deployment:
1. Set PORT environment variable
2. Ensure WebSocket connections are supported
3. Game sessions are temporary (no persistence beyond process lifetime)
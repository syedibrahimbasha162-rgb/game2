const TRACK = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8],
  [14, 8], [14, 7], [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2],
  [8, 1], [8, 0], [7, 0], [6, 0],
];

const HOME_LANES = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
];

const PLAYERS = [
  {
    name: "Red",
    color: "#d23b30",
    dark: "#8f241d",
    start: 0,
    isAI: false,
    yard: [[1.8, 1.8], [4.2, 1.8], [1.8, 4.2], [4.2, 4.2]],
  },
  {
    name: "Blue",
    color: "#3270c9",
    dark: "#204b89",
    start: 13,
    isAI: true,
    yard: [[10.8, 1.8], [13.2, 1.8], [10.8, 4.2], [13.2, 4.2]],
  },
  {
    name: "Yellow",
    color: "#e2b332",
    dark: "#9a771e",
    start: 26,
    isAI: true,
    yard: [[10.8, 10.8], [13.2, 10.8], [10.8, 13.2], [13.2, 13.2]],
  },
  {
    name: "Green",
    color: "#2ea664",
    dark: "#1e6f43",
    start: 39,
    isAI: true,
    yard: [[1.8, 10.8], [4.2, 10.8], [1.8, 13.2], [4.2, 13.2]],
  },
];

const SAFE_TRACK_INDEXES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const TOKENS_PER_PLAYER = 4;
const FINISH_PROGRESS = 58;

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const rollBtn = document.getElementById("rollBtn");
const newBtn = document.getElementById("newBtn");
const turnLabel = document.getElementById("turnLabel");
const diceLabel = document.getElementById("diceLabel");
const messageLabel = document.getElementById("messageLabel");

const CELL = 44;
const PADDING = 30;
const TOKEN_R = 12;

let state;
let clickableTokenPositions = [];

function gridToPx(col, row) {
  return {
    x: PADDING + col * CELL + CELL / 2,
    y: PADDING + row * CELL + CELL / 2,
  };
}

function initState() {
  state = {
    players: PLAYERS.map((p) => ({
      ...p,
      tokens: Array(TOKENS_PER_PLAYER).fill(-1),
      finished: 0,
    })),
    current: 0,
    dice: null,
    rollLocked: false,
    movable: [],
    sixStreak: 0,
    winner: null,
    message: "Roll to start.",
  };
}

function tokenTrackIndex(playerIdx, progress) {
  if (progress < 0 || progress >= 52) {
    return null;
  }
  return (state.players[playerIdx].start + progress) % 52;
}

function canTokenMove(playerIdx, tokenIdx, dice) {
  const progress = state.players[playerIdx].tokens[tokenIdx];

  if (progress === FINISH_PROGRESS) {
    return false;
  }

  if (progress === -1) {
    return dice === 6;
  }

  return progress + dice <= FINISH_PROGRESS;
}

function movableTokens(playerIdx, dice) {
  const result = [];
  for (let i = 0; i < TOKENS_PER_PLAYER; i += 1) {
    if (canTokenMove(playerIdx, i, dice)) {
      result.push(i);
    }
  }
  return result;
}

function tokenLogicalPosition(playerIdx, tokenIdx) {
  const progress = state.players[playerIdx].tokens[tokenIdx];

  if (progress === -1) {
    const [c, r] = state.players[playerIdx].yard[tokenIdx];
    return { type: "yard", col: c, row: r, bucket: `yard-${playerIdx}-${tokenIdx}` };
  }

  if (progress < 52) {
    const idx = tokenTrackIndex(playerIdx, progress);
    const [c, r] = TRACK[idx];
    return { type: "track", col: c, row: r, bucket: `track-${idx}` };
  }

  if (progress < FINISH_PROGRESS) {
    const [c, r] = HOME_LANES[playerIdx][progress - 52];
    return { type: "home", col: c, row: r, bucket: `home-${playerIdx}-${progress}` };
  }

  return { type: "finish", col: 7, row: 7, bucket: `finish-${playerIdx}` };
}

function groupedTokenOffsets() {
  const groups = new Map();

  for (let p = 0; p < state.players.length; p += 1) {
    for (let t = 0; t < TOKENS_PER_PLAYER; t += 1) {
      const pos = tokenLogicalPosition(p, t);
      const key = pos.bucket;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push({ p, t, pos });
    }
  }

  return groups;
}

function tokenPixelPosition(playerIdx, tokenIdx, groups) {
  const node = tokenLogicalPosition(playerIdx, tokenIdx);
  const center = gridToPx(node.col, node.row);
  const cluster = groups.get(node.bucket) || [];
  const idx = cluster.findIndex((v) => v.p === playerIdx && v.t === tokenIdx);

  if (cluster.length <= 1 || idx === -1) {
    return center;
  }

  const radius = 11;
  const angle = (Math.PI * 2 * idx) / cluster.length;
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

function drawCell(col, row, fill, stroke = "#8e7d5d", line = 1.1) {
  const x = PADDING + col * CELL;
  const y = PADDING + row * CELL;
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, CELL, CELL);
  ctx.lineWidth = line;
  ctx.strokeStyle = stroke;
  ctx.strokeRect(x, y, CELL, CELL);
}

function drawBaseBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#f8efd8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < 15; r += 1) {
    for (let c = 0; c < 15; c += 1) {
      drawCell(c, r, "#fffef9");
    }
  }

  for (let r = 0; r < 6; r += 1) {
    for (let c = 0; c < 6; c += 1) {
      drawCell(c, r, "#f9d2cf");
      drawCell(c + 9, r, "#d3e2fb");
      drawCell(c + 9, r + 9, "#faefc9");
      drawCell(c, r + 9, "#d5f2e2");
    }
  }

  for (let i = 0; i < 52; i += 1) {
    const [c, r] = TRACK[i];
    drawCell(c, r, "#ffffff", "#746646", 1.4);
  }

  for (let i = 0; i < HOME_LANES[0].length; i += 1) {
    drawCell(HOME_LANES[0][i][0], HOME_LANES[0][i][1], "#f4a9a4");
    drawCell(HOME_LANES[1][i][0], HOME_LANES[1][i][1], "#a9c7f2");
    drawCell(HOME_LANES[2][i][0], HOME_LANES[2][i][1], "#f4dc8d");
    drawCell(HOME_LANES[3][i][0], HOME_LANES[3][i][1], "#9ce0be");
  }

  ctx.fillStyle = "#f2ead4";
  ctx.beginPath();
  ctx.moveTo(...Object.values(gridToPx(6, 6)));
  ctx.lineTo(...Object.values(gridToPx(8, 6)));
  ctx.lineTo(...Object.values(gridToPx(8, 8)));
  ctx.lineTo(...Object.values(gridToPx(6, 8)));
  ctx.closePath();
  ctx.fill();

  const tri = [
    { color: "#d23b30", points: [[6, 6], [7, 7], [8, 6]] },
    { color: "#3270c9", points: [[8, 6], [7, 7], [8, 8]] },
    { color: "#e2b332", points: [[8, 8], [7, 7], [6, 8]] },
    { color: "#2ea664", points: [[6, 8], [7, 7], [6, 6]] },
  ];

  for (const t of tri) {
    ctx.fillStyle = t.color;
    ctx.beginPath();
    const p0 = gridToPx(t.points[0][0], t.points[0][1]);
    const p1 = gridToPx(t.points[1][0], t.points[1][1]);
    const p2 = gridToPx(t.points[2][0], t.points[2][1]);
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.closePath();
    ctx.fill();
  }

  for (const safeIdx of SAFE_TRACK_INDEXES) {
    const [c, r] = TRACK[safeIdx];
    const p = gridToPx(c, r);
    ctx.fillStyle = "#2f2f2f";
    ctx.font = "700 14px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("*", p.x, p.y + 1);
  }
}

function drawYardPads() {
  for (const p of PLAYERS) {
    for (let i = 0; i < p.yard.length; i += 1) {
      const spot = p.yard[i];
      const pos = gridToPx(spot[0], spot[1]);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = "#fffdf5";
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = p.dark;
      ctx.stroke();
    }
  }
}

function drawTokens() {
  const groups = groupedTokenOffsets();
  clickableTokenPositions = [];

  for (let p = 0; p < state.players.length; p += 1) {
    for (let t = 0; t < TOKENS_PER_PLAYER; t += 1) {
      const pos = tokenPixelPosition(p, t, groups);
      const current = state.players[p];

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, TOKEN_R, 0, Math.PI * 2);
      ctx.fillStyle = current.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#1f1f1f";
      ctx.stroke();

      if (p === state.current && state.movable.includes(t) && !current.isAI) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, TOKEN_R + 5, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#000";
        ctx.stroke();
        clickableTokenPositions.push({ token: t, x: pos.x, y: pos.y });
      }

      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px Segoe UI";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(t + 1), pos.x, pos.y + 0.5);
    }
  }
}

function render() {
  drawBaseBoard();
  drawYardPads();
  drawTokens();
  updatePanel();
}

function updatePanel() {
  turnLabel.textContent = state.players[state.current].name;
  diceLabel.textContent = state.dice === null ? "-" : String(state.dice);
  messageLabel.textContent = state.message;
  rollBtn.disabled = state.winner !== null || state.rollLocked || state.players[state.current].isAI;
}

function checkWinner(playerIdx) {
  if (state.players[playerIdx].finished === TOKENS_PER_PLAYER) {
    state.winner = playerIdx;
    state.message = `${state.players[playerIdx].name} wins the game.`;
    state.rollLocked = true;
    return true;
  }
  return false;
}

function captureIfPossible(playerIdx, newProgress) {
  if (newProgress < 0 || newProgress >= 52) {
    return;
  }

  const trackIdx = tokenTrackIndex(playerIdx, newProgress);
  if (SAFE_TRACK_INDEXES.has(trackIdx)) {
    return;
  }

  for (let op = 0; op < state.players.length; op += 1) {
    if (op === playerIdx) {
      continue;
    }

    for (let t = 0; t < TOKENS_PER_PLAYER; t += 1) {
      const opProg = state.players[op].tokens[t];
      if (opProg >= 0 && opProg < 52) {
        const opTrack = tokenTrackIndex(op, opProg);
        if (opTrack === trackIdx) {
          state.players[op].tokens[t] = -1;
          state.message = `${state.players[playerIdx].name} captured ${state.players[op].name}'s token ${t + 1}.`;
        }
      }
    }
  }
}

function moveToken(playerIdx, tokenIdx) {
  const dice = state.dice;
  const currentProgress = state.players[playerIdx].tokens[tokenIdx];

  let nextProgress;
  if (currentProgress === -1) {
    nextProgress = 0;
  } else {
    nextProgress = currentProgress + dice;
  }

  state.players[playerIdx].tokens[tokenIdx] = nextProgress;

  if (nextProgress === FINISH_PROGRESS) {
    state.players[playerIdx].finished += 1;
    state.message = `${state.players[playerIdx].name} finished token ${tokenIdx + 1}.`;
    if (checkWinner(playerIdx)) {
      state.movable = [];
      state.dice = null;
      render();
      return;
    }
  } else {
    captureIfPossible(playerIdx, nextProgress);
  }

  state.movable = [];
  const rolledSix = dice === 6;
  state.dice = null;

  if (rolledSix) {
    state.message = `${state.players[playerIdx].name} gets an extra turn.`;
    state.rollLocked = false;
    render();
    maybeRunAI();
    return;
  }

  endTurn();
}

function endTurn() {
  state.current = (state.current + 1) % state.players.length;
  state.rollLocked = false;
  state.dice = null;
  state.sixStreak = 0;
  state.movable = [];
  state.message = `${state.players[state.current].name}'s turn.`;
  render();
  maybeRunAI();
}

function aiSelectMove(playerIdx, options, dice) {
  let best = options[0];
  let bestScore = -999;

  for (const tokenIdx of options) {
    const progress = state.players[playerIdx].tokens[tokenIdx];
    const next = progress === -1 ? 0 : progress + dice;
    let score = 0;

    if (next === FINISH_PROGRESS) score += 60;
    if (progress === -1) score += 18;
    if (next >= 0 && next < 52) {
      const idx = tokenTrackIndex(playerIdx, next);
      if (SAFE_TRACK_INDEXES.has(idx)) score += 8;

      for (let op = 0; op < state.players.length; op += 1) {
        if (op === playerIdx) continue;
        for (let t = 0; t < TOKENS_PER_PLAYER; t += 1) {
          const opP = state.players[op].tokens[t];
          if (opP >= 0 && opP < 52 && tokenTrackIndex(op, opP) === idx && !SAFE_TRACK_INDEXES.has(idx)) {
            score += 24;
          }
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = tokenIdx;
    }
  }

  return best;
}

function onRoll() {
  if (state.winner !== null || state.rollLocked) return;

  const currentPlayer = state.players[state.current];
  if (currentPlayer.isAI) return;

  state.rollLocked = true;
  state.dice = 1 + Math.floor(Math.random() * 6);

  if (state.dice === 6) {
    state.sixStreak += 1;
  } else {
    state.sixStreak = 0;
  }

  if (state.sixStreak === 3) {
    state.message = `${currentPlayer.name} rolled three 6s. Turn forfeited.`;
    state.rollLocked = false;
    state.sixStreak = 0;
    render();
    setTimeout(endTurn, 700);
    return;
  }

  state.movable = movableTokens(state.current, state.dice);

  if (!state.movable.length) {
    state.message = `${currentPlayer.name} rolled ${state.dice}. No valid move.`;
    render();
    setTimeout(endTurn, 700);
    return;
  }

  state.message = `${currentPlayer.name} rolled ${state.dice}. Choose a highlighted token.`;
  state.rollLocked = false;
  render();
}

function maybeRunAI() {
  if (state.winner !== null) return;

  const player = state.players[state.current];
  if (!player.isAI) return;

  state.rollLocked = true;
  render();

  setTimeout(() => {
    if (state.winner !== null || state.current !== PLAYERS.findIndex((p) => p.name === player.name)) return;

    state.dice = 1 + Math.floor(Math.random() * 6);

    if (state.dice === 6) {
      state.sixStreak += 1;
    } else {
      state.sixStreak = 0;
    }

    if (state.sixStreak === 3) {
      state.message = `${player.name} rolled three 6s. Turn forfeited.`;
      state.sixStreak = 0;
      render();
      setTimeout(endTurn, 600);
      return;
    }

    const moves = movableTokens(state.current, state.dice);
    if (!moves.length) {
      state.message = `${player.name} rolled ${state.dice}. No valid move.`;
      render();
      setTimeout(endTurn, 600);
      return;
    }

    const chosen = aiSelectMove(state.current, moves, state.dice);
    state.message = `${player.name} rolled ${state.dice} and moved token ${chosen + 1}.`;
    state.movable = moves;
    render();

    setTimeout(() => {
      moveToken(state.current, chosen);
    }, 650);
  }, 700);
}

function onCanvasClick(event) {
  if (state.winner !== null) return;
  const currentPlayer = state.players[state.current];
  if (currentPlayer.isAI || state.dice === null || !state.movable.length) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  for (const item of clickableTokenPositions) {
    const dx = item.x - x;
    const dy = item.y - y;
    if (Math.sqrt(dx * dx + dy * dy) <= TOKEN_R + 8) {
      moveToken(state.current, item.token);
      return;
    }
  }
}

function newGame() {
  initState();
  render();
}

rollBtn.addEventListener("click", onRoll);
newBtn.addEventListener("click", newGame);
canvas.addEventListener("click", onCanvasClick);

newGame();

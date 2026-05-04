const defaultRows = 8;
const defaultCols = 8;
const minGrid = 4;
const maxGrid = 12;
const tileClasses = ["tile-ribbon", "tile-book", "tile-cup", "tile-lamp", "tile-yarn", "tile-ice"];
const sampleBoard = [
  [0, 1, 2, 3, 4, 5, 0, 1],
  [1, 2, 1, 4, 5, 0, 2, 3],
  [2, 1, 3, 5, 0, 1, 3, 4],
  [3, 4, 5, 0, 2, 3, 4, 5],
  [4, 5, 0, 2, 1, 4, 5, 0],
  [5, 0, 1, 3, 4, 5, 0, 2],
  [0, 2, 3, 4, 5, 0, 1, 3],
  [1, 3, 4, 5, 0, 2, 3, 4]
];

const state = {
  rows: defaultRows,
  cols: defaultCols,
  tool: "0",
  board: makeBoard(defaultRows, defaultCols),
  suggestion: null,
  matches: [],
  image: null,
  imageCanvas: null,
  crop: null
};

const boardEl = document.getElementById("board");
const bestMoveEl = document.getElementById("bestMove");
const bestReasonEl = document.getElementById("bestReason");
const moveListEl = document.getElementById("moveList");
const imageInput = document.getElementById("imageInput");
const anyFileInput = document.getElementById("anyFileInput");
const rowCountInput = document.getElementById("rowCount");
const colCountInput = document.getElementById("colCount");
const previewCanvas = document.getElementById("previewCanvas");
const previewCtx = previewCanvas.getContext("2d", { willReadFrequently: true });
const paletteButtons = [...document.querySelectorAll(".palette")];

function makeBoard(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

function setBoard(board) {
  state.rows = board.length;
  state.cols = board[0]?.length || defaultCols;
  state.board = board;
  state.suggestion = null;
  state.matches = [];
  renderBoard();
}

function renderBoard() {
  boardEl.innerHTML = "";
  boardEl.style.setProperty("--rows", state.rows);
  boardEl.style.setProperty("--cols", state.cols);
  rowCountInput.value = state.rows;
  colCountInput.value = state.cols;

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const value = state.board[row][col];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.dataset.row = row;
      button.dataset.col = col;
      button.setAttribute("aria-label", `${row + 1}행 ${col + 1}열`);

      if (value === null) {
        button.classList.add("empty");
      } else if (value === "x") {
        button.classList.add("blocked");
        button.textContent = "×";
      } else {
        const gem = document.createElement("span");
        gem.className = `gem gem-${value} ${tileClasses[value]}`;
        button.appendChild(gem);
      }

      if (state.suggestion) {
        const { from, to } = state.suggestion;
        if (from.row === row && from.col === col) {
          button.classList.add("suggest-from");
        }
        if (to.row === row && to.col === col) {
          button.classList.add("suggest-to");
        }
      }

      if (state.matches.some((cell) => cell.row === row && cell.col === col)) {
        button.classList.add("matched");
      }

      button.addEventListener("click", () => paintCell(row, col));
      boardEl.appendChild(button);
    }
  }
}

function paintCell(row, col) {
  state.board[row][col] = state.tool === "blank" ? null : normalizeValue(state.tool);
  state.suggestion = null;
  state.matches = [];
  renderBoard();
  updateEmptyResult("보정 완료", "수정된 보드를 기준으로 다시 해결 계산을 누르세요.");
}

function normalizeValue(value) {
  return value === "x" ? "x" : Number(value);
}

function setTool(tool) {
  state.tool = tool;
  paletteButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === tool);
  });
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function isGem(value) {
  return Number.isInteger(value) && value >= 0 && value <= 3;
}

function swap(board, from, to) {
  const next = cloneBoard(board);
  const temp = next[from.row][from.col];
  next[from.row][from.col] = next[to.row][to.col];
  next[to.row][to.col] = temp;
  return next;
}

function findMatches(board) {
  const rows = board.length;
  const cols = board[0]?.length || 0;
  const matches = new Set();

  for (let row = 0; row < rows; row += 1) {
    let runStart = 0;
    for (let col = 1; col <= cols; col += 1) {
      const runValue = board[row][runStart];
      if (col < cols && isGem(runValue) && board[row][col] === runValue) {
        continue;
      }
      if (isGem(runValue) && col - runStart >= 3) {
        for (let runCol = runStart; runCol < col; runCol += 1) {
          matches.add(`${row},${runCol}`);
        }
      }
      runStart = col;
    }
  }

  for (let col = 0; col < cols; col += 1) {
    let runStart = 0;
    for (let row = 1; row <= rows; row += 1) {
      const runValue = board[runStart][col];
      if (row < rows && isGem(runValue) && board[row][col] === runValue) {
        continue;
      }
      if (isGem(runValue) && row - runStart >= 3) {
        for (let runRow = runStart; runRow < row; runRow += 1) {
          matches.add(`${runRow},${col}`);
        }
      }
      runStart = row;
    }
  }

  return [...matches].map((key) => {
    const [row, col] = key.split(",").map(Number);
    return { row, col };
  });
}

function scoreMove(board, from, to) {
  if (!isGem(board[from.row][from.col]) || !isGem(board[to.row][to.col])) {
    return null;
  }
  if (board[from.row][from.col] === board[to.row][to.col]) {
    return null;
  }

  const swapped = swap(board, from, to);
  const matches = findMatches(swapped);
  if (!matches.length) {
    return null;
  }

  const touchesSwap = matches.some((cell) => (
    (cell.row === from.row && cell.col === from.col) ||
    (cell.row === to.row && cell.col === to.col)
  ));
  const lineBonus = longestLine(swapped, matches);
  const crossBonus = hasCross(matches) ? 18 : 0;
  const score = matches.length * 10 + lineBonus + crossBonus + (touchesSwap ? 4 : 0);

  return {
    from,
    to,
    matches,
    score,
    reason: buildReason(matches.length, lineBonus, crossBonus)
  };
}

function longestLine(board, matches) {
  const rows = board.length;
  const cols = board[0]?.length || 0;
  let longest = 0;
  matches.forEach(({ row, col }) => {
    const value = board[row][col];
    let horizontal = 1;
    let left = col - 1;
    while (left >= 0 && board[row][left] === value) {
      horizontal += 1;
      left -= 1;
    }
    let right = col + 1;
    while (right < cols && board[row][right] === value) {
      horizontal += 1;
      right += 1;
    }

    let vertical = 1;
    let up = row - 1;
    while (up >= 0 && board[up][col] === value) {
      vertical += 1;
      up -= 1;
    }
    let down = row + 1;
    while (down < rows && board[down][col] === value) {
      vertical += 1;
      down += 1;
    }

    longest = Math.max(longest, horizontal, vertical);
  });

  if (longest >= 5) {
    return 35;
  }
  if (longest === 4) {
    return 16;
  }
  return 0;
}

function hasCross(matches) {
  const byRow = new Map();
  const byCol = new Map();
  matches.forEach(({ row, col }) => {
    byRow.set(row, (byRow.get(row) || 0) + 1);
    byCol.set(col, (byCol.get(col) || 0) + 1);
  });
  return [...byRow.values()].some((count) => count >= 3) &&
    [...byCol.values()].some((count) => count >= 3);
}

function buildReason(count, lineBonus, crossBonus) {
  if (lineBonus >= 35) {
    return `${count}개 제거, 5칸 연결 가능성이 높습니다.`;
  }
  if (crossBonus) {
    return `${count}개 제거, 교차 매치라 특수 타일 후보입니다.`;
  }
  if (lineBonus) {
    return `${count}개 제거, 4칸 매치 후보입니다.`;
  }
  return `${count}개 제거가 예상됩니다.`;
}

function solveBoard() {
  const candidates = [];
  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const from = { row, col };
      const right = col + 1 < state.cols ? { row, col: col + 1 } : null;
      const down = row + 1 < state.rows ? { row: row + 1, col } : null;
      [right, down].filter(Boolean).forEach((to) => {
        const result = scoreMove(state.board, from, to);
        if (result) {
          candidates.push(result);
        }
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  state.suggestion = candidates[0] || null;
  state.matches = candidates[0]?.matches || [];
  renderBoard();
  renderResults(candidates);
}

function renderResults(candidates) {
  moveListEl.innerHTML = "";
  if (!candidates.length) {
    bestMoveEl.textContent = "가능한 매치가 없습니다";
    bestReasonEl.textContent = "인식 결과가 틀렸거나 현재 보드에서 유효한 교환을 찾지 못했습니다.";
    return;
  }

  const best = candidates[0];
  bestMoveEl.textContent = formatMove(best);
  bestReasonEl.textContent = best.reason;

  candidates.slice(0, 5).forEach((candidate) => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    const desc = document.createElement("span");
    title.textContent = formatMove(candidate);
    desc.textContent = `${candidate.reason} 점수 ${candidate.score}`;
    item.append(title, desc);
    moveListEl.appendChild(item);
  });
}

function formatMove(move) {
  return `${formatCell(move.from)} ↔ ${formatCell(move.to)}`;
}

function formatCell(cell) {
  return `${cell.row + 1}행 ${cell.col + 1}열`;
}

function updateEmptyResult(title = "해결 계산을 누르세요", text = "인식된 보드를 기준으로 모든 인접 교환을 시뮬레이션합니다.") {
  bestMoveEl.textContent = title;
  bestReasonEl.textContent = text;
  moveListEl.innerHTML = "";
}

function resetBoard() {
  setBoard(makeBoard(defaultRows, defaultCols));
  state.crop = null;
  drawPreview();
  updateEmptyResult("초기화 완료", "스크린샷을 다시 선택하거나 예시 보드를 불러오세요.");
}

function fillSampleBoard() {
  setBoard(cloneBoard(sampleBoard));
  updateEmptyResult("예시 보드 준비", "해결 계산을 누르면 추천 이동을 확인할 수 있습니다.");
}

async function loadImage(file) {
  if (!file) {
    return;
  }
  updateEmptyResult("이미지 읽는 중", "사진첩에서 선택한 스크린샷을 불러오고 있습니다.");
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    state.image = image;
    state.imageCanvas = imageToCanvas(image);
    recognizeFromImage();
  };
  image.onerror = async () => {
    URL.revokeObjectURL(url);
    try {
      const bitmap = await createImageBitmap(file);
      state.image = bitmap;
      state.imageCanvas = bitmapToCanvas(bitmap);
      recognizeFromImage();
    } catch (error) {
      updateEmptyResult(
        "이미지를 읽지 못했습니다",
        "스크린샷을 PNG 또는 JPG로 저장한 뒤 다시 선택하세요. 일부 HEIC 이미지는 브라우저에서 열리지 않을 수 있습니다."
      );
    }
  };
  image.src = url;
}

function imageToCanvas(image) {
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function bitmapToCanvas(bitmap) {
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function recognizeFromImage() {
  if (!state.imageCanvas) {
    updateEmptyResult("스크린샷이 없습니다", "먼저 게임 화면 스크린샷을 선택하세요.");
    return;
  }

  const crop = detectBoardCrop(state.imageCanvas);
  const candidates = [];
  for (let rows = minGrid; rows <= maxGrid; rows += 1) {
    for (let cols = minGrid; cols <= maxGrid; cols += 1) {
      candidates.push(evaluateGrid(state.imageCanvas, crop, rows, cols));
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];
  state.crop = best.crop;
  setBoard(best.board);
  drawPreview(best);
  updateEmptyResult(
    `${best.rows}행 ${best.cols}열 자동 인식`,
    `평균 신뢰도 ${Math.round(best.confidence)}점입니다. 틀린 칸만 보정한 뒤 해결 계산을 누르세요.`
  );
}

function recognizeFixedGrid() {
  if (!state.imageCanvas) {
    updateEmptyResult("스크린샷이 없습니다", "먼저 게임 화면 스크린샷을 선택하세요.");
    return;
  }
  const rows = clamp(Math.round(Number(rowCountInput.value) || defaultRows), minGrid, maxGrid);
  const cols = clamp(Math.round(Number(colCountInput.value) || defaultCols), minGrid, maxGrid);
  const crop = state.crop || detectBoardCrop(state.imageCanvas);
  const result = evaluateGrid(state.imageCanvas, crop, rows, cols);
  state.crop = result.crop;
  setBoard(result.board);
  drawPreview(result);
  updateEmptyResult(
    `${rows}행 ${cols}열로 재인식`,
    "게임판 크기가 맞으면 해결 계산을 누르세요. 틀린 칸은 색상 도구로 보정할 수 있습니다."
  );
}

function detectBoardCrop(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const leftLimit = Math.floor(width * 0.16);
  const rightLimit = Math.floor(width * 0.86);
  const topLimit = Math.floor(height * 0.02);
  const bottomLimit = Math.floor(height * 0.97);
  const points = [];
  const xDensity = new Array(width).fill(0);
  const yDensity = new Array(height).fill(0);

  for (let y = topLimit; y < bottomLimit; y += 3) {
    for (let x = leftLimit; x < rightLimit; x += 3) {
      const index = (y * width + x) * 4;
      if (isLikelyTilePixel(data[index], data[index + 1], data[index + 2])) {
        points.push({ x, y });
        xDensity[x] += 1;
        yDensity[y] += 1;
      }
    }
  }

  if (points.length < 200) {
    const side = Math.min(width, height) * 0.78;
    return {
      x: (width - side) / 2,
      y: (height - side) * 0.58,
      width: side,
      height: side
    };
  }

  const xRange = denseRange(xDensity, leftLimit, rightLimit, width * 0.18, width * 0.53);
  const yRange = denseRange(yDensity, topLimit, bottomLimit, height * 0.22, height * 0.48);
  const xs = points
    .filter((point) => point.x >= xRange.start && point.x <= xRange.end)
    .map((point) => point.x)
    .sort((a, b) => a - b);
  const ys = points
    .filter((point) => point.y >= yRange.start && point.y <= yRange.end)
    .map((point) => point.y)
    .sort((a, b) => a - b);
  const minX = xs.length ? percentile(xs, 0.01) : xRange.start;
  const maxX = xs.length ? percentile(xs, 0.99) : xRange.end;
  const minY = ys.length ? percentile(ys, 0.01) : yRange.start;
  const maxY = ys.length ? percentile(ys, 0.99) : yRange.end;
  const padX = (maxX - minX) * 0.035;
  const padY = (maxY - minY) * 0.055;
  return {
    x: clamp(minX - padX, 0, width - 1),
    y: clamp(minY - padY, 0, height - 1),
    width: clamp(maxX - minX + padX * 2, 40, width),
    height: clamp(maxY - minY + padY * 2, 40, height)
  };
}

function denseRange(density, start, end, minLength, preferredCenter) {
  const smoothed = smoothDensity(density, 25);
  let max = 0;
  for (let index = start; index < end; index += 1) {
    max = Math.max(max, smoothed[index]);
  }
  const threshold = max * 0.18;
  const ranges = [];
  let rangeStart = null;
  for (let index = start; index < end; index += 1) {
    if (smoothed[index] >= threshold) {
      if (rangeStart === null) {
        rangeStart = index;
      }
    } else if (rangeStart !== null) {
      ranges.push({ start: rangeStart, end: index - 1 });
      rangeStart = null;
    }
  }
  if (rangeStart !== null) {
    ranges.push({ start: rangeStart, end: end - 1 });
  }

  const viable = ranges.filter((range) => range.end - range.start >= minLength);
  const candidates = viable.length ? viable : ranges;
  if (!candidates.length) {
    return { start, end };
  }

  let best = candidates[0];
  let bestScore = -Infinity;
  candidates.forEach((range) => {
    const center = (range.start + range.end) / 2;
    const length = range.end - range.start;
    let mass = 0;
    for (let index = range.start; index <= range.end; index += 1) {
      mass += smoothed[index];
    }
    const score = mass + length * 4 - Math.abs(center - preferredCenter) * 8;
    if (score > bestScore) {
      best = range;
      bestScore = score;
    }
  });
  return best;
}

function smoothDensity(values, radius) {
  const result = new Array(values.length).fill(0);
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index];
    if (index - radius - 1 >= 0) {
      sum -= values[index - radius - 1];
    }
    result[index] = sum;
  }
  return result;
}

function isLikelyTilePixel(r, g, b) {
  const hsl = rgbToHsl(r, g, b);
  if (hsl.s < 0.42 || hsl.l < 0.24 || hsl.l > 0.86) {
    return false;
  }
  return (
    hsl.h < 25 ||
    hsl.h >= 330 ||
    (hsl.h >= 28 && hsl.h <= 72) ||
    (hsl.h >= 82 && hsl.h <= 155) ||
    (hsl.h >= 158 && hsl.h <= 190) ||
    (hsl.h >= 195 && hsl.h <= 245)
  );
}

function percentile(values, ratio) {
  if (!values.length) {
    return 0;
  }
  const index = clamp(Math.floor(values.length * ratio), 0, values.length - 1);
  return values[index];
}

function evaluateGrid(canvas, crop, rows, cols) {
  const aspect = crop.width / crop.height;
  const gridAspect = cols / rows;
  const aspectPenalty = Math.abs(Math.log(aspect / gridAspect)) * 70;
  const width = crop.width;
  const height = crop.height;
  const adjustedCrop = {
    x: crop.x,
    y: crop.y,
    width,
    height
  };

  const board = [];
  let confidenceTotal = 0;
  let usable = 0;
  let edgePenalty = 0;
  for (let row = 0; row < rows; row += 1) {
    board[row] = [];
    for (let col = 0; col < cols; col += 1) {
      const sample = sampleCell(canvas, adjustedCrop, rows, cols, row, col);
      board[row][col] = sample.value;
      confidenceTotal += sample.confidence;
      if (isGem(sample.value)) {
        usable += 1;
      } else {
        edgePenalty += 0.6;
      }
    }
  }

  const fillRatio = usable / (rows * cols);
  const densityPenalty = Math.abs(rows * cols - usable) * 0.18;
  const matchPotential = findMatches(board).length * 0.25;
  const confidence = confidenceTotal / (rows * cols) + fillRatio * 16 + matchPotential - aspectPenalty - densityPenalty - edgePenalty;
  return {
    rows,
    cols,
    board,
    crop: adjustedCrop,
    confidence
  };
}

function sampleCell(canvas, crop, rows, cols, row, col) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const cellW = crop.width / cols;
  const cellH = crop.height / rows;
  const sampleW = Math.max(2, Math.floor(cellW * 0.46));
  const sampleH = Math.max(2, Math.floor(cellH * 0.46));
  const startX = Math.round(crop.x + col * cellW + cellW * 0.5 - sampleW / 2);
  const startY = Math.round(crop.y + row * cellH + cellH * 0.5 - sampleH / 2);
  const safeX = clamp(startX, 0, canvas.width - sampleW);
  const safeY = clamp(startY, 0, canvas.height - sampleH);
  const pixels = ctx.getImageData(safeX, safeY, sampleW, sampleH).data;
  const votes = new Map();
  let bestColor = { value: null, confidence: 0 };

  for (let i = 0; i < pixels.length; i += 4) {
    const classified = classifyColor(pixels[i], pixels[i + 1], pixels[i + 2]);
    const key = String(classified.value);
    votes.set(key, (votes.get(key) || 0) + classified.confidence);
    if (classified.confidence > bestColor.confidence) {
      bestColor = classified;
    }
  }

  let winner = { key: String(bestColor.value), score: 0 };
  votes.forEach((score, key) => {
    if (score > winner.score) {
      winner = { key, score };
    }
  });

  const value = winner.key === "null" ? null : winner.key === "x" ? "x" : Number(winner.key);
  const confidence = clamp(winner.score / Math.max(1, pixels.length / 4), 18, 100);
  return { value, confidence };
}

function classifyColor(r, g, b) {
  const hsl = rgbToHsl(r, g, b);
  if (hsl.l < 0.18) {
    return { value: "x", confidence: 42 };
  }
  if (hsl.s < 0.18 || hsl.l > 0.9) {
    return { value: null, confidence: 26 };
  }

  let value = 0;
  if (hsl.h >= 20 && hsl.h < 62 && hsl.s < 0.5 && hsl.l > 0.42) {
    value = 4;
  } else if (hsl.h >= 25 && hsl.h < 72) {
    value = 3;
  } else if (hsl.h >= 72 && hsl.h < 155) {
    value = 2;
  } else if (hsl.h >= 155 && hsl.h < 215 && hsl.l > 0.52) {
    value = 5;
  } else if (hsl.h >= 190 && hsl.h < 245) {
    value = 1;
  } else if (hsl.h >= 245 && hsl.h < 326) {
    value = 5;
  }

  const centerHue = [0, 218, 114, 48, 38, 188][value];
  const hueDistance = Math.min(Math.abs(hsl.h - centerHue), 360 - Math.abs(hsl.h - centerHue));
  const confidence = clamp(92 - hueDistance * 1.15 + hsl.s * 20 + colorDominance(r, g, b) * 16, 18, 100);
  return { value, confidence };
}

function colorDominance(r, g, b) {
  const values = [r, g, b].sort((a, b) => b - a);
  return (values[0] - values[1]) / 255;
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) {
      h = (gn - bn) / d + (gn < bn ? 6 : 0);
    } else if (max === gn) {
      h = (bn - rn) / d + 2;
    } else {
      h = (rn - gn) / d + 4;
    }
    h *= 60;
  }

  return { h, s, l };
}

function drawPreview(result = null) {
  if (!state.imageCanvas) {
    previewCanvas.classList.remove("ready");
    return;
  }

  const source = state.imageCanvas;
  const scale = Math.min(1, 520 / source.width, 320 / source.height);
  previewCanvas.width = Math.round(source.width * scale);
  previewCanvas.height = Math.round(source.height * scale);
  previewCanvas.classList.add("ready");
  previewCtx.drawImage(source, 0, 0, previewCanvas.width, previewCanvas.height);

  const crop = result?.crop || state.crop;
  if (!crop) {
    return;
  }

  previewCtx.save();
  previewCtx.scale(scale, scale);
  previewCtx.strokeStyle = "#f0b84d";
  previewCtx.lineWidth = 4 / scale;
  previewCtx.strokeRect(crop.x, crop.y, crop.width, crop.height);

  const rows = result?.rows || state.rows;
  const cols = result?.cols || state.cols;
  previewCtx.strokeStyle = "rgba(255,255,255,0.75)";
  previewCtx.lineWidth = 1 / scale;
  for (let row = 1; row < rows; row += 1) {
    const y = crop.y + crop.height * row / rows;
    previewCtx.beginPath();
    previewCtx.moveTo(crop.x, y);
    previewCtx.lineTo(crop.x + crop.width, y);
    previewCtx.stroke();
  }
  for (let col = 1; col < cols; col += 1) {
    const x = crop.x + crop.width * col / cols;
    previewCtx.beginPath();
    previewCtx.moveTo(x, crop.y);
    previewCtx.lineTo(x, crop.y + crop.height);
    previewCtx.stroke();
  }
  previewCtx.restore();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

paletteButtons.forEach((button) => {
  button.addEventListener("click", () => setTool(button.dataset.tool));
});

imageInput.addEventListener("change", () => loadImage(imageInput.files[0]));
anyFileInput.addEventListener("change", () => loadImage(anyFileInput.files[0]));
document.getElementById("recognizeBoard").addEventListener("click", recognizeFromImage);
document.getElementById("recognizeFixedGrid").addEventListener("click", recognizeFixedGrid);
document.getElementById("resetBoard").addEventListener("click", resetBoard);
document.getElementById("fillSample").addEventListener("click", fillSampleBoard);
document.getElementById("solveBoard").addEventListener("click", solveBoard);

renderBoard();

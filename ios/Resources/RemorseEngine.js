var RemorseEngine = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name2 in all)
      __defProp(target, name2, { get: all[name2], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key2 of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key2) && key2 !== except)
          __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // outputs/RemorseChess/Engine/bridge.ts
  var bridge_exports = {};
  __export(bridge_exports, {
    request: () => request
  });

  // outputs/RemorseChess/Engine/rules.ts
  var CURRENT_RULES = 3;
  var bonusIsRequired = (version) => version >= 3;
  var opposite = (side) => side === "white" ? "black" : "white";
  var file = (square) => square % 8;
  var rank = (square) => Math.floor(square / 8);
  var name = (square) => "abcdefgh"[file(square)] + (rank(square) + 1);
  var boards = /* @__PURE__ */ new WeakMap();
  function squares(game) {
    let board = boards.get(game.pieces);
    if (!board) {
      board = new Array(64);
      for (const p of game.pieces) board[p.square] = p;
      boards.set(game.pieces, board);
    }
    return board;
  }
  var at = (game, square) => squares(game)[square];
  var canCapture = (p) => p.mood !== "devastated" && p.mood !== "guilty";
  var promotions = ["q", "r", "b", "n"];
  function initial(rulesVersion = CURRENT_RULES) {
    const game = { rulesVersion, pieces: [], side: "white", bonus: null, turn: 1, ep: null, nextEp: null, quiet: 0, irreversible: false, seen: {}, result: null };
    const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
    for (const side of ["white", "black"]) {
      for (let column = 0; column < 8; column++) {
        for (const [kind, row] of [[back[column], side === "white" ? 0 : 7], ["p", side === "white" ? 1 : 6]]) {
          game.pieces.push({ id: game.pieces.length, side, kind, square: row * 8 + column, mood: "normal", roll: 0, kills: 0, rescue: 0, moved: false });
        }
      }
    }
    game.seen[key(game)] = 1;
    return game;
  }
  function geometry(game, p, to, capture) {
    const dx = file(to) - file(p.square), dy = rank(to) - rank(p.square);
    const x = Math.abs(dx), y = Math.abs(dy);
    if (!x && !y) return false;
    switch (p.kind) {
      case "k":
        return x <= 1 && y <= 1;
      case "n":
        return x * y === 2;
      case "p": {
        const step = p.side === "white" ? 1 : -1;
        if (capture) return x === 1 && dy === step;
        return !x && (dy === step || dy === 2 * step && !p.moved && rank(p.square) === (step === 1 ? 1 : 6) && !at(game, p.square + step * 8));
      }
      case "b":
        if (x !== y) return false;
        break;
      case "r":
        if (x && y) return false;
        break;
      case "q":
        if (x && y && x !== y) return false;
        break;
    }
    const stride = Math.sign(dx) + 8 * Math.sign(dy);
    for (let square = p.square + stride; square !== to; square += stride) if (at(game, square)) return false;
    return true;
  }
  function attacked(game, square, by) {
    return game.pieces.some((p) => p.side === by && (p.kind === "k" || canCapture(p)) && geometry(game, p, square, true));
  }
  function inCheck(game, side) {
    const king = game.pieces.find((p) => p.side === side && p.kind === "k");
    return !king || attacked(game, king.square, opposite(side));
  }
  function victim(game, p, to) {
    const occupant = at(game, to);
    if (occupant) return occupant;
    if (p.kind !== "p" || game.ep?.target !== to || !geometry(game, p, to, true)) return;
    return game.pieces.find((v) => v.kind === "p" && v.side !== p.side && v.id === game.ep?.pawn && v.square === game.ep.square);
  }
  function castle(game, king, to) {
    const start = king.side === "white" ? 4 : 60;
    const offset = to - start;
    if (king.kind !== "k" || king.square !== start || king.moved || Math.abs(offset) !== 2 || game.bonus !== null || inCheck(game, king.side)) return;
    const rook = at(game, start + (offset > 0 ? 3 : -4));
    if (!rook || rook.kind !== "r" || rook.side !== king.side || rook.moved || ["devastated", "bloodlust"].includes(rook.mood)) return;
    const step = Math.sign(offset);
    for (let square = start + step; square !== rook.square; square += step) if (at(game, square)) return;
    const intermediate = { ...game, pieces: game.pieces.map((p) => p.id === king.id ? { ...p, square: start + step } : p) };
    if (!inCheck(intermediate, king.side)) return rook;
  }
  function applyBoard(game, action, p, taken, rook) {
    const pieces = game.pieces.filter((piece) => piece.id !== taken?.id).map((piece) => {
      if (action.type === "absolve" && piece.square === action.to) return { ...piece, mood: "normal", rescue: 0 };
      if (action.type === "move" && piece.id === p.id) return { ...piece, square: action.to, moved: true, kind: action.promotion ?? piece.kind };
      if (rook && piece.id === rook.id) return { ...piece, square: (action.to + action.from) / 2, moved: true };
      return piece;
    });
    return { ...game, pieces };
  }
  function preview(game, action) {
    if (game.result) return;
    if (action.type === "end") return game.bonus !== null && !bonusIsRequired(game.rulesVersion) ? { next: game } : void 0;
    if (!Number.isInteger(action.from) || !Number.isInteger(action.to) || action.to < 0 || action.to > 63) return;
    const p = at(game, action.from);
    if (!p || p.side !== game.side || p.mood === "devastated" || game.bonus !== null && p.id !== game.bonus) return;
    let taken, rook;
    if (action.type === "absolve") {
      const target = at(game, action.to);
      if (game.bonus !== null || p.kind !== "b" || p.mood === "bloodlust" || !target || target.side !== p.side || target.id === p.id || !["guilty", "devastated"].includes(target.mood) || Math.abs(rank(p.square) - rank(target.square)) > 1 || Math.abs(file(p.square) - file(target.square)) > 1) return;
    } else {
      taken = victim(game, p, action.to);
      if (taken?.kind === "k" && (game.rulesVersion === 1 || game.bonus !== p.id || taken.side === p.side)) return;
      if (taken && (!canCapture(p) || taken.side === p.side && p.mood !== "bloodlust") || !taken && p.mood === "bloodlust") return;
      if (!taken && p.kind === "k" && Math.abs(action.from - action.to) === 2) {
        rook = castle(game, p, action.to);
        if (!rook) return;
      } else if (!geometry(game, p, action.to, Boolean(taken))) return;
      const promotes = p.kind === "p" && rank(action.to) === (p.side === "white" ? 7 : 0);
      if (promotes ? !promotions.includes(action.promotion) : action.promotion !== void 0) return;
    }
    const next = applyBoard(game, action, p, taken, rook);
    if (!inCheck(next, game.side)) return { next, actor: p, taken };
  }
  var directions = {
    n: [[-1, -2], [1, -2], [-2, -1], [2, -1], [-2, 1], [2, 1], [-1, 2], [1, 2]],
    r: [[-1, 0], [1, 0], [0, -1], [0, 1]],
    b: [[-1, -1], [-1, 1], [1, -1], [1, 1]]
  };
  var allDirections = [...directions.r, ...directions.b];
  function* moveTargets(game, p) {
    const x = file(p.square), y = rank(p.square);
    const valid = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
    const single = p.kind === "n" || p.kind === "k";
    if (p.kind === "p") {
      const forward = p.side === "white" ? 1 : -1;
      for (const step of [1, 2]) if (valid(x, y + step * forward)) yield (y + step * forward) * 8 + x;
      for (const dx of [-1, 1]) if (valid(x + dx, y + forward)) yield (y + forward) * 8 + x + dx;
      return;
    }
    const lines = p.kind === "q" || p.kind === "k" ? allDirections : directions[p.kind];
    for (const [dx, dy] of lines) {
      for (let step = 1; valid(x + dx * step, y + dy * step); step++) {
        const target = (y + dy * step) * 8 + x + dx * step;
        yield target;
        if (single || at(game, target)) break;
      }
    }
    if (p.kind === "k" && !p.moved && x === 4) {
      yield p.square - 2;
      yield p.square + 2;
    }
  }
  function* legalActions(game, only) {
    if (game.result) return;
    if (game.bonus !== null && only === void 0 && !bonusIsRequired(game.rulesVersion)) yield { type: "end" };
    for (const p of game.pieces) {
      if (p.side !== game.side || p.mood === "devastated" || only !== void 0 && p.square !== only || game.bonus !== null && game.bonus !== p.id) continue;
      for (const to of moveTargets(game, p)) {
        const kinds = p.kind === "p" && (rank(to) === 0 || rank(to) === 7) ? promotions : [void 0];
        for (const promotion of kinds) {
          const action = promotion ? { type: "move", from: p.square, to, promotion } : { type: "move", from: p.square, to };
          if (preview(game, action)) yield action;
        }
      }
      if (p.kind === "b" && game.bonus === null && p.mood !== "bloodlust") {
        for (const target of game.pieces) {
          if (target.side !== p.side || target.mood !== "devastated" && target.mood !== "guilty") continue;
          const action = { type: "absolve", from: p.square, to: target.square };
          if (preview(game, action)) yield action;
        }
      }
    }
  }
  var legal = (game, only) => [...legalActions(game, only)];
  var hasLegal = (game, only) => !legalActions(game, only).next().done;
  function captureTarget(game, action) {
    if (action.type !== "move") return;
    const actor = at(game, action.from);
    if (actor) return victim(game, actor, action.to);
  }
  function key(game) {
    const rights = [4, 60].map((square) => {
      const king = at(game, square);
      return king?.kind === "k" && !king.moved ? [square - 4, square + 3].map((r) => {
        const rook = at(game, r);
        return rook?.kind === "r" && rook.side === king.side && !rook.moved ? 1 : 0;
      }).join("") : "00";
    }).join("");
    const ep = game.ep;
    const epKey = ep && game.pieces.some((p) => p.side === game.side && p.kind === "p" && !at(game, ep.target) && preview(game, { type: "move", from: p.square, to: ep.target })) ? ep.target : "-";
    const board = game.pieces.slice().sort((a, b) => a.square - b.square).map(
      (p) => [
        p.square,
        p.side[0],
        p.kind,
        p.mood,
        Number(Boolean(p.roll)),
        p.mood === "psychopath" ? p.kills : 0,
        p.rescue,
        p.kind === "p" && rank(p.square) === (p.side === "white" ? 1 : 6) ? Number(p.moved) : 0
      ].join("/")
    );
    return [game.side, rights, epKey, ...board].join("|");
  }
  function rollDie() {
    const value = new Uint8Array(1);
    do
      crypto.getRandomValues(value);
    while (value[0] >= 252);
    return value[0] % 6 + 1;
  }
  function play(game, action, die = rollDie) {
    const validated = preview(game, action);
    if (!validated) return;
    const { actor, taken } = validated;
    const next = { ...validated.next };
    const event = { turn: game.turn, side: game.side, action, text: "Bonus declined", vanished: [] };
    let newlyDevastated;
    if (action.type === "absolve") {
      event.text = "B" + name(action.from) + " absolves " + name(action.to);
      next.irreversible = true;
    }
    if (action.type === "move" && actor) {
      event.text = (actor.kind === "p" ? "" : actor.kind.toUpperCase()) + name(action.from) + (taken ? "\xD7" : "\u2013") + name(action.to) + (action.promotion ? "=" + action.promotion.toUpperCase() : "");
      next.irreversible ||= actor.kind === "p" || Boolean(taken);
      if (actor.kind === "p" && Math.abs(action.to - action.from) === 16) {
        next.nextEp = { pawn: actor.id, square: action.to, target: (action.from + action.to) / 2 };
      } else if (actor.id === next.nextEp?.pawn) next.nextEp = null;
      if (taken) {
        event.capture = taken;
        const moved = { ...next.pieces.find((p) => p.id === actor.id) };
        moved.kills++;
        if (!moved.roll) {
          const roll = die();
          if (!Number.isInteger(roll) || roll < 1 || roll > 6) throw new Error("Invalid die result");
          moved.roll = event.roll = roll;
          moved.mood = roll === 1 ? "devastated" : roll < 4 ? "guilty" : roll === 6 ? "psychopath" : "normal";
          if (roll === 1) {
            moved.rescue = 3;
            newlyDevastated = moved.id;
          }
          event.mood = moved.mood;
        }
        if (moved.mood === "psychopath" && moved.kills >= 3) {
          moved.mood = "bloodlust";
          event.mood = moved.mood;
        }
        event.captureState = { mood: moved.mood, originalRoll: moved.roll, kills: moved.kills };
        next.pieces = next.pieces.map((p) => p.id === moved.id ? moved : p);
        if (taken.kind === "k") {
          next.bonus = null;
          next.result = { winner: game.side, reason: "King captured on bonus move" };
          event.text += "#";
          return { game: next, event };
        }
        if (game.bonus === null && (moved.mood === "psychopath" || moved.mood === "bloodlust")) {
          next.bonus = moved.id;
          if (hasLegal(next, moved.square)) return { game: next, event };
        }
      }
    }
    next.bonus = null;
    next.pieces = next.pieces.flatMap((p) => {
      if (p.side !== game.side || p.mood !== "devastated" || p.id === newlyDevastated) return [p];
      if (p.rescue > 1) return [{ ...p, rescue: p.rescue - 1 }];
      event.vanished.push(p);
      return [];
    });
    if (event.vanished.some((p) => p.kind === "k")) next.result = { winner: opposite(game.side), reason: "King lost to remorse" };
    else if (inCheck(next, game.side)) next.result = { winner: opposite(game.side), reason: "King exposed by remorse" };
    next.side = opposite(game.side);
    next.turn++;
    next.ep = next.nextEp;
    next.nextEp = null;
    next.quiet = next.irreversible || event.vanished.length ? 0 : next.quiet + 1;
    next.irreversible = false;
    if (!next.result) {
      const check = inCheck(next, next.side);
      if (!hasLegal(next)) next.result = check ? { winner: game.side, reason: "Checkmate" } : { winner: null, reason: "Stalemate" };
      else if (next.pieces.length === 2 && next.pieces.every((p) => p.kind === "k" && p.mood !== "devastated")) next.result = { winner: null, reason: "Bare kings" };
      else {
        const position2 = key(next);
        next.seen = { ...next.seen, [position2]: (next.seen[position2] ?? 0) + 1 };
        if (next.seen[position2] >= 3) next.result = { winner: null, reason: "Threefold repetition" };
        else if (next.quiet >= 100) next.result = { winner: null, reason: "50-move rule" };
      }
      if (check) event.text += next.result?.reason === "Checkmate" ? "#" : "+";
    }
    return { game: next, event };
  }

  // outputs/RemorseChess/Engine/bot-features.ts
  var prior = [
    100,
    315,
    335,
    505,
    935,
    // material
    -23,
    -60,
    38,
    -36,
    15,
    -9,
    // conditions, rescues and psychopath threshold
    5,
    5,
    13,
    29,
    12,
    8,
    // piece placement, development and pawn structure
    24,
    -85,
    -10,
    -26,
    9,
    39
    // king safety, tempo and bonus phase
  ];
  var unit = { p: 1, n: 3.15, b: 3.35, r: 5.05, q: 9.35, k: 0 };
  var material = { p: 0, n: 1, b: 2, r: 3, q: 4, k: 0 };
  var knightSteps = [[-1, -2], [1, -2], [-2, -1], [2, -1], [-2, 1], [2, 1], [-1, 2], [1, 2]];
  function features(game) {
    const vector = new Float64Array(prior.length);
    const board = squares(game);
    const pawns = { white: Array.from({ length: 8 }, () => []), black: Array.from({ length: 8 }, () => []) };
    const bishops = { white: [], black: [] };
    for (const p of game.pieces) {
      if (p.kind === "p") pawns[p.side][file(p.square)].push(p.side === "white" ? rank(p.square) : 7 - rank(p.square));
      if (p.kind === "b" && p.mood !== "devastated" && p.mood !== "bloodlust") bishops[p.side].push(p.square);
    }
    for (const p of game.pieces) {
      const sign = p.side === "white" ? 1 : -1;
      const other = p.side === "white" ? "black" : "white";
      const x = file(p.square), y = rank(p.square);
      const advancement = p.side === "white" ? y : 7 - y;
      const center = 3.5 - Math.abs(x - 3.5) + 3.5 - Math.abs(y - 3.5);
      const value = unit[p.kind];
      const rescue = () => bishops[p.side].some((s) => s !== p.square && Math.abs(file(s) - x) <= 1 && Math.abs(rank(s) - y) <= 1);
      if (p.kind !== "k") vector[material[p.kind]] += sign;
      if (p.mood === "guilty") {
        vector[5] += sign * value;
        if (rescue()) vector[9] += sign * value;
      }
      if (p.mood === "devastated") {
        vector[6] += sign * value * (1.15 - 0.1 * p.rescue);
        if (rescue()) vector[9] += sign * value;
      }
      if (p.mood === "psychopath") {
        vector[7] += sign * value;
        if (p.kills >= 2) vector[10] += sign * value;
      }
      if (p.mood === "bloodlust") vector[8] += sign * value;
      const usable = p.mood === "devastated" ? 0 : p.mood === "bloodlust" ? 0.3 : 1;
      if (p.kind === "n" || p.kind === "b") vector[11] += sign * usable * (center - 2);
      if (p.kind === "p") {
        vector[12] += sign * usable * advancement;
        const enemyFiles = pawns[other].slice(Math.max(0, x - 1), Math.min(8, x + 2));
        if (advancement >= 3 && enemyFiles.every((rows) => rows.every((row) => 7 - row <= advancement))) vector[14] += sign * usable * (advancement - 2);
        if (!pawns[p.side][x - 1]?.length && !pawns[p.side][x + 1]?.length) vector[19] += sign;
      }
      if ((p.kind === "n" || p.kind === "b") && p.moved) vector[13] += sign * usable;
      if (p.kind === "r" && !pawns[p.side][x].length) vector[15] += sign * usable;
      if (p.kind === "n" && usable) {
        for (const [dx, dy] of knightSteps) {
          if (x + dx < 0 || x + dx > 7 || y + dy < 0 || y + dy > 7) continue;
          const target = board[(y + dy) * 8 + x + dx];
          if (!target || target.side !== p.side) vector[16] += sign * usable;
        }
      }
      if (p.kind === "k") {
        if (p.moved && (x === 2 || x === 6) && advancement <= 1) vector[17] += sign;
        if (p.rescue) vector[18] += sign * (rescue() ? 2 : 12 / p.rescue);
        if (inCheck(game, p.side)) vector[20] += sign * 4;
        if (game.pieces.length < 12) vector[20] -= sign * center * 0.1;
      }
    }
    vector[21] = game.side === "white" ? 1 : -1;
    vector[22] = game.bonus === null ? 0 : vector[21];
    return vector;
  }
  function valueOf(game, side, weights) {
    if (game.result) return game.result.winner === null ? 0 : game.result.winner === side ? 25e3 : -25e3;
    const values = features(game);
    let score = 0;
    for (let i = 0; i < values.length; i++) score += values[i] * weights[i];
    return side === "white" ? score : -score;
  }

  // outputs/RemorseChess/Engine/bot-model.ts
  var trainedWeights = [73, 267.68, 301.23, 426.01, 853.97, -43, -56.4, 29.59, -42.69, 29.26, -13.84, 1.25, 6.07, 3.25, 48.17, 3, 2, 6, -126.96, -5.68, -6.5, 29, 56.45];

  // outputs/RemorseChess/Engine/bot-levels.ts
  var difficulties = {
    rookie: { name: "Rookie", description: "Looks ahead and occasionally misses a tactic.", depth: 1, beam: 3, roots: 12, budget: 900, mistake: 0.15 },
    tactical: { name: "Tactician", description: "Searches replies, likely recaptures, and bishop rescues.", depth: 2, beam: 5, roots: 15, budget: 5200, mistake: 0 },
    expert: { name: "Grandmaster", description: "Searches more replies and extends forcing captures and bonus turns.", depth: 3, beam: 6, roots: 18, budget: 16e3, mistake: 0 },
    ranked: { name: "Ranked", description: "Searches wider and deeper, including forcing captures and bonus turns.", depth: 4, beam: 8, roots: 24, budget: 46e3, mistake: 0 }
  };

  // outputs/RemorseChess/Engine/bot.ts
  var outcomes = [[1, 1], [2, 2], [4, 2], [6, 1]];
  var material2 = { p: 100, n: 320, b: 335, r: 510, q: 950, k: 25e3 };
  var win = 25e3;
  function statically(game, side, weights) {
    if (game.bonus !== null && game.rulesVersion >= 2 && inCheck(game, game.side === "white" ? "black" : "white")) {
      const kingCapture = legal(game).some((action) => captureTarget(game, action)?.kind === "k");
      if (kingCapture) return game.side === side ? win : -win;
    }
    return valueOf(game, side, weights);
  }
  function order(game, action) {
    if (action.type === "end") return 0;
    if (action.type === "absolve") {
      const p = at(game, action.to);
      return p.kind === "k" ? 2500 : material2[p.kind] * (p.rescue === 1 ? 0.65 : 0.16);
    }
    const victim2 = captureTarget(game, action);
    const actor = at(game, action.from);
    let score = action.promotion ? 650 : 0;
    if (victim2) score += (victim2.side === game.side ? -1 : 1) * material2[victim2.kind] - 0.12 * material2[actor.kind];
    if (!victim2) {
      const center = (square) => 7 - Math.abs(file(square) - 3.5) - Math.abs(rank(square) - 3.5);
      const delta = center(action.to) - center(action.from);
      if (actor.kind === "p") score += 8 + delta * 10;
      if (actor.kind === "n" || actor.kind === "b") score += delta * 7 + (actor.moved ? 0 : 16);
      if (actor.kind === "k" && Math.abs(action.from - action.to) === 2) score += 60;
    }
    return score;
  }
  function chooseMove(game, difficulty, random = Math.random, weights = trainedWeights) {
    const policy = difficulties[difficulty];
    const side = game.side;
    const options = legal(game);
    if (options.length <= 1) return options[0];
    const king = options.find((action) => captureTarget(game, action)?.kind === "k");
    if (king) return king;
    let nodes = 0;
    let limit = Infinity;
    function line(position2, action) {
      const target = captureTarget(position2, action);
      const canRoll = target && action.type === "move" && !at(position2, action.from)?.roll;
      const faces = canRoll ? outcomes : [[4, 6]];
      const states = faces.map(([face, multiplicity]) => {
        nodes++;
        const next = play(position2, action, () => face).game;
        return { game: next, weight: multiplicity / 6 };
      });
      const value = states.reduce((sum, state) => sum + state.weight * statically(state.game, side, weights), 0);
      return { action, states, value };
    }
    const chooseBest = (max, a, b) => max ? Math.max(a, b) : Math.min(a, b);
    function recurse(position2, depth, extension) {
      if (position2.result || nodes >= limit) return statically(position2, side, weights);
      const max = position2.side === side, check = inCheck(position2, position2.side), bonus = position2.bonus !== null;
      const quiet = depth <= 0 && !bonus && !check;
      if (depth <= 0 && extension <= 0 && !bonus) return statically(position2, side, weights);
      let actions = legal(position2);
      if (quiet) actions = actions.filter((a) => Boolean(captureTarget(position2, a)) || a.type === "move" && Boolean(a.promotion));
      if (!actions.length) return statically(position2, side, weights);
      const terminal = actions.find((a) => captureTarget(position2, a)?.kind === "k");
      if (terminal) return max ? win : -win;
      const width = quiet ? Math.max(2, policy.beam - 2) : policy.beam;
      const ordered = actions.map((a) => ({ a, value: order(position2, a) })).sort((a, b) => b.value - a.value);
      const lines = ordered.slice(0, bonus || check ? Math.max(width * 2, 10) : width * 2 + 1).map((row) => line(position2, row.a));
      lines.sort((a, b) => (max ? 1 : -1) * (b.value - a.value));
      let best = quiet ? statically(position2, side, weights) : max ? -Infinity : Infinity;
      const shortlist = lines.slice(0, width);
      for (const [i, candidate] of shortlist.entries()) {
        if (nodes >= limit) {
          best = chooseBest(max, best, candidate.value);
          continue;
        }
        const enclosingLimit = limit;
        const budget = Math.max(0, Math.floor((limit - nodes) / (shortlist.length - i)));
        const value = candidate.states.reduce((sum, state) => {
          limit = Math.min(enclosingLimit, nodes + Math.ceil(budget / candidate.states.length));
          const spent = state.game.side !== position2.side ? 1 : 0;
          const childDepth = depth - spent;
          const nextExtension = depth <= 0 && !bonus ? extension - 1 : extension;
          return sum + state.weight * recurse(state.game, childDepth, nextExtension);
        }, 0);
        limit = enclosingLimit;
        best = chooseBest(max, best, value);
      }
      return best;
    }
    const roots = options.map((action) => line(game, action)).sort((a, b) => b.value - a.value);
    const viable = roots.filter((row) => row.value > -win);
    if (!viable.length) return roots[0].action;
    const finalWidth = policy.roots;
    let selected = viable.slice(0, Math.max(finalWidth, 10));
    const extend = policy.depth >= 2 ? 1 : 0;
    for (let depth = 1; depth <= policy.depth; depth++) {
      const remaining = Math.max(0, policy.budget - nodes);
      const share = Math.max(42, Math.floor(remaining / (selected.length * (policy.depth - depth + 1))));
      selected = selected.map((row) => {
        limit = nodes + share;
        const value = row.states.reduce((sum, state) => {
          const spent = state.game.side !== side ? 1 : 0;
          const childDepth = depth - spent;
          return sum + state.weight * recurse(state.game, childDepth, depth === 1 || depth === policy.depth ? extend : 0);
        }, 0);
        return { ...row, value };
      }).sort((a, b) => b.value - a.value);
      if (depth < policy.depth) selected = selected.slice(0, Math.max(policy.beam + 2, Math.ceil(selected.length * 0.68)));
    }
    if (policy.mistake && selected.length > 1 && random() < policy.mistake) {
      const alternatives = selected.filter((row) => row.value >= selected[0].value - 90).slice(0, 4);
      return alternatives[Math.floor(random() * alternatives.length)].action;
    }
    return selected[0].action;
  }

  // outputs/RemorseChess/Engine/puzzle-book.ts
  var lessons = [
    ["Back rank relay", "Capture the knight, then the rook.", 6, 1050, "B b1 n e4 r b7", "b1e4 e4b7"],
    ["Royal fork", "Capture the rook on the way to the king.", 6, 1400, "N d2 r e4 k f6", "d2e4 e4f6"],
    ["Pass the torch", "Take the bishop beside your own bishop so you can recover.", 1, 800, "P c4 b d5 p b5 B e6", "c4d5"],
    ["Diagonal clearance", "Capture the queen with check.", 4, 850, "B b2 q d4 k g7", "b2d4"],
    ["The open rank", "Take the knight and check the king along the file.", 5, 850, "R a4 n e4 k e8", "a4e4"],
    ["Choose your trade", "Take the queen with your least valuable attacker.", 3, 750, "P e4 R d1 q d5", "e4d5"],
    ["Detour", "Take the pawn before capturing the queen.", 6, 1200, "Q a2 p c4 q f4", "a2c4 c4f4"],
    ["Double jump", "Capture the bishop, then the rook.", 6, 1150, "N b1 b c3 r e4", "b1c3 c3e4"],
    ["A safe freeze", "Take the knight on a square next to your bishop.", 1, 900, "B b2 n e5 n c1 B f5", "b2e5"],
    ["One last file", "Capture the knight and finish on the king\u2019s square.", 6, 1200, "R h3 n h6 k b6", "h3h6 h6b6"],
    ["The volunteer", "Take the queen in one turn.", 6, 900, "P e4 p d5 q c6", "e4d5 d5c6"],
    ["Around the corner", "Take the king on your bonus move.", 6, 1050, "R a2 p a5 k e5", "a2a5 a5e5"],
    ["Fork with a follow-up", "Win the queen in one turn.", 6, 1150, "N c3 p d5 q f6", "c3d5 d5f6"],
    ["Switch diagonals", "Take the king before Black can reply.", 6, 1250, "B c2 p f5 k c8", "c2f5 f5c8"],
    ["Open file", "Capture both enemy rooks this turn.", 6, 1e3, "Q b2 r e5 r e7", "b2e5 e5e7"],
    ["Safe landing", "Take the rook and freeze beside your bishop.", 1, 750, "N c3 r d5 p b5 B e4", "c3d5"],
    ["Under cover", "Capture a knight where your bishop can absolve you.", 2, 850, "R d4 n a4 n d7 B c6", "d4d7"],
    ["Last chance", "Absolve the devastated queen before she disappears.", 1, 800, "B c3 Q d4 n e5", "c3d4"],
    ["Crossed wires", "Take the queen with a pawn, then take the rook.", 6, 950, "P e4 q f5 r g6", "e4f5 f5g6"],
    ["The long way", "Capture the bishop, then the queen in the same turn.", 6, 1350, "R b3 b b7 q f7", "b3b7 b7f7"]
  ];
  var publicPuzzleIds = {
    "the-volunteer": lessons.findIndex(([title]) => title === "The volunteer"),
    "last-chance": lessons.findIndex(([title]) => title === "Last chance")
  };
  var puzzleCount = lessons.length * 4;
  function puzzleAt(id) {
    const [title, goal, face, strength, layout, line] = lessons[id % lessons.length];
    const variant = Math.floor(id / lessons.length) % 4;
    const flip = (sq) => name((variant & 1 ? 7 - (sq.charCodeAt(0) - 97) : sq.charCodeAt(0) - 97) + 8 * (variant & 2 ? 8 - Number(sq[1]) : Number(sq[1]) - 1));
    const g = initial();
    const tokens = ("K h1 " + (layout.split(" ").includes("k") ? "" : "k h8 ") + layout).trim().split(/ +/);
    g.pieces = [];
    g.seen = {};
    g.side = variant & 2 ? "black" : "white";
    for (let i = 0; i < tokens.length; i += 2) {
      const kind = tokens[i].toLowerCase();
      const side = tokens[i] === tokens[i].toUpperCase() ? g.side : g.side === "white" ? "black" : "white";
      const sq = flip(tokens[i + 1]);
      const frozen = title === "Last chance" && kind === "q";
      g.pieces.push({ id: i, kind, side, square: sq.charCodeAt(0) - 97 + 8 * (Number(sq[1]) - 1), moved: true, roll: frozen ? 1 : 0, kills: frozen ? 1 : 0, rescue: frozen ? 1 : 0, mood: frozen ? "devastated" : "normal" });
    }
    return { title, goal: goal.replace("before Black can reply", "before the opponent can reply"), face, strength, game: g, line: line.split(" ").map((m) => flip(m.slice(0, 2)) + flip(m.slice(2))) };
  }

  // outputs/RemorseChess/Engine/bridge.ts
  function position(game) {
    return {
      snapshot: JSON.stringify(game),
      pieces: game.pieces,
      side: game.side,
      turn: game.turn,
      bonus: game.bonus,
      check: !game.result && inCheck(game, game.side),
      result: game.result,
      actions: legal(game)
    };
  }
  function puzzle(id) {
    const { title, goal, face, line, game } = puzzleAt(id);
    return { id, title, goal, face, line, position: position(game) };
  }
  var puzzles = Array.from({ length: puzzleCount }, (_, id) => {
    const { title } = puzzleAt(id);
    return { id, title, variation: Math.floor(id / (puzzleCount / 4)) + 1 };
  });
  function request(command, payload) {
    const input = JSON.parse(payload);
    let result;
    switch (command) {
      case "initial":
        result = position(initial());
        break;
      case "puzzles":
        result = puzzles;
        break;
      case "puzzle":
        result = puzzle(input.id);
        break;
      case "play": {
        const game = JSON.parse(input.snapshot);
        const action = input.action;
        const move = play(game, action, () => input.face);
        result = move ? { position: position(move.game), event: move.event } : null;
        break;
      }
      case "bot": {
        const game = JSON.parse(input.snapshot);
        result = chooseMove(game, input.difficulty) ?? null;
        break;
      }
      default:
        throw new Error("Unknown engine command: " + command);
    }
    return JSON.stringify(result);
  }
  return __toCommonJS(bridge_exports);
})();

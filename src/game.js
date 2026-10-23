// Keeping score in the simple mode's practice game: you serve every point, with a second serve after
// a fault, and the usual tennis scoring (15, 30, 40, deuce, advantage, game).

export const NEW_GAME = {
  you: 0,
  them: 0,
  games: [0, 0],
  serveNo: 1,
  // The last game's winner, until the next point starts.
  gameTo: null,
  stats: { points: 0, won: 0, firsts: 0, firstsIn: 0, aces: 0, doubles: 0 },
}

const CALLS = ['0', '15', '30', '40']

/**
 * The game after one serve. outcome is what playServe returned: kind is 'fault', 'ace', 'winner',
 * 'tough' or 'easy', and won says who took the point (null after a fault).
 */
export function afterServe(g, outcome) {
  const stats = { ...g.stats }
  const fault = outcome.kind === 'fault'
  if (g.serveNo === 1) {
    stats.firsts++
    if (!fault) stats.firstsIn++
  }
  if (outcome.kind === 'ace') stats.aces++
  if (fault && g.serveNo === 1) return { ...g, serveNo: 2, gameTo: null, stats }

  if (fault) stats.doubles++
  const won = !fault && outcome.won
  stats.points++
  if (won) stats.won++
  const you = g.you + (won ? 1 : 0)
  const them = g.them + (won ? 0 : 1)
  if (you >= 4 && you - them >= 2) return { ...g, you: 0, them: 0, games: [g.games[0] + 1, g.games[1]], serveNo: 1, gameTo: 'you', stats }
  if (them >= 4 && them - you >= 2) return { ...g, you: 0, them: 0, games: [g.games[0], g.games[1] + 1], serveNo: 1, gameTo: 'them', stats }
  return { ...g, you, them, serveNo: 1, gameTo: null, stats }
}

/**
 * The points as a scoreboard shows them, for you and them. call names deuce or who has the
 * advantage (a translation key), or is null.
 */
export function callScore(g) {
  if (g.you >= 3 && g.them >= 3) {
    if (g.you === g.them) return { you: '40', them: '40', call: 'deuce' }
    return g.you > g.them ? { you: 'AD', them: '40', call: 'advYou' } : { you: '40', them: 'AD', call: 'advThem' }
  }
  return { you: CALLS[g.you], them: CALLS[g.them], call: null }
}

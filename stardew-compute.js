const weights = [...new Array(11)].map((x) => 1 / 11);

/**
 * produce/forage
 * obelisks
 * golden clock
 * monster slayer
 * great friends
 * farmer level
 * all stardrops
 * cooking recipes
 * crafting recipes
 * fish
 * golden walnuts
 */
const values = [0.98, 0.75, 0, 1, 0.82, 1, 0, 0.96, 0.47, 0.98, 124 / 130];

const total = values.reduce((acc, val, idx) => acc + val * weights[idx], 0);

// 0.719, says 70% in game. huh.
console.log({ total });

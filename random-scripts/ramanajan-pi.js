const one_over_pi = (iters = 1) => {
  let sum = 0;

  for (let k = 0; k < iters; k++) {
    const numer = factorialIterative(4 * k) * (26390 * k + 1103);
    const denominator =
      Math.pow(factorialIterative(k), 4) * Math.pow(396, 4 * k);

    sum += numer / denominator;
  }

  const constant_scale = (2 * Math.sqrt(2)) / Math.pow(99, 2);

  return sum * constant_scale;
};

function factorialIterative(n) {
  if (n < 0) return undefined; // Factorials for negative numbers don't exist
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

const run = () => {
  for (let i = 1; i < 10; i++) {
    console.log(`iteration ${i}: ${1 / one_over_pi(i)}`);
  }
};

run();

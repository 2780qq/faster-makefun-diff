# a faster makefun-diff

[![make.fun · diff-speed-01-run-20261126](https://make.fun/badge/diff-speed-01-run-20261126.svg)](https://make.fun/bounty/diff-speed-01-run-20261126?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)
[![rank](https://make.fun/badge/diff-speed-01-run-20261126/2780qq/faster-makefun-diff/rank.svg)](https://make.fun/bounty/diff-speed-01-run-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)
[![reward](https://make.fun/badge/diff-speed-01-run-20261126/2780qq/faster-makefun-diff/reward.svg)](https://make.fun/bounty/diff-speed-01-run-20261126?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)

A drop-in for makefun-diff 1.0.0 that returns the same patch for every input, with the search's
string comparisons replaced by integer ones.

Entered in make.fun's [diff speed](https://make.fun/bounty/diff-speed-01-run-20261126) bounty.

## What it changes

The reference's control flow, tie-break, bounds, missing edge pruning, equal-run extraction and
patch writer are kept line for line, so the answer is the same by construction. Two things are cheaper:

- every line of both texts is interned to a small integer once, through one map shared by both texts,
  so the inner loop compares two numbers instead of two strings;
- the middle of each text goes into the search as an `Int32Array` view rather than a sliced copy.

## Running it

```sh
mkdir -p out
MAKEFUN_INPUT_DIR=path/to/input MAKEFUN_OUTPUT_DIR=out node main.ts
```

Reads `cases.json`, writes `answers.json`.

The practice set of 4 cases, around 2,500 lines and 2 MB each, comes out exact under both the
reference and this module.

## Licence

MIT. `vendor/makefun-diff/` is make.fun's own reference with its LICENSE and NOTICE, kept for the
record of what this derives from.

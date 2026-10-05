# Simple Limbus

Simplified guides for every playable identity in Limbus Company: what each one does and how to play it.

Each page starts with a tl;dr: a few bullets on what to stack every turn, how the identity helps the team, which skills it upgrades into and what builds toward them, which skills hit more than one target, and, when one matters, a turn-1 tip (what defending first gets you) or a defense tip. Below that, every skill and passive gets a short description, with upgrades grouped under the skill they come from, a note on how to unlock them, and an AoE tag on skills that hit more than one target. Teammates lists identities that work well with it: direct partners that name each other, factions with bonuses for each other, and teams built around the same keyword. The wiki's full text is always one click away.

## Development

```bash
npm install                                 # install dependencies (Node 22)
npm run dev                                 # start the dev server at http://localhost:5173
npm run build                               # typecheck, build the site into dist/ and write a page per identity
npm run preview                             # serve the built dist/ locally
npm run typecheck                           # typecheck only
npm run data                                # pull fresh data from the wiki and rebuild every guide
npm run data:offline                        # rebuild every guide from the local wiki cache, no network
node scripts/update-data.mjs --no-images    # rebuild without downloading or trimming sprites
```

## Credits

Identity data and chibi sprites are from the [Limbus Company Wiki](https://limbuscompany.wiki.gg), under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Limbus Company © Project Moon. This site is not affiliated with Project Moon.

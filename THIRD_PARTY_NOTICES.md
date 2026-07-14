# Third-Party Notices

This project's own code is licensed under the MIT License (see [LICENSE](./LICENSE)).

A handful of rendering techniques in the "Canvas" view were ported from
[Agent Flow](https://github.com/patoles/agent-flow), which is licensed under
the Apache License, Version 2.0. A full copy of that license is included at
[LICENSE-APACHE](./LICENSE-APACHE), as required by its terms.

## Ported components

| File | Technique |
| --- | --- |
| `web/components/canvas/draw-hex.ts` | Hexagon node primitives |
| `web/components/canvas/starfield.ts` | Background starfield layer |
| `web/lib/holo.ts` | Holographic design tokens |
| `web/components/canvas/CostPanel.tsx` | Cost/token overlay panel styling |
| `web/components/canvas/LiveBar.tsx` | Bottom control bar styling |

Each file carries its own attribution comment at the top pointing back to this
notice and to the original source.

Copyright (c) the Agent Flow contributors ([patoles/agent-flow](https://github.com/patoles/agent-flow)).
Licensed under the Apache License, Version 2.0 — see [LICENSE-APACHE](./LICENSE-APACHE)
or <http://www.apache.org/licenses/LICENSE-2.0>.

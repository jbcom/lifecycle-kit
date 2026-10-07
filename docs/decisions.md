# Compatibility and repository policy

The package supports the maintained Node.js 22, 24 and 26 lines with an
`engines.node` range of `>=22`. This is a maintained-line policy, not a promise
about every historical patch. The runtime targets ES2022 and has no Node-only
adapters or later Node API requirements. Development defaults to Node 26;
CI verifies each supported major and release/docs jobs select `lts/*`.

Verification includes a packed consumer that installs from a temporary tarball
using npmjs and imports every shipped ESM entry point. CommonJS is not shipped.

The branch ruleset helper defaults to this repository and the stable checks
`CI / gate`, `title`, `Repository Policy / gate`, and `Dependency Review / gate`.
It applies the canonical OSS ruleset trio, without AI-billed Copilot review or
Code Quality rules. Run it only when repository administration is intended.

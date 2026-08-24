---
title: API reference
description: Generated reference for every supported Lifecycle Kit export.
---

The API pages are generated from the TSDoc on the package's actual public
entry points whenever the documentation site builds. Sourcey renders those
Markdown pages as part of this site; TypeDoc is an extraction step only, not a
second documentation renderer.

Browse the [complete generated module index](./api/README/) or import a
focused subpath directly:

```ts
import * as chem from "@jbdevprimary/lifecycle-kit/chem";
import * as bioLaws from "@jbdevprimary/lifecycle-kit/bio-laws";
import * as forms from "@jbdevprimary/lifecycle-kit/forms";
import * as pigment from "@jbdevprimary/lifecycle-kit/pigment";
import * as assemblage from "@jbdevprimary/lifecycle-kit/assemblage";
```

The root entry point exposes the same stages as namespaces so colliding names
stay explicit.

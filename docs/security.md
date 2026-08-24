---
title: Security
description: Vulnerability reporting and the repository's contributor trust boundary.
---

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/jbcom/lifecycle-kit/security/advisories/new).
Do not include exploit details in a public issue.

The latest minor release receives security fixes. The repository separates
trusted upstream branches from arbitrary forks: fork pull requests receive
read-only validation only, cannot publish packages or deploy documentation, and
are blocked from changing workflow and release control-plane files.

Automated checks are the normal merge gate for trusted agent branches. They do
not require a standing human approving review, and they do not grant a policy
bypass.

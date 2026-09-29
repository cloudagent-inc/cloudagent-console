# Third-Party Notices

CloudAgent Console redistributes third-party software and visual assets and can
connect to separately installed tools and external services. Those materials
remain subject to their own licenses, terms, and trademark guidelines.

Binary distributions include the following files in their `legal` resources
directory:

- `LICENSE` — the Apache License 2.0 terms for CloudAgent Console and applicable
  Apache-licensed components.
- `NOTICE` — attribution notices that must accompany CloudAgent Console.
- `THIRD_PARTY_LICENSES.md` — a deterministic inventory generated from the exact
  production packages installed into that build, including their published
  license and notice text.
- `ELECTRON_LICENSE.txt` — the license shipped with the exact Electron runtime
  used for that build.
- `LICENSES.chromium.html` — the third-party license notices shipped with the
  exact Chromium runtime embedded in Electron.

## AWS CloudFormation Guard Rules

CloudAgent Console includes rules ported from the
[AWS Guard Rules Registry](https://github.com/aws-cloudformation/aws-guard-rules-registry)
at commit `7f7340c26ae5d5e8874651dbffeb12e0e9f505b6`, under the Apache
License 2.0.

Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

The individual rule files identify their upstream source and the CloudAgent
changes made to them.

## Cloud Provider Icons

CloudAgent Console includes cloud provider icon assets used for workload and
architecture diagrams.

- AWS icons and service names are trademarks or materials of Amazon Web
  Services, Inc. or its affiliates.
- Microsoft Azure icons and service names are trademarks or materials of
  Microsoft Corporation.
- Google Cloud icons and service names are trademarks or materials of Google LLC.

These assets are included to represent cloud resources in generated diagrams and
product UI. Their inclusion does not imply endorsement by AWS, Microsoft, or
Google.

## External Services and Tools

CloudAgent Console may integrate with local tools and external agent runtimes,
including OpenAI APIs, Codex, Claude Code, Cursor Agent, AWS CLI, and MCP-compatible
clients or servers. Product names and trademarks belong to their respective
owners. These services and separately installed tools are not redistributed as
part of CloudAgent Console unless the accompanying distribution says otherwise.

# CloudFormation Guard rules

These 38 rules are the CloudFormation side of CloudAgent's curated shared IaC
policy catalog. Each selectable policy also has an audited active Trivy mapping.

The rule sources were ported from the
[AWS Guard Rules Registry](https://github.com/aws-cloudformation/aws-guard-rules-registry)
at commit `7f7340c26ae5d5e8874651dbffeb12e0e9f505b6`. CloudAgent normalized trailing
whitespace but did not intentionally change rule semantics.

When adding a policy, update the shared catalog, include its local `.guard`
asset, add its Trivy mapping, and add compliant/non-compliant fixtures for both
surfaces before exposing it in the UI.

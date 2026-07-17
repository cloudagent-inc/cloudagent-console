import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeHealthCheckResources,
  parseAwsArn,
  safeTrim,
} from "../src/aws/resource-health/shared.mjs";

test("resource health shared helpers keep safeTrim locally bound and exported", () => {
  assert.equal(safeTrim("  health  "), "health");

  assert.deepEqual(
    parseAwsArn("  arn:aws:lambda:ca-central-1:123456789012:function:demo  "),
    {
      arn: "arn:aws:lambda:ca-central-1:123456789012:function:demo",
      partition: "aws",
      service: "lambda",
      region: "ca-central-1",
      accountId: "123456789012",
      resource: "function:demo",
    }
  );
});

test("resource health normalization trims values and derives ARN context", () => {
  assert.deepEqual(
    normalizeHealthCheckResources([
      {
        resourceType: "  AWS::Lambda::Function  ",
        resourceArn: "  arn:aws:lambda:ca-central-1:123456789012:function:demo  ",
        displayName: "  Demo function  ",
      },
    ]),
    [
      {
        index: 0,
        targetKey:
          "AWS::Lambda::Function|arn:aws:lambda:ca-central-1:123456789012:function:demo|ca-central-1",
        resourceType: "AWS::Lambda::Function",
        identifier: "arn:aws:lambda:ca-central-1:123456789012:function:demo",
        resourceArn: "arn:aws:lambda:ca-central-1:123456789012:function:demo",
        resourceId: null,
        region: "ca-central-1",
        accountId: "123456789012",
        displayName: "Demo function",
      },
    ]
  );
});

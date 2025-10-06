
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { defineFunction } from "@aws-amplify/backend";
import { Duration } from "aws-cdk-lib";
import { DockerImageFunction, DockerImageCode, Architecture } from "aws-cdk-lib/aws-lambda";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

const functionDir = path.dirname(fileURLToPath(import.meta.url));

export const earthaccessFunctionHandler = defineFunction(
  (scope) => {
    const usernameSecret = secretsmanager.Secret.fromSecretNameV2(
      scope,
      "EarthdataUsernameSecret",
      "earthdata/username"
    );
    const passwordSecret = secretsmanager.Secret.fromSecretNameV2(
      scope,
      "EarthdataPasswordSecret",
      "earthdata/password"
    );

    const fn = new DockerImageFunction(scope, "earthaccess", {
      code: DockerImageCode.fromImageAsset(functionDir, {
        platform: Platform.LINUX_AMD64,
      }),
      architecture: Architecture.X86_64,
      memorySize: 2048,
      timeout: Duration.seconds(120),
      environment: {
        EARTHDATA_USERNAME: usernameSecret.secretValue.unsafeUnwrap(),
        EARTHDATA_PASSWORD: passwordSecret.secretValue.unsafeUnwrap(),
      },
    });

    usernameSecret.grantRead(fn);
    passwordSecret.grantRead(fn);

    return fn;
  },
  {
    resourceGroupName: "auth" // Optional: Groups this function with auth resource
  }
);
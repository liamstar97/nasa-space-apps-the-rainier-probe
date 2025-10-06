
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
      memorySize: 4096,
      timeout: Duration.seconds(240),
      environment: {
        EARTHDATA_USERNAME: usernameSecret.secretValue.unsafeUnwrap(),
        EARTHDATA_PASSWORD: passwordSecret.secretValue.unsafeUnwrap(),
        // DYNAMODB_TABLE_NAME will be set in backend.ts
      },
    });

    usernameSecret.grantRead(fn);
    passwordSecret.grantRead(fn);
    
    // Self-invoke permission will be added in backend.ts to avoid circular dependency

    return fn;
  },
  {
    resourceGroupName: "data" // Assigned to data stack since it's used as a data resolver
  }
);
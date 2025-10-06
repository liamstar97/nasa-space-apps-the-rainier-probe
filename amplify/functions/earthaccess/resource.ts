
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { defineFunction } from "@aws-amplify/backend";
import { Duration } from "aws-cdk-lib";
import { DockerImageFunction, DockerImageCode, Architecture } from "aws-cdk-lib/aws-lambda";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";

const functionDir = path.dirname(fileURLToPath(import.meta.url));

export const earthaccessFunctionHandler = defineFunction(
  (scope) =>
    new DockerImageFunction(scope, "earthaccess", {
      code: DockerImageCode.fromImageAsset(functionDir, {
        platform: Platform.LINUX_AMD64,
      }),
      architecture: Architecture.X86_64,
      memorySize: 2048,
      timeout: Duration.seconds(120),
    }),
    {
      resourceGroupName: "auth" // Optional: Groups this function with auth resource
    }
);
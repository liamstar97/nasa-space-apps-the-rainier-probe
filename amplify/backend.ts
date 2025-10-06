import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { sayHelloFunctionHandler } from './functions/say-hello/resource';
import { earthaccessFunctionHandler } from './functions/earthaccess/resource';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Stack, ArnFormat } from 'aws-cdk-lib';


/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  sayHelloFunctionHandler,
  earthaccessFunctionHandler,
});

// Grant the Lambda function access to the DynamoDB table created by Amplify Data
const earthAccessJobTable = backend.data.resources.tables["EarthAccessJob"];
if (earthAccessJobTable) {
  const lambdaFunction = backend.earthaccessFunctionHandler.resources.lambda;
  earthAccessJobTable.grantReadWriteData(lambdaFunction);
  
  // Add the table name to the Lambda environment
  // Access the underlying L2 construct to add environment variables
  (lambdaFunction as any).addEnvironment(
    "DYNAMODB_TABLE_NAME",
    earthAccessJobTable.tableName
  );
  
  // Grant Lambda permission to invoke itself (for async processing)
  // Use formatArn with wildcard to avoid circular dependency
  const stack = Stack.of(lambdaFunction);
  const functionArnPattern = stack.formatArn({
    service: 'lambda',
    resource: 'function',
    resourceName: '*earthaccess*',  // Match any function with 'earthaccess' in the name
    arnFormat: ArnFormat.COLON_RESOURCE_NAME,
  });
  
  (lambdaFunction as any).addToRolePolicy(new iam.PolicyStatement({
    actions: ['lambda:InvokeFunction'],
    resources: [functionArnPattern],
  }));
}
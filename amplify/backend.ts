import { defineBackend, secret } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { sayHelloFunctionHandler } from './functions/say-hello/resource';
import { earthaccessFunctionHandler } from './functions/earthaccess/resource';


/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  sayHelloFunctionHandler,
  earthaccessFunctionHandler,
});

// Add secrets to earthaccessFunctionHandler environment variables
backend.earthaccessFunctionHandler.addEnvironment('EARTHDATA_USERNAME', secret('EARTHDATA_USERNAME'));
backend.earthaccessFunctionHandler.addEnvironment('EARTHDATA_PASSWORD', secret('EARTHDATA_PASSWORD'));


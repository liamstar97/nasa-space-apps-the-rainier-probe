import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { sayHelloFunctionHandler } from './functions/say-hello/resource';
import { earthaccessFunctionHandler } from './functions/earthaccess/resource';


/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
defineBackend({
  auth,
  data,
  sayHelloFunctionHandler,
  earthaccessFunctionHandler,
});
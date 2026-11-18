import type { PostConfirmationTriggerHandler } from 'aws-lambda';

import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

import { env } from '$amplify/env/post-confirmation';

const client = new CognitoIdentityProviderClient({});

export const handler: PostConfirmationTriggerHandler = async (event) => {
  console.log('Post confirmation for:', event.userName);

  await client.send(
    new AdminAddUserToGroupCommand({
      GroupName: env.GROUP_NAME,
      Username: event.userName,
      UserPoolId: event.userPoolId,
    }),
  );

  return event;
};

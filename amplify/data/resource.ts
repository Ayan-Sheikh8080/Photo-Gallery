import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

const schema = a.schema({
  Photo: a
    .model({
      title: a.string().required(),
      description: a.string(),
      s3Key: a.string().required(),
    })
    .authorization((allow) => [
      allow.owner(), // owner: full access
      allow.authenticated().to(['read']), // any signed-in user can view the gallery
      allow.group('Admins'), // admins: full access
    ]),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});

import { defineFunction } from '@aws-amplify/backend';

export const restHandler = defineFunction({
  name: 'rest-handler',
  entry: './handler.ts',
});

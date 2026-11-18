import type { APIGatewayProxyHandler } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Request', event.path, event.httpMethod);
  const claims = event.requestContext.authorizer?.claims;

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Hello from the protected REST API',
      email: claims?.email ?? null,
      groups: claims?.['cognito:groups'] ?? null,
    }),
  };
};

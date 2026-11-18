import { defineBackend } from '@aws-amplify/backend';
import { Duration, Stack } from 'aws-cdk-lib';
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  Cors,
  LambdaIntegration,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import {
  Alarm,
  ComparisonOperator,
  Dashboard,
  GraphWidget,
  Metric,
  Statistic,
} from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { restHandler } from './functions/rest-handler/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  restHandler,
});

const apiStack = backend.createStack('rest-api-stack');
const api = new RestApi(apiStack, 'PhotoRestApi', {
  restApiName: 'photo-rest-api',
  deployOptions: { stageName: 'dev', metricsEnabled: true },
  defaultCorsPreflightOptions: {
    allowOrigins: Cors.ALL_ORIGINS,
    allowMethods: Cors.ALL_METHODS,
    allowHeaders: [...Cors.DEFAULT_HEADERS, 'Authorization'],
  },
});

const authorizer = new CognitoUserPoolsAuthorizer(apiStack, 'CognitoAuth', {
  cognitoUserPools: [backend.auth.resources.userPool],
});
const integration = new LambdaIntegration(backend.restHandler.resources.lambda);

api.root.addResource('health').addMethod('GET', integration);
api.root.addResource('me').addMethod('GET', integration, {
  authorizer,
  authorizationType: AuthorizationType.COGNITO,
});

const oneMinute = Duration.minutes(1);
const restHandlerFunctionName =
  backend.restHandler.resources.lambda.functionName;
const restInvocations = new Metric({
  namespace: 'AWS/Lambda',
  metricName: 'Invocations',
  dimensionsMap: { FunctionName: restHandlerFunctionName },
  statistic: Statistic.SUM,
  period: oneMinute,
});
const restErrors = new Metric({
  namespace: 'AWS/Lambda',
  metricName: 'Errors',
  dimensionsMap: { FunctionName: restHandlerFunctionName },
  statistic: Statistic.SUM,
  period: oneMinute,
});
const apiMetric = (metricName: string) =>
  new Metric({
    namespace: 'AWS/ApiGateway',
    metricName,
    dimensionsMap: { ApiName: 'photo-rest-api', Stage: 'dev' },
    statistic: Statistic.SUM,
    period: oneMinute,
  });
const appSyncRequests = new Metric({
  namespace: 'AWS/AppSync',
  metricName: 'Requests',
  dimensionsMap: { GraphQLAPIId: backend.data.resources.graphqlApi.apiId },
  statistic: Statistic.SUM,
  period: oneMinute,
});

const dashboard = new Dashboard(apiStack, 'PhotoGalleryDashboard', {
  dashboardName: 'photo-gallery-monitoring',
});
dashboard.addWidgets(
  new GraphWidget({
    title: 'REST Lambda Invocations and Errors',
    left: [restInvocations],
    right: [restErrors],
  }),
  new GraphWidget({
    title: 'REST API Gateway Count and Errors',
    left: [apiMetric('Count')],
    right: [apiMetric('4XXError'), apiMetric('5XXError')],
  }),
  new GraphWidget({
    title: 'AppSync Requests',
    left: [appSyncRequests],
  }),
);

const alarmTopic = new Topic(apiStack, 'RestHandlerAlarmTopic');
const errorAlarm = new Alarm(apiStack, 'RestHandlerErrorsAlarm', {
  metric: restErrors,
  threshold: 1,
  evaluationPeriods: 1,
  comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  alarmDescription: 'One or more REST handler errors occurred in one minute.',
});
errorAlarm.addAlarmAction(new SnsAction(alarmTopic));

backend.addOutput({
  custom: {
    API: {
      PhotoRestApi: {
        endpoint: api.url,
        region: Stack.of(api).region,
      },
    },
    monitoring: {
      dashboardName: dashboard.dashboardName,
      alarmTopicArn: alarmTopic.topicArn,
    },
  },
});

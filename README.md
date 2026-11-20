# AWS Amplify Photo Gallery

Photo Gallery is a React application built with AWS Amplify Gen 2 and deployed
as a full-stack cloud application. It combines Amazon Cognito authentication,
AWS AppSync GraphQL, Amazon S3 storage, Amazon API Gateway, AWS Lambda,
Amazon CloudWatch, and Amazon SNS with GitHub Actions security checks.

## Features

- Sign in with email or Google through Amazon Cognito.
- Create an authenticated photo record in AWS AppSync.
- Upload an image to Amazon S3 under `photos/{identityId}/{timestamp}-{filename}`.
- View gallery images with `StorageImage`.
- Observe photo records in real time with `Photo.observeQuery()`.
- Delete a photo as its owner or as an `Admins` group member.
- Call a protected REST endpoint using a Cognito ID token.
- Monitor Lambda, API Gateway, and AppSync metrics in CloudWatch.
- Receive Lambda error notifications through Amazon SNS.
- Run lint, formatting, secret scanning, CodeQL, and dependency scanning in
  GitHub Actions.

## Technology Stack

### Frontend

- React 19
- TypeScript
- Vite
- AWS Amplify JavaScript library
- Amplify Authenticator and Storage components
- AWS Amplify UI React Storage

### AWS backend

- AWS Amplify Gen 2
- Amazon Cognito
- AWS AppSync GraphQL
- Amazon DynamoDB for Amplify data models
- Amazon S3
- Amazon API Gateway
- AWS Lambda
- Amazon CloudWatch
- Amazon SNS
- AWS CDK

### Development and security

- ESLint
- Prettier
- GitHub Actions
- Gitleaks
- GitHub CodeQL
- Snyk

## AWS Amplify Backend

The complete backend is registered in `amplify/backend.ts`:

```ts
defineBackend({
  auth,
  data,
  storage,
  restHandler,
});
```

The same file creates a custom CDK REST API stack and monitoring resources.

## Authentication

Amazon Cognito provides email/password authentication and Google OAuth through
the Amplify Authenticator.

Configured Cognito groups are:

- `Admins`
- `Users`

The Google provider is configured with the `email`, `profile`, and `openid`
scopes. Google client credentials are stored as Amplify secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Local and production callback/logout URLs are configured in
`amplify/auth/resource.ts`.

### Post-confirmation trigger

`amplify/auth/post-confirmation/handler.ts` contains a Cognito
post-confirmation Lambda trigger that:

1. Receives the confirmed Cognito user and user pool ID.
2. Calls Cognito `AdminAddUserToGroup`.
3. Adds the user to the `Users` group.

The trigger receives `GROUP_NAME=Users` from its function resource. The
post-confirmation Lambda has permission to call `addUserToGroup` through the
Cognito resource access configuration.

## GraphQL API

The AppSync schema is defined in `amplify/data/resource.ts`.

### Photo model

The `Photo` model contains:

| Field         | Type   | Required |
| ------------- | ------ | -------- |
| `title`       | String | Yes      |
| `description` | String | No       |
| `s3Key`       | String | Yes      |

Amplify also creates the standard record fields, including `id`, `owner`,
`createdAt`, and `updatedAt`.

### GraphQL authorization

- Owners have full access to their records.
- Any authenticated user can read photo records.
- Members of `Admins` have full access.
- The default authorization mode is Cognito user-pool authentication.

The frontend uses `generateClient<Schema>()` and the Amplify model operations:

- `client.models.Photo.create(...)`
- `client.models.Photo.observeQuery(...)`
- `client.models.Photo.delete(...)`

Creating a photo without an authenticated Cognito session is rejected.

## S3 Storage

Amazon S3 storage is registered in `amplify/storage/resource.ts` under the
Amplify storage name `photoBucket`.

Uploads use the path:

```text
photos/{identityId}/{timestamp}-{filename}
```

Storage authorization allows:

- the identity that owns the S3 entity path to read, write, and delete;
- authenticated users to read images;
- `Admins` to read and delete images.

The frontend uses `uploadData()` to upload files and creates the corresponding
AppSync `Photo` record with the returned S3 path as `s3Key`. It uses
`StorageImage` to display images and `remove()` to delete image objects.

## REST API

The backend creates a custom REST API named `PhotoRestApi` in the
`rest-api-stack` stack. The API stage is `dev`.

### Endpoints

| Method | Path      | Authorization     |
| ------ | --------- | ----------------- |
| `GET`  | `/health` | Public            |
| `GET`  | `/me`     | Cognito user pool |

The Cognito authorizer is attached to `/me`. The REST handler receives Cognito
claims and returns:

- a success message;
- the caller's email;
- the caller's `cognito:groups` claim.

CORS allows all origins and includes `Authorization` in preflight headers.

The frontend:

1. Reads the API endpoint from `custom.API.PhotoRestApi.endpoint` in
   `amplify_outputs.json`.
2. Gets the Cognito ID token with `fetchAuthSession()`.
3. Sends the ID token in the `Authorization` header.
4. Calls `${endpoint}me`.

API calls must use the Cognito ID token, not the access token.

## Frontend Gallery

`src/main.tsx` configures Amplify by importing `amplify_outputs.json`.

The `App.tsx` gallery provides:

- Amplify Google/email sign-in and sign-out;
- current account identity;
- title and description inputs;
- an image file picker;
- S3 image uploads;
- AppSync photo record creation;
- live gallery loading through `observeQuery`;
- a REST API test control;
- owner/admin delete controls;
- loading, empty-gallery, and error states;
- a responsive photo-card layout.

The frontend reads `cognito:groups` from the Cognito ID-token payload. It shows
Delete only for `Admins` or the owner of a photo. Cognito and Amplify
authorization enforce access independently of the frontend controls.

## CloudWatch Monitoring

The CDK backend creates a CloudWatch dashboard named
`photo-gallery-monitoring-v2`.

Dashboard widgets cover:

- REST Lambda invocations;
- REST Lambda errors;
- API Gateway request count;
- API Gateway 4XX and 5XX errors;
- AppSync request count.

The REST handler also writes entries to automatic Lambda CloudWatch log groups.

### Lambda error alarm

The backend creates an alarm that enters `ALARM` when the REST Lambda `Errors`
metric is greater than or equal to one during a one-minute evaluation period.
The alarm publishes to an SNS topic. The generated backend outputs include:

- `monitoring.dashboardName`;
- `monitoring.alarmTopicArn`.

An SNS email subscription must be confirmed in the AWS Console before alarm
email notifications can be received.

## GitHub Actions CI

The workflow is in `.github/workflows/ci.yml` and runs for pushes to `main` and
for pull requests.

It contains four jobs:

1. **lint-and-format**
   - runs `npm ci`;
   - runs ESLint;
   - runs `npm run format:check`.
2. **secret-scan**
   - runs Gitleaks with full history checkout.
3. **codeql**
   - initializes JavaScript/TypeScript CodeQL;
   - runs CodeQL analysis.
4. **dependency-scan**
   - runs `npm ci`;
   - runs Snyk for high-severity dependency findings.

The workflow requires the `SNYK_TOKEN` GitHub Actions secret for Snyk.

Prettier formatting is configured by:

- `.prettierrc`: `{ "singleQuote": true }`;
- `.prettierignore`: ignores `node_modules`, `dist`, `amplify_outputs*`, and
  `package-lock.json`.

## Local Setup

### Prerequisites

- Node.js 20 or newer
- npm
- AWS account and credentials
- Amplify CLI/Gen 2 tooling
- Google OAuth application, for Google sign-in

### Install dependencies

```sh
npm ci
```

### Configure Google OAuth

Set these Amplify secrets:

```sh
npx ampx sandbox secret set GOOGLE_CLIENT_ID
npx ampx sandbox secret set GOOGLE_CLIENT_SECRET
```

In Google Cloud Console, configure the Cognito hosted-UI
`/oauth2/idpresponse` URI as an authorized redirect URI. The production URI
must match the Cognito domain and the callback URL in
`amplify/auth/resource.ts`.

### Deploy a local sandbox

```sh
npx ampx sandbox
npm run dev
```

The sandbox generates `amplify_outputs.json`, which is required by
`src/main.tsx` and is ignored by Git.

## AWS Deployment

The Amplify backend can be deployed through an Amplify Hosting pipeline or an
Amplify sandbox for development.

The root `amplify.yml` build specification deploys the Gen 2 backend first with
`ampx pipeline-deploy`, which generates the branch-specific
`amplify_outputs.json`. The frontend install and build run afterward, so the
TypeScript build can resolve the generated outputs file. Keep this generated
file out of Git.

Before deployment:

- add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the Amplify environment;
- add `SNYK_TOKEN` to GitHub Actions;
- configure Cognito callback and logout URLs for the live Amplify domain;
- configure the Google OAuth redirect URI;
- ensure the Amplify Hosting app uses the root `amplify.yml` build settings;
- configure the Amplify service role with permission to deploy the backend.

After deployment:

1. Sign in through the live Amplify URL.
2. Confirm the Cognito user is added to `Users`.
3. Add a test user manually to `Admins` in Cognito.
4. Upload and display an image.
5. Confirm the image exists under `photos/` in S3.
6. Call `/health` without a token and `/me` with and without a token.
7. Confirm CloudWatch logs, dashboard widgets, and the Lambda alarm.
8. Confirm the SNS email subscription and alarm notification.

## Available Commands

```sh
npm run dev
npm run build
npm run lint
npm run format:check
npm run preview
npx prettier --write .
```

The main source checks completed in the implementation environment are:

- `npm run lint`
- `npm run format:check`
- `npx tsc -b --pretty false`
- Amplify backend TypeScript check with
  `npx tsc --noEmit --project amplify/tsconfig.json`

The final production deployment, AWS console configuration, live Google OAuth
test, and CI-run evidence require access to the AWS account and GitHub
repository.

## Security and Repository Notes

- `amplify_outputs.json` and `amplifyconfiguration*` are ignored by Git.
- Node modules, `.amplify`, build output, and local environment files are not
  committed.
- OAuth secrets, AWS credentials, GitHub tokens, and Snyk tokens must remain
  outside source control.
- Gitleaks, CodeQL, and Snyk are included in the GitHub Actions workflow.
- Frontend delete controls are user experience behavior; AppSync and S3
  authorization rules remain the security boundary.

## Work Left to Complete the Project 100%

The source code, backend definitions, frontend, monitoring configuration, and
CI workflow have been implemented. The remaining work requires access to AWS,
Google Cloud, and GitHub and therefore cannot be completed from the source
repository alone.

### 1. AWS and Amplify Deployment

- Deploy the Amplify Gen 2 backend and frontend to Amplify Hosting.
- Configure branch environment secrets:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
- **Completed:** The environment-specific `amplify_outputs.json` was generated.
- Confirm that the deployed Amplify build includes the generated
  `amplify_outputs.json` and that the file remains ignored by Git.
- Confirm that the deployed backend creates all required resources:
  - Cognito user pool and groups
  - AppSync GraphQL API and DynamoDB table
  - S3 photo bucket
  - API Gateway REST API
  - REST and post-confirmation Lambda functions
  - CloudWatch dashboard and alarm
  - SNS alarm topic
- Stop the development sandbox when it is not being used and keep it available
  until grading is complete.

### 2. Google OAuth and Cognito

- **Completed:** The Google OAuth application was configured.
- **Completed:** The Cognito `/oauth2/idpresponse` redirect URI was added to
  Google Cloud authorized redirect URIs.
- Confirm the Google callback and logout URLs in `amplify/auth/resource.ts`
  match the deployed Cognito domain and live Amplify URL.
- Test Google sign-in and sign-in using the live Amplify URL.
- Test redirect behavior in production, since localhost redirects do not prove
  the production Google OAuth configuration is correct.

### 3. Cognito Groups and Lambda Trigger

- Create and verify both Cognito groups: `Admins` and `Users`.
- Sign in with the primary test account and confirm that the post-confirmation
  Lambda adds it to `Users`.
- Manually add the primary test account to `Admins` in the Cognito Console.
- Sign in with a second Google account and verify that the post-confirmation
  trigger assigns only `Users`.
- Open the post-confirmation Lambda CloudWatch log group and verify successful
  account-to-group assignments.

### 4. REST API Verification

- Confirm `GET /health` returns `200` without an Authorization header.
- Confirm `GET /me` returns `401` without an ID token.
- Confirm `GET /me` returns `200` with a valid Cognito ID token.
- Verify that `/me` returns the signed-in email and `cognito:groups` claims.
- Confirm the frontend sends the Cognito ID token, not the access token.
- Check CORS behavior from the live Amplify domain.
- Capture screenshots of the unauthorized `401` response and authorized `200`
  response.

### 5. GraphQL, Gallery, and S3 Verification

- Confirm an signed-out GraphQL photo creation fails.
- Sign in and confirm photo creation succeeds.
- Upload an image through the frontend.
- Confirm the frontend gallery loads and displays the uploaded image.
- Confirm the image record is created through AppSync.
- Confirm the image exists under `photos/` in the S3 Console.
- Test deletion as the photo owner.
- Test deletion as an `Admins` group member.
- Confirm a normal `Users` account cannot delete another user's photo through
  frontend behavior and AppSync authorization.

### 6. CloudWatch and SNS Verification

- Open the REST handler and post-confirmation Lambda CloudWatch log groups and
  confirm that entries exist.
- Confirm the `photo-gallery-monitoring-v2` CloudWatch dashboard exists.
- Verify Lambda Invocations and Errors widgets.
- Verify API Gateway Count, 4XXError, and 5XXError widgets.
- Verify the AppSync request-count widget.
- Subscribe an email address to the generated SNS alarm topic and confirm the
  subscription.
- Temporarily add a controlled Lambda error test to the REST handler and invoke
  it until the Lambda Errors alarm reaches `ALARM`.
- Capture the alarm in `ALARM`, the Lambda log entry, and the SNS email.
- Remove the temporary failure code after testing.

### 7. GitHub and CI Setup

- Push the project to the `main` branch.
- Add `SNYK_TOKEN` in GitHub
  `Settings > Secrets and variables > Actions`.
- Run the CI workflow and confirm these jobs pass:
  - `lint-and-format`
  - `secret-scan`
  - `codeql`
  - `dependency-scan`
- If CodeQL is unavailable for a private repository, enable GitHub Advanced
  Security or document the repository limitation.
- If Snyk or Gitleaks findings are false positives or cannot be fixed, add a
  short explanation to `SECURITY-NOTES.md`.
- Confirm no OAuth credentials, AWS credentials, Amplify outputs, or action
  tokens are committed.
- Add the instructor and teaching assistant as collaborators if the repository
  is private.

### 8. Required Screenshot Evidence

The following items remain to be captured for the final report:

- Amplify build pipeline or deployment screen.
- Cognito user pool showing the `Admins` group and a user in that group.
- REST `/me` response with `401` and `200`.
- GraphQL/gallery operation showing loaded photos.
- S3 Console showing uploaded images under `photos/`.
- All four GitHub Actions jobs green.
- The committed CI workflow file.
- REST and post-confirmation Lambda CloudWatch logs.
- CloudWatch dashboard.
- Lambda alarm in `ALARM`.
- SNS alarm email.
- Live Amplify application showing the second-account sign-in test.

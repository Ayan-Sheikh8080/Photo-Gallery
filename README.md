# Photo Gallery

A React and AWS Amplify Gen 2 photo gallery with Cognito sign-in, AppSync
GraphQL, private S3 uploads, a Cognito-protected API Gateway endpoint, and
CloudWatch monitoring.

## Run locally

1. Install Node.js 20 and run `npm ci`.
2. Set the Amplify backend secrets `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET` for your Google OAuth app.
3. Configure the Google OAuth authorized redirect URI to the Cognito hosted UI
   `/oauth2/idpresponse` callback shown by your deployed user pool.
4. Run `npx ampx sandbox` to deploy a personal backend and generate
   `amplify_outputs.json`.
5. Run `npm run dev`, then sign in and upload an image.

`amplify_outputs.json` is generated per environment and ignored by Git. Update
the callback and logout URLs in `amplify/auth/resource.ts` when using a
different production domain.

## Backend behavior

- Signed-in users can read photos; photo owners and members of `Admins` can
  create, update, and delete photo records.
- Images are stored under `photos/{identityId}/` in S3. Owners can manage their
  own images; signed-in users can read gallery images; `Admins` can read and
  delete them.
- `GET /health` is public. `GET /me` requires a Cognito user-pool token and
  returns the caller's email and group claims.
- The frontend exposes delete controls to photo owners and members of
  `Admins`; AppSync and S3 authorization remain the enforcement layer.
- The deployment creates a CloudWatch dashboard and a Lambda error alarm. The
  alarm publishes to the SNS topic ARN in `amplify_outputs.json`.

## Console setup and evidence

These deployment/account tasks cannot be completed from the source repository:

- Deploy the backend and frontend, configure Google OAuth credentials and
  callback URLs, and sign in using the live Amplify URL.
- Add your user to the Cognito `Admins` group. Test with a separate user to
  confirm the post-confirmation trigger adds them to `Users`.
- Subscribe an email address to the SNS topic ARN in the generated outputs and
  confirm the subscription. Temporarily cause a REST Lambda error to test the
  alarm, then remove the test change.
- Configure GitHub Actions secret `SNYK_TOKEN`. CodeQL analysis for private
  repositories may require GitHub Advanced Security. Review all four CI jobs
  after pushing to `main`.
- Capture the requested deployment, Cognito, REST, GraphQL/gallery, S3, CI,
  CloudWatch, and live-app screenshots after successful deployment.

Never commit OAuth credentials, Snyk tokens, or generated Amplify outputs.

## Checks

```sh
npm run lint
npm run format:check
npm run build
```

import { requestJson } from './clients/httpClient';

export async function validateCreds(authProfile, onSuccess, onError) {
  try {
    const response = await requestJson('/validate-creds', {
      method: 'POST',
      auth: false,
      body: { authProfile },
    });

    if (onSuccess) {
      onSuccess(response.code, response.message);
    }

    return response;
  } catch (error) {
    if (onError) {
      onError(error);
    }
    throw error;
  }
}

export async function validateAwsCredentialsV2(
  { stackName, authProfile, ...validationOptions },
  onSuccess,
  onError
) {
  try {
    const response = await requestJson('/validateAwsCredentialsV2', {
      method: 'POST',
      auth: false,
      body: {
        authProfile,
        ...(stackName ? { stackName } : {}),
        ...validationOptions,
      },
    });

    if (onSuccess) {
      onSuccess(response);
    }

    return response;
  } catch (error) {
    if (onError) {
      onError(error);
    }
    throw error;
  }
}

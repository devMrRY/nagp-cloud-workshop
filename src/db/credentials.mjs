import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const secretsManager = new SecretsManagerClient({});

export async function getDbCredentials() {
  const response = await secretsManager.send(
    new GetSecretValueCommand({
      SecretId: process.env.DB_SECRET_NAME,
    })
  );

  if (!response.SecretString) {
    throw new Error("SecretString is empty");
  }

  return JSON.parse(response.SecretString);
}
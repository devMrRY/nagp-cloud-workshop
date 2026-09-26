import {
  AutoScalingClient,
  StartInstanceRefreshCommand
} from "@aws-sdk/client-auto-scaling";

const client = new AutoScalingClient({
  region: process.env.AWS_REGION
});

export const handler = async () => {
  const command = new StartInstanceRefreshCommand({
    AutoScalingGroupName: process.env.ASG_NAME,
    Preferences: {
      MinHealthyPercentage: 100,
      InstanceWarmup: 60
    }
  });

  const result = await client.send(command);

  console.log("Instance refresh started:", result.InstanceRefreshId);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "ASG refresh started",
      refreshId: result.InstanceRefreshId
    })
  };
};
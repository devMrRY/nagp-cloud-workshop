# NAGP Cloud Computing Project

## Overview

This project implements a highly available and secure cloud architecture for an insurance self-service portal.

The application allows users to upload insurance documents such as:

* Identity proofs
* Claim forms
* Supporting evidence

The application is deployed on AWS using a VPC-based architecture with public and private subnets, an Application Load Balancer, EC2 Auto Scaling, Amazon S3, AWS Lambda, Amazon RDS PostgreSQL, Secrets Manager, and GitHub Actions.

The deployment architecture is designed so that:

* The application servers are not directly exposed to the internet.
* The Application Load Balancer is the public entry point.
* EC2 instances run in private subnets.
* RDS PostgreSQL runs in private DB subnets.
* Documents are stored in Amazon S3.
* Metadata is stored in PostgreSQL.
* Lambda functions process S3 events.
* New application deployments automatically trigger an EC2 Auto Scaling instance refresh.

---
## Useful Links

- [Project component description documentation](./NAGP%20Cloud%20Computing%20Project.docx)
- [Running Application Demo](https://youtu.be/u93OKjwAda8)
- [AWS Configuration video](https://youtu.be/EC_2ZxzAhmU)
- [Add file metaData to RDS logs](./assets/add-doc-metaData-cloudwatch-logs.png)
- [view RDS records cloudwatch logs](./assets/view-doc-metaData-cloudWatch-logs.png)
- [view trigger-asg-refresh-cloudwatch-logs](./assets/trigger-asg-refresh-cloudwatch-logs.png)
- [github actions workflow](./assets/nagp-github-deployment-workflow.png)
- [vpc subnet route table association](./assets/vpc-subnets-rt-association.png)

---
# Architecture

```text
                            Internet
                              |
                              v
                    +-------------------+
                    | Internet Gateway  |
                    +-------------------+
                              |
                    +---------+---------+
                    |                   |
                    v                   v
             Public Subnet AZ1   Public Subnet AZ2
             eu-north-1a         eu-north-1b
                    |                   |
                    +---------+---------+
                              |
                              v
                    +-------------------+
                    |   Application     |
                    |   Load Balancer   |
                    |    nagp-alb       |
                    +-------------------+
                              |
                         HTTP :4000
                              |
                    +---------+---------+
                    |                   |
                    v                   v
             Private App AZ1      Private App AZ2
             eu-north-1a          eu-north-1b
                    |                   |
              +-----+-----+       +-----+-----+
              |   EC2 #1  |       |   EC2 #2  |
              +-----+-----+       +-----+-----+
                    |                   |
                    +---------+---------+
                              |
                              v
                    +-------------------+
                    |  RDS PostgreSQL   |
                    |  Private DB       |
                    |  Subnet Group     |
                    +-------------------+

                        GitHub
                            │
                            ▼
                        GitHub Actions
                            │
                            OIDC
                            │
                            ▼
                    IAM Deployment Role
                            │
                            ▼
                            S3
        ┌──────────────────────────────────────────────┐
        │                    AWS S3                    │
        │                                              │
        │ uploads/                                     │
        │ deployments/latest.zip                       │
        │ deployments/versions/                        │
        └──────────────┬───────────────────────────────┘
                       │
              ┌────────┴───────────┐
              │                    │
              ▼                    ▼
      S3 Upload Event       Deployment Event
              │                    │
              ▼                    ▼
    add-doc-metadata       trigger-asg-deployment
         Lambda                   Lambda
              │                    │
              │                    ▼
              │             ASG Instance Refresh
              │
              ▼
       Secrets Manager
              │
              ▼
        RDS PostgreSQL

```
![insurance-doc-architecture](./assets/insurance-doc-architecture.png)
---

# AWS Resources

## VPC

The application is deployed inside a dedicated VPC.

```text
VPC CIDR: 10.0.0.0/16
Region: eu-north-1
```

The VPC contains:

* 2 Public Subnets
* 2 Private Application Subnets
* 2 Private Database Subnets

The subnets are distributed across multiple Availability Zones.

---

## Public Subnets

Public subnets contain resources that require connectivity to the Internet Gateway.

### Resources

* Application Load Balancer

The Application Load Balancer acts as the public entry point for the application.

---

## Private Application Subnets

EC2 instances belonging to the Auto Scaling Group are deployed in private application subnets.

The EC2 instances:

* Do not have public IP addresses.
* Run the Node.js application.
* Run PM2 as the process manager.
* Listen on port `4000`.
* Download deployment artifacts from S3.

Traffic to EC2 is allowed only from the Application Load Balancer.

---

## Private Database Subnets

Amazon RDS PostgreSQL is deployed in private DB subnets.

The database is not publicly accessible.

The database security group allows PostgreSQL traffic on port `5432` only from the required Lambda/application security group.

---

# Application Load Balancer

The Application Load Balancer is the public entry point.

```text
Internet
   │
   ▼
ALB :80
   │
   ▼
EC2 :4000
```

The ALB forwards traffic to the EC2 instances in the Auto Scaling Group.

A target group health check is used to determine whether an EC2 instance is healthy.

Only healthy instances receive traffic.

---

# EC2 Auto Scaling Group

The application servers run inside an Auto Scaling Group.

The ASG provides:

* Automatic instance replacement
* Multi-AZ deployment
* Rolling deployments
* Integration with the Application Load Balancer

The application is configured to run using:

```text
Node.js 24
PM2
```

The application starts using:

```bash
pm2 start npm --name nagp-app -- start
```

The application ultimately runs:

```bash
node dist/index.js
```

---

# Rolling Deployment

Deployments are performed using an S3 deployment artifact.

The active artifact is:

```text
deployments/latest.zip
```

Versioned deployment artifacts are stored under:

```text
deployments/versions/
```

Example:

```text
deployments/
├── latest.zip
└── versions/
    ├── deployment-001.zip
    ├── deployment-002.zip
    └── deployment-003.zip
```

---

# Deployment Flow

```text
Developer
    │
    ▼
GitHub
    │
    ▼
GitHub Actions
    │
    ├── Build application
    ├── Create deployment ZIP
    └── Upload ZIP to S3
             │
             ▼
    deployments/latest.zip
             │
             ▼
     S3 ObjectCreated
             │
             ▼
    trigger-asg-deployment
           Lambda
             │
             ▼
    ASG Instance Refresh
             │
             ▼
      Launch New EC2 (with base AMI)
             │
             ▼
       User Data runs
             │
             ├── Download latest.zip
             ├── Extract application
             ├── Create .env
             ├── Start PM2
             └── Start application
             │
             ▼
       ALB Health Check
             │
             ▼
       Instance Healthy
             │
             ▼
       Old Instance
          terminated
```

***Note***:- base AMI was created using another ec2 instance in public subnet which already contains Node.js 24.x, nvm, pm2, unzip

The goal is to ensure that the new instance becomes healthy before the old instance is terminated.

---

# EC2 User Data

When a new EC2 instance is launched, the User Data script:

1. Loads the required Node.js environment.
2. Downloads the latest deployment artifact from S3.
3. Extracts the application.
4. Creates the environment configuration.
5. Starts the Node.js application using PM2.
6. Saves the PM2 process configuration.

The application is deployed under:

```text
/home/ec2-user/app/current
```

---

# Amazon S3

The S3 bucket is used for both document storage and deployment artifacts.

```text
nagp-insurance-docs-160885278821-eu-north-1-an
```

Logical structure:

```text
uploads/
    ├── document-1.pdf
    ├── document-2.jpg
    └── document-3.png

deployments/
    ├── latest.zip
    └── versions/
        ├── deployment-001.zip
        └── deployment-002.zip
```

---

# Document Upload Flow

The browser uploads documents directly to S3 using a presigned URL.

```text
Browser
   │
   │ Request upload URL
   ▼
Node.js Application
   │
   ▼
Presigned S3 URL
   │
   ▼
Browser
   │
   │ Direct upload
   ▼
Amazon S3
```

The application supports documents such as:

```text
PDF
JPG
JPEG
PNG
```

The upload size is limited to:

```text
100 MB
```

---

# S3 Metadata Processing

When a document is uploaded to the `uploads/` prefix, an S3 event triggers the metadata Lambda.

```text
S3
 │
 │ ObjectCreated
 ▼
add-doc-metadata Lambda
 │
 ├── HeadObject
 │
 ├── Read file metadata
 │
 └── Insert metadata
          │
          ▼
     RDS PostgreSQL
```

The metadata stored includes:

```text
id
file_name
content_type
upload_timestamp
```

---

# Lambda Functions

The project contains three Lambda functions.

## 1. add-doc-metadata

Triggered by an S3 object creation event.

Responsibilities:

* Read S3 object metadata.
* Retrieve database credentials.
* Connect to PostgreSQL.
* Insert document metadata into `file_metadata`.

---

## 2. view-doc-metadata

Used to retrieve document metadata from PostgreSQL.

Example query:

```sql
SELECT
    id,
    file_name,
    content_type,
    upload_timestamp
FROM file_metadata
ORDER BY upload_timestamp DESC;
```

The Lambda returns the records as JSON.

---

## 3. trigger-asg-deployment

Triggered when:

```text
deployments/latest.zip
```

is uploaded to S3.

Its responsibility is to start an Auto Scaling Group instance refresh.

```text
S3
 │
 │ latest.zip uploaded
 ▼
trigger-asg-deployment
 │
 ▼
ASG Instance Refresh
```

This Lambda does not use the database code.

---

# Lambda Packaging

The database Lambda functions contain their own shared DB code.

```text
add-doc-metadata.zip
├── index.mjs
└── db/
    ├── credentials.mjs
    └── pool.mjs
```

```text
view-doc-metadata.zip
├── index.mjs
└── db/
    ├── credentials.mjs
    └── pool.mjs
```

The deployment Lambda contains only its handler:

```text
trigger-asg-deployment.zip
└── index.mjs
```

The `pg` package is provided through an AWS Lambda Layer rather than being duplicated in every Lambda ZIP.

---

# Lambda Layer

The PostgreSQL client is provided through a Lambda Layer.

```text
Lambda
   │
   ├── index.mjs
   ├── db/
   │   ├── pool.mjs
   │   └── credentials.mjs
   │
   └── Lambda Layer
         └── pg
```

This keeps the individual Lambda deployment packages smaller.

---

# Secrets Manager

Database credentials are stored in AWS Secrets Manager.

Lambda does not store the PostgreSQL password directly in environment variables.

Lambda environment variables contain:

```text
DB_HOST
DB_PORT
DB_NAME
DB_SECRET_NAME
```

The Lambda retrieves the credentials from Secrets Manager at runtime.

```text
Lambda
   │
   ▼
Secrets Manager
   │
   ├── username
   └── password
   │
   ▼
PostgreSQL connection
```

---

# Database

The application uses Amazon RDS PostgreSQL.

```text
Engine: PostgreSQL
Port: 5432
```

The database is deployed in private subnets and is not directly accessible from the public internet.

The primary table used by the document metadata functionality is:

```sql
file_metadata
```

Example structure:

```sql
CREATE TABLE file_metadata (
    id SERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    content_type TEXT,
    upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

# Networking

## Route Tables

### Public Route Table

```text
0.0.0.0/0 → Internet Gateway
```

Used by public subnets containing:

* ALB

### Private Application Route Table

```text
pl-c3aa4faa(s3 prefixed list) -> vpce-0eff6198e67d967ce (s3 vpc endpoint)
10.0.0.0/16 -> local
```

This allows EC2 instances to make outbound internet connections without exposing them publicly.

### Private Database Route Table

```text
Database subnets do not require internet access.
10.0.0.0/16 -> local
```
---

# VPC Endpoints

VPC endpoints provide private connectivity to AWS services without requiring a NAT Gateway.

| Endpoint                  | Type      | Service         | Purpose                                      |
| ------------------------- | --------- | --------------- | -------------------------------------------- |
| `nagp-s3-endpoint`        | Gateway   | S3              | Private S3 access from EC2                   |
| `secretsmanager-endpoint` | Interface | Secrets Manager | Private access to DB credentials from Lambda |

### S3 Gateway Endpoint

* ID: `vpce-0eff6198e67d967ce`
* Status: Available
* Associated with the private application route table.
* Allows EC2 instances in private subnets to access S3 without internet/NAT.

### Secrets Manager Interface Endpoint

* ID: `vpce-01b281ec2f20cab17`
* Status: Available
* Provides private HTTPS connectivity to Secrets Manager for VPC-connected Lambda functions.
* Used to retrieve database credentials without requiring a NAT Gateway.
---

# Security Groups

Security Groups are used as the primary resource-level firewall.

## ALB Security Group

Allows:

```text
HTTP  :80   ← Internet
```

Outbound traffic is allowed toward the application servers.

---

## EC2 Security Group

Allows:

```text
TCP :4000 ← ALB Security Group
```

EC2 does not allow application traffic directly from the public internet.

---

## RDS Security Group

Allows:

```text
TCP :5432 ← Lambda/Application Security Group
```

The database is therefore isolated from the internet.

---

## Lambda Security Group

Allows outbound connectivity to:

```text
RDS :5432
Secrets Manager VPC Endpoint :443
```

---

# Network ACLs

The VPC uses the default Network ACL configuration unless a more restrictive subnet-level policy is required.

Security Groups provide the main resource-level access control.

---

# IAM Configuration

IAM is used to control access to AWS resources using users, groups, roles, and policies.

### IAM User and Group

| Resource  | Configuration |
| --------- | ------------- |
| IAM User  | `nagp-dev`    |
| IAM Group | `dev-group`   |

The `nagp-dev` user is a member of `dev-group` and receives permissions through the group.

### `dev-group` Policies

The development group has the following AWS managed policies:

| Policy                           | Type        | Purpose                                      |
| -------------------------------- | ----------- | -------------------------------------------- |
| `AmazonS3FullAccess`             | AWS managed | S3 resource management                       |
| `AWSLambda_FullAccess`           | AWS managed | Lambda management                            |
| `CloudWatchFullAccessV2`         | AWS managed | CloudWatch monitoring and logs               |
| `IAMReadOnlyAccess`              | AWS managed | Read-only IAM access                         |

The group also contains the customer-managed inline policy:

* `SecretsCreate` — permissions required to create/manage the Secrets Manager resources used by the application.

### IAM Roles

| Role                                   | Used By        | Purpose                                              |
| -------------------------------------- | -------------- | ---------------------------------------------------- |
| `InstanceRole`                         | EC2            | Provides EC2 access to required AWS services         |
| `add-doc-metaData`                     | Lambda         | Processes uploaded document metadata                 |
| `getSqsMessages-role-48etx8sj`         | Lambda         | Processes SQS messages                               |
| `trigger-asg-deployment-role-rlgjt11v` | Lambda         | Triggers ASG instance refresh                        |
| `GitHubActionsDeployToS3`              | GitHub Actions | Uploads deployment artifacts to S3 using GitHub OIDC |

AWS service-linked roles for Auto Scaling, Elastic Load Balancing, RDS, Resource Explorer, Support, and Trusted Advisor are managed automatically by AWS.


### EC2 Instance Role

Name: instanceRole

Used by EC2 to access required AWS resources such as:

```text
S3
SSM
CloudWatch
```

The EC2 role has permissions required to download:

```text
deployments/latest.zip
```

from S3.

---

### Lambda Execution Roles

Lambda execution roles provide permissions for:

* S3 access
* Secrets Manager access
* RDS-related operations where applicable
* Auto Scaling instance refresh

Permissions should follow the principle of least privilege.

---

# GitHub Actions Deployment

GitHub Actions is used for CI/CD.

The deployment flow is:

```text
Git Push
   │
   ▼
GitHub Actions
   │
   ├── npm install
   ├── TypeScript build
   ├── Copy static files
   ├── Copy Lambda handlers
   ├── Create ZIP
   │
   ▼
AWS IAM OIDC
   │
   ▼
GitHub Actions IAM Role
   │
   ▼
Amazon S3
```

GitHub Actions authenticates to AWS using OIDC rather than storing long-lived AWS access keys in GitHub.

![nagp-github-deployment-workflow](./assets/nagp-github-deployment-workflow.png)

Repository:

[devMrRY/nagp-cloud-workshop](https://github.com/devMrRY/nagp-cloud-workshop)

Main deployment branch:

```text
main
```

---

# Getting Started - Local Development

## Prerequisites

* Node.js 24
* npm 10+
* PostgreSQL (for database operations)

## Installation

Clone the [repository](https://github.com/devMrRY/nagp-cloud-workshop) and install dependencies:

```bash
npm install
```

## Environment Setup

Create a `.env` file in the root directory with the required environment variables:

```env
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/nagp_db
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your-bucket-name
```

## Running on Localhost

### Development Mode

Run the application in development mode with hot-reload:

```bash
npm run dev
```

This starts:
* TypeScript compiler in watch mode
* Nodemon to restart on code changes
* Chokidar to watch for public file changes

The application will run at:

```
http://localhost:4000
```

### Production Build

Build the application for production:

```bash
npm run build
```

This creates:
* `dist/` folder with compiled JavaScript
* `dist/public/` with static files (HTML, CSS, JS)

### Run Production Build

Start the compiled application:

```bash
npm start
```

The application will run at:

```
http://localhost:4000
```

## Accessing the Application

Once running, open your browser and navigate to:

```
http://localhost:4000
```

You should see the Insurance Document Upload page.

---

# Lambda Packaging

Lambda packages can be generated using:

```bash
npm run package:lambdas
```

This creates:

```text
add-doc-metadata.zip
view-doc-metadata.zip
trigger-asg-deployment.zip
```

The database Lambdas include:

```text
db/
├── credentials.mjs
└── pool.mjs
```

The deployment Lambda does not include the DB directory.

---

# Environment Variables

The application uses environment variables rather than hardcoding configuration.

Example:

```env
PORT=4000
AWS_REGION=eu-north-1
S3_BUCKET=nagp-insurance-docs-160885278821-eu-north-1-an
```

Lambda database configuration:

```env
DB_HOST=<RDS_ENDPOINT>
DB_PORT=5432
DB_NAME=<DATABASE_NAME>
DB_SECRET_NAME=<SECRET_NAME>
```

Sensitive values such as the database name and password are stored in Secrets Manager.

---

# Application Health Check

The Node.js server listens on:

```text
0.0.0.0:4000
```

The ALB target group (nagp-app-tg) performs health checks against the application.

The application should return a successful HTTP response from the configured health-check path.

Traffic flow:

```text
ALB
 │
 │ HTTP :4000
 ▼
EC2
 │
 ▼
Node.js application
```

The ASG uses the ALB target health status when performing rolling instance replacement.

![nagp-app-tg-view](./assets/nagp-app-tg-view.png)
---

# Graceful Shutdown

The Node.js application handles shutdown signals from the operating system.

```text
SIGTERM
   │
   ▼
server.close()
   │
   ▼
Existing connections finish
   │
   ▼
Process exits
```

This is important during Auto Scaling instance refresh because the old EC2 instance is eventually terminated.

---

# High Availability

The architecture improves availability through multiple Availability Zones.

```text
                ALB
             /       \
            /         \
       AZ-1             AZ-2
        │                 │
     EC2/ASG           EC2/ASG
        │                 │
        └───────┬─────────┘
                │
              RDS
```

The Auto Scaling Group can launch instances across multiple Availability Zones by Balanced best effort.

The ALB distributes traffic only to healthy instances.

---

# Deployment Strategy

The deployment uses an instance refresh instead of manually replacing EC2 instances.

### Deployment sequence

```text
1. Developer pushes code
        ↓
2. GitHub Actions builds application
        ↓
3. ZIP uploaded to S3
        ↓
4. latest.zip created
        ↓
5. S3 event triggers Lambda (trigger-asg-deployment)
        ↓
6. Lambda starts ASG instance refresh
        ↓
7. New EC2 instance launches
        ↓
8. User Data downloads latest.zip
        ↓
9. Application starts with PM2
        ↓
10. ALB performs health check
        ↓
11. New instance becomes healthy
        ↓
12. Old instance is terminated
```

This provides a rolling deployment mechanism with minimal application downtime.

---

# Project Structure

```text
nagp-cloud-workshop/
│
├── src/
│   ├── controller/
│   │
│   ├── db/
│   │   ├── credentials.mts
│   │   └── pool.mts
│   │
│   ├── lambda/
│   │   ├── add-doc-metadata/
│   │   │   └── index.mjs
│   │   │
│   │   ├── view-doc-metadata/
│   │   │   └── index.mjs
│   │   │
│   │   └── trigger-asg-deployment/
│   │       └── index.mjs
│   │
│   ├── public/
│   │
│   └── scripts/
│       └── package-lambdas.js
|       |__ userdata.sh   
│
├── dist/
│
├── package.json
├── tsconfig.json
└── README.md
```

---

# CloudWatch Monitoring & Alarms

Amazon CloudWatch is used to monitor the Auto Scaling Group and Application Load Balancer through alarms and a monitoring dashboard.

## CloudWatch Alarms

| Alarm                                                                                                                                                                                                              | Condition              | Evaluation                      | State             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ------------------------------- | ----------------- |
| [TargetTracking-nagp-app-asg-AlarmHigh](https://eu-north-1.console.aws.amazon.com/cloudwatch/home?region=eu-north-1#alarmsV2%3Aalarm%2FTargetTracking-nagp-app-asg-AlarmHigh-6954ccaa-7e42-4674-aa62-2d9793e4918f) | CPUUtilization > 60%   | 3 datapoints within 3 minutes   | OK                |
| [TargetTracking-nagp-app-asg-AlarmLow](https://eu-north-1.console.aws.amazon.com/cloudwatch/home?region=eu-north-1#alarmsV2%3Aalarm%2FTargetTracking-nagp-app-asg-AlarmLow-1bb56cbe-e97e-478e-8617-951ca31f57a2)   | CPUUtilization < 42%   | 15 datapoints within 15 minutes | Insufficient data |
| [ALB UnhealthyHostCount > 0](https://eu-north-1.console.aws.amazon.com/cloudwatch/home?region=eu-north-1#alarmsV2%3Aalarm%2FALB%2BUnhealthyHostCount%2B%243E%2B0)                                                  | UnHealthyHostCount > 0 | 1 datapoint within 1 minute     | Insufficient data |

The Auto Scaling alarms are used by the target-tracking scaling policy to adjust the desired capacity of the `nagp-app-asg` based on EC2 CPU utilization.

The ALB alarm monitors the health of registered EC2 targets and identifies when one or more application instances become unhealthy.

## CloudWatch Dashboard

The monitoring dashboard provides visibility into application and infrastructure health through the following widgets:

* **CPU Utilization** — Gauge showing EC2 CPU utilization, monitored at 1-minute intervals.
* **Healthy Host Count** — Pie chart showing the number of healthy targets registered with the ALB.
* **Unhealthy Host Count** — Pie chart showing the number of unhealthy targets registered with the ALB.
* **Request Count** — Line graph showing the number of requests received by the ALB over time.

These metrics provide a view of **instance resource utilization, target health, and application traffic**.

![nagp-insurance-cloudwatch-dashboard](./assets/nagp-insurance-cloudwatch-dashboard.png)
---

# AWS Service Summary

| Service                   | Purpose                                           |
| ------------------------- | ------------------------------------------------- |
| Amazon VPC                | Network isolation                                 |
| Internet Gateway          | Internet connectivity for public subnets          |
| Application Load Balancer | Public application entry point                    |
| EC2                       | Application servers                               |
| Auto Scaling Group        | Scaling and instance replacement                  |
| Amazon S3                 | Document and deployment artifact storage          |
| AWS Lambda                | Event-driven processing and deployment automation |
| Amazon RDS PostgreSQL     | Metadata database                                 |
| AWS Secrets Manager       | Database credentials                              |
| IAM                       | Access control                                    |
| Lambda Layer              | Shared `pg` dependency                            |
| GitHub Actions            | CI/CD                                             |
| IAM OIDC                  | Keyless GitHub-to-AWS authentication              |
| CloudWatch                | Logging, monitoring, alert and analysis dashboard |
| Network ACL               | Subnet-level traffic filtering                    |
| Security Groups           | Resource-level firewall                           |

---

# Security Design

The architecture follows several security principles:

### No public EC2 instances

EC2 instances run in private subnets.

### No public RDS

The PostgreSQL database runs in private DB subnets.

### ALB as public entry point

Internet traffic reaches the application through the ALB.

### Restricted Security Groups

Traffic is allowed only between required resources.

### Secrets Manager

Database passwords are not stored directly in application code.

### IAM Roles

AWS services use IAM roles instead of hardcoded AWS credentials.

### GitHub OIDC

GitHub Actions uses short-lived AWS credentials through OIDC.

### S3 Direct Upload

Documents can be uploaded directly to S3 using presigned URLs.

---

# Future Improvements

Possible improvements include:

* HTTPS using ACM certificates.
* Route 53 custom domain.
* WAF in front of the ALB.
* CloudFront for static content.
* Two NAT Gateways for multi-AZ NAT availability.
* More restrictive Network ACLs.
* Automated database migrations.
* Blue/green deployment strategy.

---

# Conclusion

This project demonstrates a complete AWS cloud architecture for a secure and scalable insurance document portal.

The architecture combines:

```text
VPC
│
├── Public Subnets
│   ├── ALB
│
├── Private App Subnets
│   └── EC2 + ASG + Node.js + PM2
│
├── Private DB Subnets
│   └── RDS PostgreSQL
│
├── S3
│   ├── Documents
│   └── Deployment Artifacts
│
├── Lambda
│   ├── Metadata Processing
│   ├── Metadata Retrieval
│   └── Deployment Automation
│
├── Secrets Manager
│
├── IAM
│
└── GitHub Actions + OIDC
```

The resulting architecture provides network isolation, automated deployments, scalable application servers, private database access, event-driven processing, and controlled outbound internet connectivity.

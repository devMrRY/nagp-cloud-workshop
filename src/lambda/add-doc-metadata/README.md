Runtime: Node.js 24.x
Architecture: arm64
Handler: index.handler
Layer: pg
VPC: NAGP VPC
Subnets: nagp-app-1, nagp-app-2
Security Group: nagp-lambda-sg
Trigger: S3 ObjectCreated
Database: PostgreSQL RDS
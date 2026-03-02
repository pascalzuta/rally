# AWS Architecture Documentation -- Green Room Partners

## Table of Contents

1. [Overview](#1-overview)
2. [AWS Services Inventory](#2-aws-services-inventory)
3. [Architecture Diagram](#3-architecture-diagram)
4. [VPC Network Layout](#4-vpc-network-layout)
5. [CI/CD Pipeline](#5-cicd-pipeline)
6. [Data Flow](#6-data-flow)
7. [Security Architecture](#7-security-architecture)
8. [RDS Configuration](#8-rds-configuration)
9. [Auto Scaling Configuration](#9-auto-scaling-configuration)
10. [Cost Estimation](#10-cost-estimation)
11. [Disaster Recovery](#11-disaster-recovery)

---

## 1. Overview

Green Room Partners (GRP) is a financial services website deployed on Amazon Web Services (AWS). The platform serves investment approach content, team profiles, news articles, and a contact interface backed by a content management system.

**Environment Strategy:**

- **Production** -- PostgreSQL on Amazon RDS (Multi-AZ) for durability, consistency, and scalability.
- **Development** -- SQLite for rapid local iteration with zero infrastructure overhead.

**Architecture Principles:**

- **Security-first** -- Defense in depth with WAF, encryption at rest and in transit, least-privilege IAM, and private subnets for all application and data tiers.
- **Scalability** -- Auto Scaling Groups and ElastiCache absorb traffic spikes without manual intervention.
- **Cost-efficiency** -- Right-sized instances, reserved capacity where predictable, and S3 lifecycle policies to minimize storage costs.
- **High availability** -- Multi-AZ deployments across all stateful layers with automated failover.

---

## 2. AWS Services Inventory

| Layer | Service | Purpose | Configuration Notes |
|-------|---------|---------|---------------------|
| DNS | Route 53 | Domain routing, health checks, failover | Alias records to CloudFront; health checks on ALB with 10s interval, 3-failure threshold; latency-based routing for multi-region readiness |
| CDN/Edge | CloudFront | Static asset distribution, SSL termination, WAF integration | Origin groups (S3 + ALB); TTL 86400s for static assets, 0s for dynamic; gzip/Brotli compression enabled; price class 100 (US/EU) |
| Security | WAF (Web Application Firewall) | Rate limiting, SQL injection and XSS protection, geo-blocking | AWS Managed Rules (AWSManagedRulesCommonRuleSet, AWSManagedRulesSQLiRuleSet); rate limit 2000 req/5min per IP; geo-block sanctioned countries |
| Security | AWS Certificate Manager (ACM) | Free SSL/TLS certificates for CloudFront and ALB | Wildcard certificate for *.greenroompartners.com; auto-renewal enabled; us-east-1 for CloudFront, regional for ALB |
| Security | AWS Secrets Manager | Database credentials, API keys with automatic rotation | 30-day rotation for RDS credentials; Lambda-based rotation function; versioned secrets with staging labels |
| Security | AWS KMS (Key Management Service) | Encryption key management for RDS, S3, and Secrets Manager | Customer-managed CMK with annual rotation; separate keys per service; key policies scoped to service roles |
| Security | AWS IAM | Role-based access, least-privilege policies | Instance profiles for EC2; service-linked roles for RDS/ElastiCache; MFA enforced for console access; no long-lived access keys |
| Load Balancing | Application Load Balancer (ALB) | HTTPS routing, health checks, sticky sessions | HTTPS listener (443) with ACM cert; HTTP (80) redirects to HTTPS; target group health check on /health every 30s; sticky sessions via app cookie |
| Compute | EC2 Auto Scaling Group | Web tier instances (t3.medium), min 2 / max 8 | Amazon Linux 2023 AMI; launch template with user data bootstrap; spread placement across 2 AZs; mixed instances policy for cost optimization |
| Caching | ElastiCache (Redis) | Session store, query result caching, page fragment caching | Redis 7.x, cache.t3.medium; cluster mode disabled; 1 primary + 1 replica across AZs; eviction policy: allkeys-lru; encryption in transit |
| Database | RDS (PostgreSQL 16) | Multi-AZ, automated backups, encrypted storage, read replicas | db.t3.medium; gp3 storage (20 GB, auto-scaling to 100 GB); 7-day backup retention; Performance Insights enabled; Enhanced Monitoring 60s |
| Storage | S3 | Static assets, CMS uploads, database backups, CloudFront origin | Versioning enabled on backup bucket; lifecycle rules (IA after 30 days, Glacier after 90 days); CORS for direct uploads; bucket policy restricts to CloudFront OAI |
| Monitoring | CloudWatch | Metrics, alarms, log aggregation, dashboards | Custom dashboard for key metrics; alarms on CPU, memory, 5xx rate, RDS connections; log groups with 30-day retention; metric filters for error patterns |
| Monitoring | AWS X-Ray | Distributed tracing for performance analysis | Sampling rate 5% in production; trace map for service dependencies; annotations on slow queries (>500ms); integrated with ALB and EC2 |
| CI/CD | CodePipeline + CodeBuild | Automated build, test, and deployment pipeline | Source stage from GitHub (webhook); build stage runs linting, unit tests, integration tests; artifact stored in S3; manual approval gate before production |
| CI/CD | CodeDeploy | Rolling deployments to EC2 instances | Deployment group targets ASG; rolling update (one-at-a-time); automatic rollback on failure; lifecycle hooks for pre/post install validation |
| Networking | VPC | Isolated network with public/private subnets across 2 AZs | CIDR 10.0.0.0/16; 6 subnets (2 public, 2 private, 2 data); VPC flow logs to CloudWatch; DNS hostnames enabled |
| Networking | NAT Gateway | Outbound internet for private subnet resources | One NAT Gateway per AZ for high availability; Elastic IP attached; used by EC2 and Lambda for outbound API calls and package downloads |

---

## 3. Architecture Diagram

```
                                    Internet
                                       │
                                       │
                                ┌──────▼──────┐
                                │  Route 53   │
                                │   (DNS)     │
                                │             │
                                │ Health Check│
                                │ Failover    │
                                └──────┬──────┘
                                       │
                                       │ Alias Record
                                       │
                                ┌──────▼──────┐
                                │ CloudFront  │
                                │   (CDN)     │
                                │             │
                                │  SSL/TLS    │
                                │  + WAF      │
                                │  + Gzip     │
                                └──────┬──────┘
                                       │
                           ┌───────────┴───────────┐
                           │   Static Assets?      │
                      Yes  │                       │  No
                      ┌────▼────┐           ┌──────▼──────┐
                      │   S3    │           │    ALB      │
                      │ Bucket  │           │  (HTTPS)    │
                      │         │           │             │
                      │ OAI     │           │ Health      │
                      │ Access  │           │ Checks      │
                      └─────────┘           └──────┬──────┘
                                                   │
                                      ┌────────────┴────────────┐
                                      │                         │
                                ┌─────▼─────┐           ┌──────▼─────┐
                                │ EC2 (AZ-a)│           │ EC2 (AZ-b) │
                                │ Web Tier  │           │ Web Tier   │
                                │           │           │            │
                                │ t3.medium │           │ t3.medium  │
                                │ (ASG)     │           │ (ASG)      │
                                └─────┬─────┘           └──────┬─────┘
                                      │                        │
                                ┌─────▼────────────────────────▼─────┐
                                │       ElastiCache (Redis)          │
                                │       Session + Query Cache        │
                                │                                    │
                                │   Primary (AZ-b) ──▶ Replica (AZ-a)│
                                └──────────────────┬─────────────────┘
                                                   │
                                ┌──────────────────▼─────────────────┐
                                │     RDS PostgreSQL 16 (Multi-AZ)   │
                                │                                    │
                                │   Primary (AZ-a) ◀──▶ Standby (AZ-b)│
                                │                                    │
                                │   Encrypted (KMS) │ Auto Backup    │
                                └────────────────────────────────────┘
```

---

## 4. VPC Network Layout

```
┌──────────────────────────────── VPC (10.0.0.0/16) ────────────────────────────────┐
│                                                                                    │
│  Internet Gateway                                                                  │
│       │                                                                            │
│  ┌────┴──── Availability Zone A ────────┐    ┌──── Availability Zone B ──────────┐ │
│  │                                      │    │                                    │ │
│  │  Public Subnet (10.0.1.0/24)         │    │  Public Subnet (10.0.2.0/24)       │ │
│  │  ┌───────────┐  ┌─────────────┐      │    │  ┌───────────┐  ┌─────────────┐   │ │
│  │  │  ALB      │  │  NAT GW     │      │    │  │  ALB      │  │  NAT GW     │   │ │
│  │  │  (node)   │  │  (EIP)      │      │    │  │  (node)   │  │  (EIP)      │   │ │
│  │  └───────────┘  └──────┬──────┘      │    │  └───────────┘  └──────┬──────┘   │ │
│  │                        │              │    │                        │           │ │
│  │  Private Subnet (10.0.3.0/24)        │    │  Private Subnet (10.0.4.0/24)      │ │
│  │  ┌───────────┐  ┌─────────────┐      │    │  ┌───────────┐  ┌─────────────┐   │ │
│  │  │  EC2      │  │  Redis      │      │    │  │  EC2      │  │  Redis      │   │ │
│  │  │  (ASG)    │  │  (replica)  │      │    │  │  (ASG)    │  │  (primary)  │   │ │
│  │  └───────────┘  └─────────────┘      │    │  └───────────┘  └─────────────┘   │ │
│  │                                      │    │                                    │ │
│  │  Data Subnet (10.0.5.0/24)           │    │  Data Subnet (10.0.6.0/24)         │ │
│  │  ┌──────────────────────────────┐    │    │  ┌──────────────────────────────┐  │ │
│  │  │  RDS Primary (PostgreSQL 16) │    │    │  │  RDS Standby (Sync Replica)  │  │ │
│  │  └──────────────────────────────┘    │    │  └──────────────────────────────┘  │ │
│  │                                      │    │                                    │ │
│  └──────────────────────────────────────┘    └────────────────────────────────────┘ │
│                                                                                    │
│  Route Tables:                                                                     │
│    Public:  0.0.0.0/0 ──▶ Internet Gateway                                        │
│    Private: 0.0.0.0/0 ──▶ NAT Gateway (per AZ)                                    │
│    Data:    No internet route (isolated)                                            │
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. CI/CD Pipeline

```
┌──────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌──────────┐
│  GitHub  │───▶│ CodePipeline  │───▶│  CodeBuild    │───▶│  CodeDeploy   │───▶│   EC2    │
│  (push)  │    │  (trigger)    │    │  (test+build) │    │  (rolling)    │    │  (ASG)   │
└──────────┘    └───────────────┘    └───────┬───────┘    └───────────────┘    └────┬─────┘
                                             │                                      │
                                     ┌───────▼──────────┐                  ┌────────▼────────┐
                                     │ S3 (artifacts)   │                  │  CloudFront     │
                                     │ + static assets  │                  │  Invalidation   │
                                     └──────────────────┘                  └─────────────────┘
```

### Pipeline Stages

| Stage | Tool | Actions | Duration |
|-------|------|---------|----------|
| **Source** | GitHub (webhook) | Checkout code on push to `main` | ~10s |
| **Build** | CodeBuild | Install dependencies, lint, run unit tests, build production assets | ~3 min |
| **Test** | CodeBuild | Run integration tests against staging database | ~2 min |
| **Approval** | Manual Gate | Slack notification; requires manual approval for production | Variable |
| **Deploy** | CodeDeploy | Rolling deploy to EC2 ASG (one instance at a time) | ~5 min |
| **Post-Deploy** | CodeBuild | Upload static assets to S3; invalidate CloudFront cache; run smoke tests | ~2 min |

### Deployment Configuration

```yaml
# appspec.yml
version: 0.0
os: linux
files:
  - source: /
    destination: /var/www/grp
hooks:
  BeforeInstall:
    - location: scripts/stop_server.sh
      timeout: 30
  AfterInstall:
    - location: scripts/install_deps.sh
      timeout: 120
  ApplicationStart:
    - location: scripts/start_server.sh
      timeout: 30
  ValidateService:
    - location: scripts/health_check.sh
      timeout: 60
```

### Rollback Strategy

- **Automatic rollback** triggers if the health check fails during deployment.
- CodeDeploy reverts to the last successful revision.
- CloudFront continues serving cached content during rollback.
- Slack alert sent to the engineering channel on rollback.

---

## 6. Data Flow

### Complete Request Lifecycle

```
┌──────────┐
│  User    │
│ Browser  │
└────┬─────┘
     │  HTTPS Request
     │
┌────▼─────────────────────────────────────────────────────────────────────┐
│ 1. Route 53                                                              │
│    - DNS resolution (Alias to CloudFront)                                │
│    - Health check passes ──▶ route to primary distribution               │
└────┬─────────────────────────────────────────────────────────────────────┘
     │
┌────▼─────────────────────────────────────────────────────────────────────┐
│ 2. CloudFront Edge Location                                              │
│    - WAF inspection (rate limit, SQL injection, XSS checks)              │
│    - Cache HIT? ──▶ Return cached response (latency < 10ms)             │
│    - Cache MISS? ──▶ Forward to origin                                   │
│    - Static asset (*.css, *.js, images)? ──▶ Route to S3 origin          │
│    - Dynamic request? ──▶ Route to ALB origin                            │
└────┬──────────────────────┬──────────────────────────────────────────────┘
     │ Dynamic              │ Static
     │                      │
     │                 ┌────▼────┐
     │                 │   S3    │
     │                 │ Bucket  │──▶ Return asset to CloudFront ──▶ User
     │                 └─────────┘
     │
┌────▼─────────────────────────────────────────────────────────────────────┐
│ 3. Application Load Balancer                                             │
│    - TLS termination (ACM certificate)                                   │
│    - Health check: /health endpoint on target instances                  │
│    - Route to healthy EC2 instance (round-robin)                         │
│    - Sticky session via application cookie (if session active)           │
└────┬─────────────────────────────────────────────────────────────────────┘
     │
┌────▼─────────────────────────────────────────────────────────────────────┐
│ 4. EC2 Instance (Application Layer)                                      │
│    - Node.js application processes request                               │
│    - Check ElastiCache (Redis) for cached response                       │
│      - Cache HIT ──▶ Return cached data                                  │
│      - Cache MISS ──▶ Query PostgreSQL                                   │
│    - Session validation via Redis session store                          │
└────┬─────────────────────────────────────────────────────────────────────┘
     │
┌────▼─────────────────────────────────────────────────────────────────────┐
│ 5. ElastiCache (Redis)                                                   │
│    - Session lookup (TTL: 24 hours)                                      │
│    - Query cache lookup (TTL: 5 minutes for news, 1 hour for pages)      │
│    - Page fragment cache (TTL: 15 minutes)                               │
└────┬─────────────────────────────────────────────────────────────────────┘
     │ Cache MISS
     │
┌────▼─────────────────────────────────────────────────────────────────────┐
│ 6. RDS PostgreSQL                                                        │
│    - Query execution on primary instance                                 │
│    - Read replicas handle read-heavy queries (news listing, team data)   │
│    - Results returned to application ──▶ stored in Redis cache           │
└──────────────────────────────────────────────────────────────────────────┘
     │
     │  Response travels back: RDS ──▶ EC2 ──▶ ALB ──▶ CloudFront ──▶ User
     ▼
```

### CMS Content Upload Flow

```
CMS Admin ──▶ ALB ──▶ EC2 ──▶ S3 (presigned URL upload)
                                  │
                                  ▼
                          CloudFront Invalidation
                                  │
                                  ▼
                          Updated content served globally
```

---

## 7. Security Architecture

### 7.1 WAF Rules

| Rule | Type | Configuration | Action |
|------|------|---------------|--------|
| Rate Limiting | Rate-based | 2,000 requests per 5 minutes per IP | Block for 5 minutes |
| SQL Injection | AWS Managed | AWSManagedRulesSQLiRuleSet | Block |
| XSS Protection | AWS Managed | AWSManagedRulesCommonRuleSet | Block |
| Known Bad Inputs | AWS Managed | AWSManagedRulesKnownBadInputsRuleSet | Block |
| Bot Control | AWS Managed | AWSManagedRulesBotControlRuleSet | Count (monitor) |
| Geo-Blocking | Custom | Block OFAC-sanctioned countries | Block |
| Request Size | Custom | Body size limit: 8 KB | Block |
| URI Path | Custom | Block /wp-admin, /xmlrpc.php, /.env | Block |

### 7.2 Security Groups

**ALB Security Group (`sg-alb`)**

| Direction | Protocol | Port | Source/Destination | Purpose |
|-----------|----------|------|--------------------|---------|
| Inbound | TCP | 443 | 0.0.0.0/0 | HTTPS from internet |
| Inbound | TCP | 80 | 0.0.0.0/0 | HTTP (redirect to HTTPS) |
| Outbound | TCP | 443 | sg-ec2 | Forward to EC2 instances |

**EC2 Security Group (`sg-ec2`)**

| Direction | Protocol | Port | Source/Destination | Purpose |
|-----------|----------|------|--------------------|---------|
| Inbound | TCP | 443 | sg-alb | HTTPS from ALB only |
| Outbound | TCP | 6379 | sg-redis | Connect to Redis |
| Outbound | TCP | 5432 | sg-rds | Connect to PostgreSQL |
| Outbound | TCP | 443 | 0.0.0.0/0 | Outbound HTTPS (via NAT) |

**RDS Security Group (`sg-rds`)**

| Direction | Protocol | Port | Source/Destination | Purpose |
|-----------|----------|------|--------------------|---------|
| Inbound | TCP | 5432 | sg-ec2 | PostgreSQL from EC2 only |
| Outbound | None | -- | -- | No outbound required |

**Redis Security Group (`sg-redis`)**

| Direction | Protocol | Port | Source/Destination | Purpose |
|-----------|----------|------|--------------------|---------|
| Inbound | TCP | 6379 | sg-ec2 | Redis from EC2 only |
| Outbound | None | -- | -- | No outbound required |

### 7.3 IAM Roles and Policies

| Role | Attached To | Permissions | Scope |
|------|------------|-------------|-------|
| `grp-ec2-role` | EC2 Instance Profile | S3 read (assets bucket), Secrets Manager read, CloudWatch write, X-Ray write | Resource-scoped ARNs |
| `grp-codebuild-role` | CodeBuild | S3 read/write (artifact bucket), ECR pull, CloudWatch write | Project-scoped |
| `grp-codedeploy-role` | CodeDeploy | EC2 describe, ASG update, S3 read (artifact bucket) | Service-linked |
| `grp-rds-monitoring-role` | RDS Enhanced Monitoring | CloudWatch write (RDS metrics) | Service-linked |
| `grp-lambda-rotation-role` | Secrets Manager rotation Lambda | Secrets Manager read/write, RDS connect | Secret-scoped ARN |

**Policy Principles:**
- No wildcard (`*`) resource permissions.
- All policies use explicit `Deny` for sensitive actions.
- MFA required for all IAM console users.
- Access keys rotated every 90 days (enforced via SCP).
- Service control policies (SCPs) prevent disabling CloudTrail or modifying critical security configurations.

### 7.4 Encryption

| Layer | Mechanism | Details |
|-------|-----------|---------|
| **RDS at rest** | AES-256 via KMS CMK | Customer-managed key; automatic rotation annually |
| **S3 at rest** | SSE-S3 (AES-256) | Default encryption on all buckets; bucket policy denies unencrypted uploads |
| **EBS at rest** | AES-256 via KMS CMK | Encrypted volumes on all EC2 instances; enforced via SCP |
| **ElastiCache at rest** | AES-256 | Redis encryption-at-rest enabled |
| **In transit (external)** | TLS 1.2+ | CloudFront and ALB enforce minimum TLS 1.2; HSTS header enabled |
| **In transit (internal)** | TLS 1.2+ | Redis in-transit encryption; RDS SSL enforced (`rds.force_ssl = 1`) |
| **Secrets Manager** | AES-256 via KMS CMK | Encrypted secrets with automatic 30-day rotation for RDS credentials |

### 7.5 Secrets Manager Rotation

| Secret | Rotation Interval | Rotation Method |
|--------|-------------------|-----------------|
| RDS master credentials | 30 days | Lambda (single-user rotation) |
| RDS application credentials | 30 days | Lambda (alternating-user rotation) |
| API keys (third-party) | 90 days | Lambda (custom rotation function) |
| Redis AUTH token | 90 days | Manual (coordinated with ElastiCache) |

### 7.6 VPC Flow Logs

- **Destination:** CloudWatch Logs (`/vpc/flowlogs/grp-production`)
- **Traffic type:** ALL (accepted and rejected)
- **Retention:** 90 days
- **Metric filters:** Alert on rejected traffic spikes from single IP (potential scan)
- **Integration:** CloudWatch Insights queries for security analysis

---

## 8. RDS Configuration

### Instance Specification

| Parameter | Production | Staging |
|-----------|------------|---------|
| Engine | PostgreSQL 16.x | PostgreSQL 16.x |
| Instance class | db.t3.medium (2 vCPU, 4 GB RAM) | db.t3.micro (2 vCPU, 1 GB RAM) |
| Multi-AZ | Enabled (synchronous standby) | Disabled |
| Storage type | gp3 | gp3 |
| Storage size | 20 GB initial, auto-scaling to 100 GB | 20 GB |
| Storage IOPS | 3,000 baseline (gp3 default) | 3,000 baseline |
| Encryption | KMS CMK (AES-256) | KMS CMK (AES-256) |
| Backup retention | 7 days automated | 3 days automated |
| Backup window | 03:00 -- 04:00 UTC (off-peak) | 03:00 -- 04:00 UTC |
| Maintenance window | Sun 05:00 -- 06:00 UTC | Sun 05:00 -- 06:00 UTC |
| Performance Insights | Enabled (7-day retention) | Disabled |
| Enhanced Monitoring | 60-second granularity | Disabled |
| Read replicas | 1 (same region, AZ-b) | None |
| Deletion protection | Enabled | Disabled |

### Parameter Group Customizations

```
# Performance tuning (grp-pg16-params)
shared_buffers            = {DBInstanceClassMemory / 4}     # 1 GB on t3.medium
effective_cache_size      = {DBInstanceClassMemory * 3 / 4} # 3 GB on t3.medium
work_mem                  = 16MB
maintenance_work_mem      = 256MB
max_connections           = 200
wal_buffers               = 16MB
checkpoint_completion_target = 0.9
random_page_cost          = 1.1          # SSD-optimized

# Logging
log_min_duration_statement = 500         # Log queries slower than 500ms
log_statement              = ddl         # Log DDL statements
log_connections            = on
log_disconnections         = on

# Security
rds.force_ssl             = 1            # Require SSL for all connections
password_encryption       = scram-sha-256
```

### Connection Pooling Recommendations

Application-side connection pooling is recommended to avoid exhausting RDS connections:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Pool size (per instance) | 20 | 2 EC2 instances x 20 = 40 connections (well under max 200) |
| Idle timeout | 30 seconds | Release unused connections promptly |
| Connection lifetime | 30 minutes | Prevent stale connections |
| Pool library | `pg-pool` (Node.js) | Native PostgreSQL pooling for Node.js |
| Statement timeout | 10 seconds | Prevent long-running queries from holding connections |

### Backup Strategy

1. **Automated snapshots** -- RDS creates daily snapshots during the backup window; retained for 7 days.
2. **Manual snapshots** -- Taken before major deployments; retained indefinitely.
3. **Point-in-time recovery (PITR)** -- Transaction logs shipped continuously; restore to any second within the retention window.
4. **Cross-region snapshot copy** -- Weekly automated copy to a secondary region for disaster recovery.
5. **S3 export** -- Monthly logical dump (`pg_dump`) exported to S3 for long-term archival with Glacier lifecycle.

---

## 9. Auto Scaling Configuration

### Launch Template

| Parameter | Value |
|-----------|-------|
| AMI | Amazon Linux 2023 (latest) |
| Instance type | t3.medium (2 vCPU, 4 GB RAM) |
| Key pair | `grp-prod-keypair` (emergency SSH only) |
| IAM instance profile | `grp-ec2-role` |
| Security groups | `sg-ec2` |
| EBS volume | 20 GB gp3, encrypted (KMS CMK) |
| User data | Bootstrap script (install Node.js, pull app from S3, start PM2) |
| Metadata | IMDSv2 required (token-based, hop limit 1) |

### Auto Scaling Group

| Parameter | Value |
|-----------|-------|
| Minimum capacity | 2 |
| Maximum capacity | 8 |
| Desired capacity | 2 |
| Availability Zones | 2 (AZ-a, AZ-b) |
| Health check type | ELB (ALB target group) |
| Health check grace period | 300 seconds |
| Default cooldown | 300 seconds |
| Termination policy | OldestInstance |

### Scaling Policies

**Scale-Out Policy (Add Instances)**

| Parameter | Value |
|-----------|-------|
| Metric | Average CPU utilization |
| Threshold | > 70% |
| Evaluation periods | 5 (1-minute periods = 5 minutes sustained) |
| Scaling adjustment | +1 instance |
| Cooldown | 300 seconds |

**Scale-In Policy (Remove Instances)**

| Parameter | Value |
|-----------|-------|
| Metric | Average CPU utilization |
| Threshold | < 30% |
| Evaluation periods | 15 (1-minute periods = 15 minutes sustained) |
| Scaling adjustment | -1 instance |
| Cooldown | 600 seconds |

**Additional Scaling Triggers**

| Metric | Threshold | Action |
|--------|-----------|--------|
| ALB RequestCount (per target) | > 1,000 / minute | Scale out +1 |
| ALB TargetResponseTime (p99) | > 2 seconds for 5 min | Scale out +1 |
| Memory utilization (custom) | > 80% for 5 min | Scale out +1 |

### Instance Refresh

- **Strategy:** Rolling replacement with 50% minimum healthy percentage.
- **Trigger:** New AMI or launch template version.
- **Warm-up:** 120 seconds before receiving traffic.

---

## 10. Cost Estimation

### Monthly Production Costs (Estimated, us-east-1)

| Service | Configuration | Monthly Cost (USD) |
|---------|---------------|--------------------|
| **EC2 (Auto Scaling)** | 2x t3.medium On-Demand (baseline) | $60.74 |
| **RDS PostgreSQL** | db.t3.medium Multi-AZ | $97.09 |
| **RDS storage** | 20 GB gp3 + backup | $6.90 |
| **ElastiCache Redis** | cache.t3.medium (1 primary + 1 replica) | $97.09 |
| **ALB** | 1 ALB + 20 LCU-hours/day average | $38.77 |
| **CloudFront** | 100 GB transfer + 10M requests | $12.50 |
| **S3** | 50 GB storage + requests | $2.30 |
| **Route 53** | 1 hosted zone + health checks | $2.50 |
| **NAT Gateway** | 2 NAT Gateways + 50 GB data processed | $89.10 |
| **WAF** | 1 Web ACL + 6 rules + 5M requests | $11.00 |
| **ACM** | SSL certificates | $0.00 |
| **Secrets Manager** | 5 secrets + API calls | $2.50 |
| **KMS** | 3 CMKs + API calls | $3.60 |
| **CloudWatch** | Logs (10 GB), metrics, dashboards, alarms | $15.00 |
| **X-Ray** | 5% sampling, ~1M traces | $5.00 |
| **CodePipeline** | 1 pipeline | $1.00 |
| **CodeBuild** | build.general1.small, ~60 min/month | $3.00 |
| | | |
| **Subtotal** | | **$447.09** |
| **Data transfer (estimated)** | 100 GB outbound | $9.00 |
| | | |
| **Total (On-Demand)** | | **~$456/month** |

### Cost Optimization Opportunities

| Strategy | Potential Savings | Notes |
|----------|-------------------|-------|
| **EC2 Reserved Instances (1-year)** | ~35% on EC2 | Commit to 2x t3.medium for baseline |
| **RDS Reserved Instance (1-year)** | ~35% on RDS | Commit to Multi-AZ db.t3.medium |
| **ElastiCache Reserved Nodes (1-year)** | ~35% on Redis | Commit to 2x cache.t3.medium |
| **Single NAT Gateway** | ~$44/month | Accept AZ-level risk for NAT |
| **S3 Intelligent-Tiering** | ~10% on S3 | Auto-move infrequent objects |
| **Savings Plans (Compute, 1-year)** | ~30% across EC2/Fargate | Flexible across instance types |

**With 1-year reservations applied:** estimated total drops to approximately **$330/month**.

---

## 11. Disaster Recovery

### Recovery Objectives

| Metric | Target | Mechanism |
|--------|--------|-----------|
| **RTO (Recovery Time Objective)** | 15 minutes | Automated failover + ASG self-healing |
| **RPO (Recovery Point Objective)** | 1 hour | Continuous RDS transaction log shipping + hourly Redis snapshots |

### Failure Scenarios and Response

| Failure Scenario | Detection | Automated Response | RTO | RPO |
|------------------|-----------|-------------------|-----|-----|
| **Single EC2 failure** | ALB health check (30s) | ASG launches replacement instance | ~3 min | 0 (stateless) |
| **Single AZ failure** | Route 53 health check | Traffic routes to surviving AZ; ASG launches instances in healthy AZ | ~5 min | 0 |
| **RDS primary failure** | RDS event notification | Automatic failover to Multi-AZ standby; DNS endpoint unchanged | ~2 min | ~0 (sync replication) |
| **Redis primary failure** | ElastiCache event | Automatic failover to replica; application reconnects | ~1 min | Seconds |
| **CloudFront origin failure** | Origin health check | Serve stale cache (custom error pages); failover origin group | Immediate | Stale cache TTL |
| **Full region failure** | Route 53 health check | Manual failover to secondary region (if configured) | ~30 min | 1 hour |
| **Accidental data deletion** | Manual detection | RDS point-in-time recovery; S3 versioning rollback | ~15 min | Seconds |

### Backup and Recovery Assets

```
┌─────────────────────────────────────────────────────┐
│                Primary Region (us-east-1)            │
│                                                     │
│  RDS Automated Snapshots ──── 7-day retention        │
│  RDS Transaction Logs ─────── Continuous (5-min lag) │
│  S3 Versioning ────────────── All objects versioned  │
│  Redis Snapshots ──────────── Hourly to S3           │
│  AMI Backups ──────────────── Weekly golden AMI       │
│                                                     │
│         Cross-Region Replication                     │
│              │                                       │
│              ▼                                       │
│  ┌──────────────────────────────────────┐            │
│  │   Secondary Region (us-west-2)       │            │
│  │                                     │            │
│  │   S3 Replica Bucket ─── Critical data│            │
│  │   RDS Snapshot Copy ─── Weekly        │            │
│  │   AMI Copy ──────────── Weekly        │            │
│  └──────────────────────────────────────┘            │
└─────────────────────────────────────────────────────┘
```

### Disaster Recovery Runbook (Summary)

1. **Alert received** -- CloudWatch alarm or PagerDuty notification.
2. **Assess scope** -- Determine if the failure is instance-level, AZ-level, or region-level.
3. **Instance/AZ failure** -- Verify ASG and RDS automatic failover; no manual action required.
4. **Region failure** -- Initiate cross-region failover:
   - Promote RDS snapshot in secondary region to standalone instance.
   - Deploy application stack via CloudFormation in secondary region.
   - Update Route 53 to point to the secondary region's CloudFront distribution.
5. **Validate** -- Run smoke tests against the recovery environment.
6. **Communicate** -- Notify stakeholders via Slack and status page.
7. **Post-incident** -- Conduct blameless retrospective within 48 hours.

### Monitoring and Alerting

| Alarm | Metric | Threshold | Action |
|-------|--------|-----------|--------|
| High 5xx rate | ALB HTTPCode_Target_5XX_Count | > 10 in 5 min | PagerDuty P2 |
| RDS high CPU | RDS CPUUtilization | > 80% for 10 min | PagerDuty P3 |
| RDS low storage | RDS FreeStorageSpace | < 5 GB | PagerDuty P2 |
| RDS connections | RDS DatabaseConnections | > 150 | PagerDuty P3 |
| Redis evictions | ElastiCache Evictions | > 100 in 5 min | PagerDuty P3 |
| Redis memory | ElastiCache DatabaseMemoryUsagePercentage | > 80% | PagerDuty P3 |
| ASG capacity | ASG GroupInServiceInstances | < 2 | PagerDuty P1 |
| Unhealthy hosts | ALB UnHealthyHostCount | > 0 for 5 min | PagerDuty P2 |
| WAF blocked | WAF BlockedRequests | > 1,000 in 5 min | Slack notification |
| Billing anomaly | AWS Budgets | > 120% forecasted | Email to finance |

---

*Document version: 1.0*
*Last updated: 2026-03-01*
*Author: Infrastructure Team, Green Room Partners*

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface AliaBotStackProps extends cdk.StackProps {
    /**
     * Environment name (e.g., 'prod', 'staging')
     */
    environment: string;
    /**
     * Container memory in MB
     * @default 512
     */
    containerMemory?: number;
    /**
     * Desired task count
     * @default 1
     */
    desiredCount?: number;
    /**
     * VPC ID to use. If not provided, a new VPC will be created.
     */
    vpcId?: string;
}

export class AliaBotStack extends cdk.Stack {
    public readonly cluster: ecs.Cluster;
    public readonly service: ecs.Ec2Service;
    public readonly taskDefinition: ecs.Ec2TaskDefinition;
    public readonly executionRole: iam.Role;
    public readonly repository: ecr.IRepository;

    constructor(scope: Construct, id: string, props: AliaBotStackProps) {
        super(scope, id, props);

        const { environment, containerMemory = 512, desiredCount = 1, vpcId } = props;

        // Import existing ECR repository (don't recreate it)
        this.repository = ecr.Repository.fromRepositoryName(
            this,
            'AliaBotRepository',
            'alia-bot'
        );

        // Use provided VPC ID or create a new VPC
        const vpc = vpcId
            ? ec2.Vpc.fromLookup(this, 'ImportedVpc', { vpcId })
            : new ec2.Vpc(this, 'AliaBotVpc', {
                vpcName: `alia-bot-vpc-${environment}`,
                maxAzs: 2,
                natGateways: 1,
            });

        // Create CloudWatch Log Group
        const logGroup = new logs.LogGroup(this, 'AliaBotLogGroup', {
            logGroupName: `/ecs/alia-bot-${environment}`,
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        // Create ECS Task Execution Role
        this.executionRole = new iam.Role(this, 'AliaBotTaskExecutionRole', {
            roleName: `AliaBotECSTaskExecutionRole-${environment}`,
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            description: 'ECS Task Execution Role for Alia Bot',
        });

        // Add managed policy for ECS task execution
        this.executionRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
        );

        // Create custom policy for secrets and ECR access
        const secretsPolicy = new iam.Policy(this, 'AliaBotSecretsPolicy', {
            policyName: `AliaBotSecretsAccess-${environment}`,
            statements: [
                // ECR Authorization
                new iam.PolicyStatement({
                    sid: 'ECRAuthorization',
                    effect: iam.Effect.ALLOW,
                    actions: ['ecr:GetAuthorizationToken'],
                    resources: ['*'],
                }),
                // ECR Image Pull
                new iam.PolicyStatement({
                    sid: 'ECRImagePull',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'ecr:GetDownloadUrlForLayer',
                        'ecr:BatchGetImage',
                        'ecr:BatchCheckLayerAvailability',
                    ],
                    resources: [this.repository.repositoryArn],
                }),
                // SSM Parameter Access
                new iam.PolicyStatement({
                    sid: 'SSMParameterAccess',
                    effect: iam.Effect.ALLOW,
                    actions: ['ssm:GetParameters'],
                    resources: [
                        `arn:aws:ssm:${this.region}:${this.account}:parameter/BOT_TOKEN`,
                        `arn:aws:ssm:${this.region}:${this.account}:parameter/DB_HOST`,
                        `arn:aws:ssm:${this.region}:${this.account}:parameter/DB_PASSWORD`,
                        `arn:aws:ssm:${this.region}:${this.account}:parameter/NODE_ENV`,
                        `arn:aws:ssm:${this.region}:${this.account}:parameter/OPENAI_API_KEY`,
                        `arn:aws:ssm:${this.region}:${this.account}:parameter/alia-bot/SENTRY_DSN`,
                        `arn:aws:ssm:${this.region}:${this.account}:parameter/alia-bot/${environment}/POLYGON_API_KEY`,
                    ],
                }),
                // CloudWatch Logs
                new iam.PolicyStatement({
                    sid: 'CloudWatchLogs',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'logs:CreateLogStream',
                        'logs:PutLogEvents',
                    ],
                    resources: [logGroup.logGroupArn, `${logGroup.logGroupArn}:*`],
                }),
            ],
        });
        this.executionRole.attachInlinePolicy(secretsPolicy);

        // Create ECS Cluster
        this.cluster = new ecs.Cluster(this, 'AliaBotCluster', {
            clusterName: `alia-bot-cluster-${environment}`,
            vpc,
            containerInsightsV2: ecs.ContainerInsights.ENABLED,
        });

        // Add EC2 capacity to the cluster
        this.cluster.addCapacity('AliaBotCapacity', {
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
            desiredCapacity: 1,
            minCapacity: 1,
            maxCapacity: 2,
        });

        // Create Task Definition (EC2 launch type to match existing setup)
        this.taskDefinition = new ecs.Ec2TaskDefinition(this, 'AliaBotTaskDefinition', {
            family: `alia-bot-task-${environment}`,
            executionRole: this.executionRole,
            networkMode: ecs.NetworkMode.BRIDGE,
        });

        // Add container to task definition
        const container = this.taskDefinition.addContainer('AliaBotContainer', {
            containerName: 'alia-bot-container',
            image: ecs.ContainerImage.fromEcrRepository(this.repository, 'latest'),
            memoryLimitMiB: containerMemory,
            essential: true,
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup,
            }),
            environment: {
                VERSION: 'latest',
                APP_VERSION: '1.0.0',
            },
            secrets: {
                BOT_TOKEN: ecs.Secret.fromSsmParameter(
                    ssm.StringParameter.fromStringParameterName(this, 'BotToken', '/BOT_TOKEN')
                ),
                DB_HOST: ecs.Secret.fromSsmParameter(
                    ssm.StringParameter.fromStringParameterName(this, 'DbHost', '/DB_HOST')
                ),
                DB_PASSWORD: ecs.Secret.fromSsmParameter(
                    ssm.StringParameter.fromStringParameterName(this, 'DbPassword', '/DB_PASSWORD')
                ),
                NODE_ENV: ecs.Secret.fromSsmParameter(
                    ssm.StringParameter.fromStringParameterName(this, 'NodeEnv', '/NODE_ENV')
                ),
                OPENAI_API_KEY: ecs.Secret.fromSsmParameter(
                    ssm.StringParameter.fromStringParameterName(this, 'OpenAiKey', '/OPENAI_API_KEY')
                ),
                SENTRY_DSN: ecs.Secret.fromSsmParameter(
                    ssm.StringParameter.fromStringParameterName(this, 'SentryDsn', '/alia-bot/SENTRY_DSN')
                ),
                POLYGON_API_KEY: ecs.Secret.fromSsmParameter(
                    ssm.StringParameter.fromStringParameterName(this, 'PolygonKey', `/alia-bot/${environment}/POLYGON_API_KEY`)
                ),
            },
        });

        // Add port mapping
        container.addPortMappings({
            containerPort: 8080,
            hostPort: 8080,
            protocol: ecs.Protocol.TCP,
        });

        // Create ECS Service
        this.service = new ecs.Ec2Service(this, 'AliaBotService', {
            serviceName: `alia-bot-service-${environment}`,
            cluster: this.cluster,
            taskDefinition: this.taskDefinition,
            desiredCount,
            minHealthyPercent: 0, // Allow rolling update with single instance
            maxHealthyPercent: 100,
            circuitBreaker: {
                rollback: true,
            },
            deploymentController: {
                type: ecs.DeploymentControllerType.ECS,
            },
        });

        // Outputs
        new cdk.CfnOutput(this, 'ClusterName', {
            value: this.cluster.clusterName,
            description: 'ECS Cluster Name',
        });

        new cdk.CfnOutput(this, 'ServiceName', {
            value: this.service.serviceName,
            description: 'ECS Service Name',
        });

        new cdk.CfnOutput(this, 'TaskDefinitionArn', {
            value: this.taskDefinition.taskDefinitionArn,
            description: 'ECS Task Definition ARN',
        });

        new cdk.CfnOutput(this, 'ExecutionRoleArn', {
            value: this.executionRole.roleArn,
            description: 'ECS Task Execution Role ARN',
        });

        new cdk.CfnOutput(this, 'RepositoryUri', {
            value: this.repository.repositoryUri,
            description: 'ECR Repository URI',
        });

        new cdk.CfnOutput(this, 'LogGroupName', {
            value: logGroup.logGroupName,
            description: 'CloudWatch Log Group Name',
        });
    }
}

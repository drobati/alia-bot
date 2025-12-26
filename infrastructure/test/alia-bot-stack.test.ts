import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AliaBotStack } from '../lib/alia-bot-stack';

describe('AliaBotStack', () => {
    let app: cdk.App;
    let stack: AliaBotStack;
    let template: Template;

    beforeAll(() => {
        app = new cdk.App();
        stack = new AliaBotStack(app, 'TestAliaBotStack', {
            environment: 'test',
            containerMemory: 512,
            desiredCount: 1,
            env: {
                account: '123456789012',
                region: 'us-east-1',
            },
        });
        template = Template.fromStack(stack);
    });

    describe('ECS Cluster', () => {
        it('should create an ECS cluster', () => {
            template.hasResourceProperties('AWS::ECS::Cluster', {
                ClusterName: 'alia-bot-cluster-test',
            });
        });
    });

    describe('ECS Service', () => {
        it('should create an ECS service with circuit breaker', () => {
            template.hasResourceProperties('AWS::ECS::Service', {
                ServiceName: 'alia-bot-service-test',
                DesiredCount: 1,
                DeploymentConfiguration: {
                    DeploymentCircuitBreaker: {
                        Enable: true,
                        Rollback: true,
                    },
                },
            });
        });
    });

    describe('ECS Task Definition', () => {
        it('should create a task definition with correct family', () => {
            template.hasResourceProperties('AWS::ECS::TaskDefinition', {
                Family: 'alia-bot-task-test',
            });
        });

        it('should have container with port 8080 mapped', () => {
            template.hasResourceProperties('AWS::ECS::TaskDefinition', {
                ContainerDefinitions: [
                    {
                        Name: 'alia-bot-container',
                        Memory: 512,
                        Essential: true,
                        PortMappings: [
                            {
                                ContainerPort: 8080,
                                HostPort: 8080,
                                Protocol: 'tcp',
                            },
                        ],
                    },
                ],
            });
        });
    });

    describe('IAM Role', () => {
        it('should create task execution role', () => {
            template.hasResourceProperties('AWS::IAM::Role', {
                RoleName: 'AliaBotECSTaskExecutionRole-test',
                AssumeRolePolicyDocument: {
                    Statement: [
                        {
                            Action: 'sts:AssumeRole',
                            Effect: 'Allow',
                            Principal: {
                                Service: 'ecs-tasks.amazonaws.com',
                            },
                        },
                    ],
                },
            });
        });

        it('should attach ECS task execution managed policy', () => {
            template.hasResourceProperties('AWS::IAM::Role', {
                ManagedPolicyArns: [
                    {
                        'Fn::Join': [
                            '',
                            [
                                'arn:',
                                { Ref: 'AWS::Partition' },
                                ':iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
                            ],
                        ],
                    },
                ],
            });
        });
    });

    describe('CloudWatch Logs', () => {
        it('should create log group with 30 day retention', () => {
            template.hasResourceProperties('AWS::Logs::LogGroup', {
                LogGroupName: '/ecs/alia-bot-test',
                RetentionInDays: 30,
            });
        });
    });

    describe('Stack Outputs', () => {
        it('should output cluster name', () => {
            template.hasOutput('ClusterName', {});
        });

        it('should output service name', () => {
            template.hasOutput('ServiceName', {});
        });

        it('should output task definition ARN', () => {
            template.hasOutput('TaskDefinitionArn', {});
        });
    });
});

const cdk = require('@aws-cdk/core');
const ecr = require('@aws-cdk/aws-ecr');
const codebuild = require('@aws-cdk/aws-codebuild');
const actions = require('@aws-cdk/aws-codepipeline-actions');
const iam = require('@aws-cdk/aws-iam');
const codepipeline = require('@aws-cdk/aws-codepipeline');
const ec2 = require('@aws-cdk/aws-ec2');
const ecs = require('@aws-cdk/aws-ecs');
const elbv2 = require('@aws-cdk/aws-elasticloadbalancingv2');
const ecspatterns = require('@aws-cdk/aws-ecs-patterns');

class InfrastructurePipelineStack extends cdk.Stack {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const prefixName = 'testing-api'
    
    // -----------------------------
    // ECS Cluster VPC
    const vpc = new ec2.Vpc(this, prefixName + "-vpc", {
        maxAzs: 3
    })
    const cluster = new ecs.Cluster(this, prefixName + "-cluster", {
        clusterName: prefixName+"-cluster",
        vpc: vpc
    })

    // -----------------------------
    // Application Load Balancer
    // const alb = new elbv2.ApplicationLoadBalancer(this, prefixName + "-ALB", {
    //     vpc: vpc,
    //     internetFacing: true
    // });
    
    // NEW
    const imageRepo = ecr.Repository.fromRepositoryName(this, 'Repo', 'testing-api-repository');
    const tag = (process.env.IMAGE_TAG) ? process.env.IMAGE_TAG : 'build-67418f3a-b5e1-4409-ad6f-90e4fef9feef';
    const image = ecs.ContainerImage.fromEcrRepository(imageRepo, tag)

    // Fargate service + load balancer
    new ecspatterns.ApplicationLoadBalancedFargateService(this, prefixName + '-ServiceNew', {
      cluster,
      taskImageOptions: { image },
      publicLoadBalancer: true
    });
    // const tg = new elbv2.ApplicationTargetGroup(this, "default", {
    //     vpc: vpc,
    //     port: props.port,
    //     targetType: elbv2.TargetType.Ip,
    //     healthCheck: {
    //     path: "/",
    //     port: props.port.toString(),
    //     protocol: elbv2.Protocol.Http,
    //     intervalSecs: 60,
    //     timeoutSeconds: 5
    //     }
    // });
    // const listener = alb.addListener("Listen", {
    //     port: props.port
    // });
    // listener.addTargetGroups("TG", {
    //     targetGroups: [tg]
    // });

    // Create the ECS Task Definition with placeholder container (and named Task Execution IAM Role)
    // const executionRole = new iam.Role(this, prefixName + "-execution-role", {
    //     assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    //     roleName: prefixName+"-execution-role"
    // })
    // executionRole.addToPolicy(new iam.PolicyStatement({
    //     effect: iam.Effect.ALLOW,
    //     resources: ["*"],
    //     actions: [
    //         "ecr:GetAuthorizationToken",
    //         "ecr:BatchCheckLayerAvailability",
    //         "ecr:GetDownloadUrlForLayer",
    //         "ecr:BatchGetImage",
    //         "logs:CreateLogStream",
    //         "logs:PutLogEvents"
    //         ]
    //     })
    // )
    // const taskDefinition = new ecs.FargateTaskDefinition(this, prefixName + "-task-definition", {
    //     executionRole: executionRole,
    //     family: prefixName+"-task-definition"
    // })
    // const container = taskDefinition.addContainer("DefaultContainer", {
    //     image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample")
    // })

    // // Create the ECS Service
    // const service = new ecs.FargateService(this, prefixName + "-service", {
    //     cluster: cluster,
    //     taskDefinition: taskDefinition,
    //     serviceName: prefixName+"-service"
    // })

    // // Create the CodeBuild project
    // const githubAccessToken = cdk.SecretValue.secretsManager('testing-api');
    // const gitHubSource = codebuild.Source.gitHub({
    //     owner: 'Boscoand',
    //     repo: 'fargate-workshop',
    //     oauthToken: githubAccessToken,
    //     webhook: true, // optional, default: true if `webhookFilters` were provided, false otherwise
    //     // webhookFilters: [
    //     //   codebuild.FilterGroup.inEventOf(codebuild.EventAction.PUSH).andBranchIs('master'),
    //     // ], // optional, by default all pushes and Pull Requests will trigger a build
    // });
    // new codebuild.Project(this, prefixName + '-codebuild', {
    //     projectName: prefixName+'-codebuild',
    //     source: gitHubSource
    // });

    // Create the ECR Repository
    // const ecrRepository = new ecr.Repository(this, prefixName + "-repository", {
    //   repositoryName: prefixName+"-repository"
    // })

    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: prefixName + '-pipeline',
    });

    // Source
    // const githubAccessToken = cdk.SecretValue.secretsManager('testing-api');
    const sourceOutput = new codepipeline.Artifact('SourceArtifact');
    const sourceAction = new actions.GitHubSourceAction({
        actionName: 'GitHubSource',
        owner: 'Boscoand',
        repo: 'fargate-workshop',
        oauthToken: 'eab255e320263384b8a7d9e6d9b1f08c5d89d8c7',
        output: sourceOutput
    });

    // const baseImageRepo = ecr.Repository.fromRepositoryName(this, 'BaseRepo', prefixName+'repository');
    // const baseImageOutput = new codepipeline.Artifact('BaseImage');
    // const dockerImageSourceAction = new actions.EcrSourceAction({
    //   actionName: 'BaseImage',
    //   repository: baseImageRepo,
    //   imageTag: 'release',
    //   output: baseImageOutput,
    // });

    pipeline.addStage({
        stageName: 'Source',
        // actions: [sourceAction, dockerImageSourceAction],
        actions: [sourceAction]
    });

    // Build
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
        buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
        environment: {
        //   buildImage: codebuild.LinuxBuildImage.UBUNTU_14_04_NODEJS_10_1_0,
        //   environmentVariables: {
        //     'ARTIFACTS_BUCKET': {
        //         value: pipeline.artifactBucket.bucketName
        //     }
        //   },
          privileged: true // Enables Docker daemon
        }
    });

    buildProject.addToRolePolicy(new iam.PolicyStatement({
        actions: [
            'ec2:DescribeAvailabilityZones',
            'route53:ListHostedZonesByName'
        ],
        resources: ['*']
    }));

    buildProject.addToRolePolicy(new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [cdk.Stack.of(this).formatArn({
            service: 'ssm',
            resource: 'parameter',
            resourceName: 'CertificateArn-*'
        })]
    }));

    buildProject.addToRolePolicy(new iam.PolicyStatement({
        actions: ["ecr:GetAuthorizationToken",
            "ecr:BatchCheckLayerAvailability",
            "ecr:GetDownloadUrlForLayer",
            "ecr:GetRepositoryPolicy",
            "ecr:DescribeRepositories",
            "ecr:ListImages",
            "ecr:DescribeImages",
            "ecr:BatchGetImage",
            "ecr:InitiateLayerUpload",
            "ecr:UploadLayerPart",
            "ecr:CompleteLayerUpload",
            "ecr:PutImage"
        ],
        resources: ["*"]
    }));

    const buildArtifact = new codepipeline.Artifact('BuildArtifact');
    const buildAction = new actions.CodeBuildAction({
        actionName: 'CodeBuild',
        project: buildProject,
        input: sourceOutput,
        // extraInputs: [baseImageOutput],
        outputs: [buildArtifact],
      });

    pipeline.addStage({
        stageName: 'Build',
        actions: [buildAction],
    });
  }
}

module.exports = { InfrastructurePipelineStack }

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

class CodePipelineStack extends cdk.Stack {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const prefixName = 'testing-api'
    
    // CodePipeline
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
        pipelineName: prefixName + '-pipeline',
      });

    // Source Step
    const sourceOutput = new codepipeline.Artifact('SourceArtifact')
    const sourceAction = new actions.GitHubSourceAction({
        actionName: 'GitHubSource',
        owner: 'Boscoand',
        repo: 'fargate-workshop',
        oauthToken: '',
        output: sourceOutput
    });
    pipeline.addStage({
        stageName: 'Source',
        actions: [sourceAction]
    });
  
    // Build Step
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
        buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
        environment: {
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
        outputs: [buildArtifact],
    });
    pipeline.addStage({
        stageName: 'Build',
        actions: [buildAction],
    });

    // Deploy Prod Step
    const templatePrefix =  'FargateStack';
    const prodStackName = 'FargateStack';
    const changeSetName = 'StagedChangeSet';

    pipeline.addStage({
        stageName: 'Prod',
        actions: [
            new actions.CloudFormationCreateReplaceChangeSetAction({
                actionName: 'PrepareChangesProd',
                stackName: prodStackName,
                changeSetName,
                runOrder: 1,
                adminPermissions: true,
                templatePath: buildArtifact.atPath(templatePrefix + '.template.json'),
            }),
            new actions.CloudFormationExecuteChangeSetAction({
                actionName: 'ExecuteChangesProd',
                stackName: prodStackName,
                changeSetName,
                runOrder: 2
            })
        ],
    });
  }
}

module.exports = { CodePipelineStack }


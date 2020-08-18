const cdk = require('@aws-cdk/core');
const ecr = require('@aws-cdk/aws-ecr');
const codebuild = require('@aws-cdk/aws-codebuild');
const actions = require('@aws-cdk/aws-codepipeline-actions');
const iam = require('@aws-cdk/aws-iam');
const codepipeline = require('@aws-cdk/aws-codepipeline');

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

    // Create the ECR Repository
    const ecrRepository = new ecr.Repository(this, prefixName + "-repository", {
      repositoryName: prefixName+"-repository"
    })

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
        oauthToken: '10943e10bd979e0a2c72bd085f93e447218602ef',
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
    //     buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
        // environment: {
        //   buildImage: codebuild.LinuxBuildImage.UBUNTU_14_04_NODEJS_10_1_0,
        //   environmentVariables: {
        //     'ARTIFACTS_BUCKET': {
        //         value: pipeline.artifactBucket.bucketName
        //     }
        //   },
        //   privileged: true
        // }
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

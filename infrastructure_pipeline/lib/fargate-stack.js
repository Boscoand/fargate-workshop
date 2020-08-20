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

class FargateStack extends cdk.Stack {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const prefixName = 'testing-api'
    
    // VPC and Cluster
    const vpc = new ec2.Vpc(this, prefixName + "-vpc", {
        maxAzs: 3
    })
    const cluster = new ecs.Cluster(this, prefixName + "-cluster", {
        clusterName: prefixName+"-cluster",
        vpc: vpc
    })
    
    const imageRepo = ecr.Repository.fromRepositoryName(this, 'Repo', 'testing-api-repository');
    const tag = (process.env.IMAGE_TAG) ? process.env.IMAGE_TAG : 'latest';
    const image = ecs.ContainerImage.fromEcrRepository(imageRepo, tag)

    // Task Definition
    const executionRole = new iam.Role(this, prefixName + "-execution-role", {
        assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
        roleName: prefixName+"-execution-role"
    })
    executionRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ["*"],
        actions: [
            "ecr:GetAuthorizationToken",
            "ecr:BatchCheckLayerAvailability",
            "ecr:GetDownloadUrlForLayer",
            "ecr:BatchGetImage",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
            ]
        })
    )
    const taskDefinition = new ecs.FargateTaskDefinition(this, prefixName + "-task-definition", {
        executionRole,
        family: 'testing-api-task-definition',
    })
    const container = taskDefinition.addContainer("DefaultContainer", {
        image,
    })
    container.addPortMappings({
        containerPort: 8080, 
    })
    new ecspatterns.ApplicationLoadBalancedFargateService(this, prefixName + '-ServiceNew', {
      cluster,
      publicLoadBalancer: true,
      taskDefinition
    });
   
  }
}

module.exports = { FargateStack }

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as fs from 'fs';

export class PortfolioPlatformStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // =========================
    // S3
    // =========================
    // Bucket privado.
    // Los archivos no pueden accederse directamente desde Internet.
    // CloudFront será quien acceda al bucket mediante OAC.
    const bucket = new s3.Bucket(this, 'PortfolioBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // =========================
    // DynamoDB
    // =========================
    // Tabla para almacenar los metadatos de los portafolios.
    const table = new dynamodb.Table(this, 'PortfoliosTable', {
      partitionKey: {
        name: 'studentId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // =========================
    // CloudFront - Public Key
    // =========================
    // Se utiliza para validar las Signed URLs
    // de los archivos privados.
    const publicKey = new cloudfront.PublicKey(this, 'PortfolioPublicKey', {
      encodedKey: fs.readFileSync(
        './keys/cloudfront-public-key.pem',
        'utf8'
      ),
    });

    // =========================
    // CloudFront - Key Group
    // =========================
    // Agrupa la clave pública que CloudFront utilizará
    // para validar las URLs firmadas.
    const keyGroup = new cloudfront.KeyGroup(this, 'PortfolioKeyGroup', {
      items: [publicKey],
    });

    // =========================
    // CloudFront
    // =========================
    const distribution = new cloudfront.Distribution(
      this,
      'PortfolioDistribution',
      {
        // Archivo principal del sitio
        defaultRootObject: 'index.html',

        // América + Europa + Asia
        priceClass: cloudfront.PriceClass.PRICE_CLASS_200,

        // =========================
        // Archivos públicos
        // =========================
        defaultBehavior: {
          origin:
            origins.S3BucketOrigin.withOriginAccessControl(bucket),

          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      }
    );

    // =========================
    // Archivos privados
    // =========================
    // Todo archivo ubicado dentro de /private/*
    // requerirá una CloudFront Signed URL.
    distribution.addBehavior(
      '/private/*',
      origins.S3BucketOrigin.withOriginAccessControl(bucket),
      {
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,

        trustedKeyGroups: [keyGroup],
      }
    );

    // =========================
    // Registro de prueba DynamoDB
    // =========================
    new cr.AwsCustomResource(this, 'SeedPortfolioItem', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',

        parameters: {
          TableName: table.tableName,

          Item: {
            studentId: {
              S: 'student-001',
            },

            studentName: {
              S: 'Sebastian',
            },

            portfolioUrl: {
              S: 'https://example.com/student-001',
            },
          },
        },

        physicalResourceId:
          cr.PhysicalResourceId.of('student-001'),
      },

      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [table.tableArn],
      }),
    });

    // =========================
    // IAM
    // =========================
    // Rol que representa una aplicación que puede:
    // - escribir archivos en S3
    // - leer información de DynamoDB
    const portfolioRole = new iam.Role(this, 'PortfolioAppRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    bucket.grantWrite(portfolioRole);

    table.grantReadData(portfolioRole);

    // =========================
    // Website deployment
    // =========================
    // Sube automáticamente el contenido de ./website
    // al bucket S3 durante el despliegue.
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [
        s3deploy.Source.asset('./website'),
      ],

      destinationBucket: bucket,

      // Invalida la caché de CloudFront después
      // de subir los archivos.
      distribution: distribution,

      distributionPaths: ['/*'],
    });

    // =========================
    // Outputs
    // =========================

    // Nombre del bucket S3
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
    });

    // Nombre de la tabla DynamoDB
    new cdk.CfnOutput(this, 'TableName', {
      value: table.tableName,
    });

    // URL de CloudFront
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
    });
  }
}
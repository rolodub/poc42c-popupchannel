import * as cdk from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as iam from '@aws-cdk/aws-iam';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as lambda from '@aws-cdk/aws-lambda';
import * as s3 from '@aws-cdk/aws-s3';
import * as s3n from '@aws-cdk/aws-s3-notifications';

export class PopupchannelStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    //bucket stock
    const stock_bucket = new s3.Bucket(this, "PopupChannelStockBucket",{
      // 👇 Setting up CORS
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
  });
  stock_bucket.addToResourcePolicy(
  new iam.PolicyStatement({
  sid: 'PublicReadForGetBucketObjects',
  actions: [
  's3:GetObject',
  ],
  resources: [stock_bucket.bucketArn,stock_bucket.arnForObjects('*')],
  principals: [new iam.AnyPrincipal()],
  }));
      //bucket dest
      const dest_bucket = new s3.Bucket(this, "PopupChannelConvetDestBucket",{
        // 👇 Setting up CORS
        cors: [
          {
            allowedMethods: [
              s3.HttpMethods.GET,
              s3.HttpMethods.POST,
              s3.HttpMethods.PUT,
            ],
            allowedOrigins: ['*'],
            allowedHeaders: ['*'],
          },
        ],
    });
    dest_bucket.addToResourcePolicy(
      new iam.PolicyStatement({
      sid: 'PublicReadForGetBucketObjects',
      actions: [
      's3:GetObject',
      ],
      resources: [dest_bucket.bucketArn,dest_bucket.arnForObjects('*')],
      principals: [new iam.AnyPrincipal()],
      }));


    // create Dynamodb table
  const PopupDynamoTable = new dynamodb.CfnTable(this, 'PopupDynamoTable', {
    tableName:'popuptv_items',

    attributeDefinitions:[
      {
        attributeName:'item_id',
        attributeType:'S'
      },
      {
        attributeName:'item_type',
        attributeType:'S'
      },
      {
        attributeName:'item_name',
        attributeType:'S'
      }
    ],
    keySchema:[
      {
        attributeName:'item_id',
        keyType:'HASH'
      },

    ],
    billingMode:'PAY_PER_REQUEST',
    globalSecondaryIndexes:[
      {
      indexName:'type_date_index',
      keySchema:[
        {
          attributeName:'item_type',
          keyType:'HASH'
        }
      ],
      projection:{
        projectionType:'ALL'
      }
    },
    {
      indexName:'name_date_index',
      keySchema:[
        {
          attributeName:'item_name',
          keyType:'HASH'
        }
      ],
      projection:{
        projectionType:'ALL'
      }
    }
    ]
  });
  const WebapiLambda = new lambda.Function(this, 'WebapiLambda',{
    runtime:lambda.Runtime.PYTHON_3_7,
    code: lambda.Code.fromAsset("resources"),
    handler: 'popup_api.handler',
    environment:{
      DYNAMODB_TABLE_NAME: PopupDynamoTable.tableName!,
      STOCK_BUCKET:stock_bucket.bucketName,
    }
  });

  const dynamo_role = new iam.PolicyStatement({
    resources: ['*'],
    actions: ['dynamodb:PutItem','dynamodb:DeleteItem','dynamodb:GetItem','dynamodb:Scan','dynamodb:Query','dynamodb:UpdateItem','dynamodb:GetItem','dynamodb:Scan','dynamodb:Query','dynamodb:GetRecords','dynamodb:BatchGetItem'],
  })
  WebapiLambda.addToRolePolicy(dynamo_role);


  const api = new apigateway.LambdaRestApi(this, "widgets-api", {
    handler:WebapiLambda,
    defaultCorsPreflightOptions: {
      allowHeaders: [
        'Content-Type',
        'X-Amz-Date',
        'Authorization',
        'X-Api-Key',
      ],
      allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowCredentials: true,
      allowOrigins: ['*'],
    },
  });
  const myS3eventLambda = new lambda.Function(this, "MyStockS3EventProcessor", {
    //code: new lambda.InlineCode("def main(event, context):\n\tprint(event)\n\treturn {'statusCode': 200, 'body': 'Hello, World'}"),
    code: lambda.Code.fromAsset("resources"),
    handler: "S3event_processor.handler",
    runtime: lambda.Runtime.PYTHON_3_7,
    environment:{
      DYNAMODB_TABLE_NAME: PopupDynamoTable.tableName!,
    }
  });
  myS3eventLambda.addToRolePolicy(dynamo_role);

    /**
   * MediaConvert Service Role to grant Mediaconvert Access to the source and Destination Bucket,
   * API invoke * is also required for the services.
  */
  const mediaconvertRole = new iam.Role(this, 'MediaConvertRole', {
  assumedBy: new iam.ServicePrincipal('mediaconvert.amazonaws.com'),
    });
    const mediaconvertPolicy = new iam.Policy(this, 'MediaconvertPolicy', {
        statements: [
            new iam.PolicyStatement({
                resources: [`${stock_bucket.bucketArn}/*`, `${dest_bucket.bucketArn}/*`],
                actions: ['s3:GetObject', 's3:PutObject']
            }),
            new iam.PolicyStatement({
                resources: [`arn:${cdk.Aws.PARTITION}:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:*`],
                actions: ['execute-api:Invoke']
            })
        ]
    });
    mediaconvertPolicy.attachToRole(mediaconvertRole);



  stock_bucket.addEventNotification(s3.EventType.OBJECT_CREATED,
    new s3n.LambdaDestination(myS3eventLambda),
    //{suffix:'.mxf'},
    )
  }
}

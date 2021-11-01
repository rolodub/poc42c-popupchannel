import * as cdk from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as iam from '@aws-cdk/aws-iam';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as lambda from '@aws-cdk/aws-lambda';

export class PopupchannelStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // create Dynamodb table
  const PopupDynamoTable = new dynamodb.CfnTable(this, 'PopupDynamoTable', {
    tableName:'ivs_items',

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
      },
      {
        attributeName:'item_creation_date',
        attributeType:'N'
      },
    ],
    keySchema:[
      {
        attributeName:'item_id',
        keyType:'HASH'
      },
      {
        attributeName:'item_creation_date',
        keyType:'RANGE'
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
        },
        {
          attributeName:'item_creation_date',
          keyType:'RANGE'
        },
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
        },
        {
          attributeName:'item_creation_date',
          keyType:'RANGE'
        },
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
  }
}

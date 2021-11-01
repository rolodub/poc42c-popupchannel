import json
import os
import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
from botocore.client import Config
import uuid
import json
from pprint import pprint
import time
# DYNAMO Global Vars
DYNAMO_CONFIG = Config(connect_timeout=0.250, read_timeout=0.250, retries={'max_attempts': 1})
DYNAMO_RESOURCE = boto3.resource('dynamodb', config=DYNAMO_CONFIG)
DYNAMODB_TABLE_NAME = 'not-set'
#DYNAMO_INDEX = "requestor_id-timestamp_created-index"

DEBUG_LEVEL = "INFO"

def write_log(log_level, log_string):
    log_label = {
        "OFF"   : 0,
        "ERROR" : 1,
        "WARN"  : 2,
        "INFO"  : 3,
    }
    if log_label[log_level] <= log_label[DEBUG_LEVEL]:
        print("{}: {}".format(log_level,log_string))

def create_presigned_url(bucket_name, object_name, expiration=3600):
    """Generate a presigned URL to share an S3 object

    :param bucket_name: string
    :param object_name: string
    :param expiration: Time in seconds for the presigned URL to remain valid
    :return: Presigned URL as string. If error, returns None.
    """

    # Generate a presigned URL for the S3 object
    s3_client = boto3.client('s3')
    try:
        response = s3_client.generate_presigned_url('get_object',
                                                    Params={'Bucket': bucket_name,
                                                            'Key': object_name},
                                                    ExpiresIn=expiration)
    except ClientError as e:
        #logging.error(e)
        return None
    # The response contains the presigned URL
    return response

def handler(event, context):
    DYNAMODB_TABLE_NAME = os.environ.get('DYNAMODB_TABLE_NAME', 'not-set')
    write_log("INFO", "event: {}".format(json.dumps(event)))
    status_code = 500
    message = {
        'state': 'fail'
    }
    if DYNAMODB_TABLE_NAME == 'not-set':
        write_log("ERROR", "Environment Variable DYNAMODB_TABLE_NAME is not set")
        status_code = 200
        message['state'] = 'broke'
    CHANNEL_PLAYBACK_URL = os.environ.get('CHANNEL_PLAYBACK_URL')
    REC_BUCKET_NAME = os.environ.get('REC_BUCKET_NAME')
    message = {
        'state':'fail'
    }
    CHANNEL_INGEST_URL = os.environ.get('CHANNEL_INGEST_URL')
    CHANNEL_STREAMKEY = os.environ.get('CHANNEL_STREAMKEY')
    CHANNEL_ARN = os.environ.get('CHANNEL_ARN')

    if event['path'] == '/channelspecs':
        print('request: {}'.format(json.dumps(event)))
        message['playback_url'] = CHANNEL_PLAYBACK_URL
        message['ingest_url'] = CHANNEL_INGEST_URL
        message['streamkey'] = CHANNEL_STREAMKEY
        status_code = 200
        message['state'] = 'success'
        
    elif event['path'] == '/item-put':
        try:
            if 'body' in event:
                response = json.loads(event['body'])
                if 'item_type' in response: 
                    if response['item_type'] == 'answer': 
                        table = DYNAMO_RESOURCE.Table(DYNAMODB_TABLE_NAME)
                        write_log("INFO",table)
                        item = {
                            "item_id": str(response['item_id']),
                            "item_type": str(response['item_type']), 
                            "response": str(response['response']),
                            "item_creation_date": int(time.time()),
                            "timestamp_ttl": int(time.time()) + 3600 # 1hr
                            }
                        d_response = table.put_item(Item=item)
                        write_log("INFO", "DynamoDB Succesful: {}".format(d_response))
                        status_code = 200
                        message['state'] = 'success'
                else:
                    write_log("WARNING", "type does not exist in response, doing nothing")
        except:
            status_code = 200
            message['state'] = 'broke'

   ## GET - items by types
    elif event['path'] == '/type-get':
        response = json.loads(event['body'])
        item_type = response['item_type']
        table = DYNAMO_RESOURCE.Table(DYNAMODB_TABLE_NAME)
        d_response = table.query(
            KeyConditionExpression=Key('item_type').eq(item_type),
            ScanIndexForward=False,
            Limit=5,
            IndexName="type_date_index",
        )
        pprint(d_response['Items'])
        message['items'] = {}
        for item in d_response['Items']:
            message['items'][item['item_id']] = item['response']
        status_code = 200
        message['state'] = 'success'

#!/usr/bin/env python
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
def handler(event, context):
    DYNAMODB_TABLE_NAME = os.environ.get('DYNAMODB_TABLE_NAME', 'not-set')
    table = DYNAMO_RESOURCE.Table(DYNAMODB_TABLE_NAME)
    write_log("INFO", "event: {}".format(json.dumps(event)))
    #status_code = 500
    message = {
        'state': 'fail'
    }
    if DYNAMODB_TABLE_NAME == 'not-set':
        
        write_log("ERROR", "Environment Variable DYNAMODB_TABLE_NAME is not set")
        #status_code = 200
        message['state'] = 'broke'
    message = {
        'state':'fail'
    }
    if event['Records']:
        item_type=''
        for record in event['Records']:
            if str(record['s3']['object']['key']).startswith('stock_media'):
                item_type='stock_media'
            elif str(record['s3']['object']['key']).startswith('stock_install'):
                item_type='stock_install'
            item = {
                    "item_id": str(record['s3']['object']['eTag']),
                    "item_type": item_type, 
                    "item_name": str(record['s3']['object']['key']),
                    "bucket": record['s3']['bucket'],
                    "item_creation_date": int(time.time()),
                    "timestamp_ttl": int(time.time()) + 3600 # 1hr
                    }
            d_response = table.put_item(Item=item)
            write_log("INFO", "DynamoDB Succesful: {}".format(d_response))
        #status_code = 200
        #message['state'] = 'success'
    else:
        write_log("WARNING", "error S3 in dynamodb, doing nothing")
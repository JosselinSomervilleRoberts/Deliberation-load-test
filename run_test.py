#!/usr/bin/env python
# coding: utf-8
import boto3
import logging
import sys
from datetime import date
import os
import numpy as np
import sys
sys.path.append('../../')
import config
import time

def get_ec2_resource(region_name="us-east-1"):
    ec2_resource = boto3.resource("ec2", region_name=region_name, aws_access_key_id=ACCESS_ID, aws_secret_access_key=ACCESS_KEY)
    return ec2_resource

def get_ec2_client(region_name="us-east-1"):
    ec2_client = boto3.client("ec2", region_name=region_name, aws_access_key_id=ACCESS_ID, aws_secret_access_key=ACCESS_KEY)
    return ec2_client

def create_key_pair_if_not_exists(key_name="ec2-key-pair", region_name="us-east-1"):
    ec2_client = get_ec2_client(region_name)
    key_pairs = ec2_client.describe_key_pairs()["KeyPairs"]
    key_pair_names = [key_pair["KeyName"] for key_pair in key_pairs]
    if key_name not in key_pair_names:
        path = create_key_pair(key_name, region_name)
        return path
    else:
        print("Key pair already exists. Trying to load it from file.")
        path = "aws_" + key_name + ".pem"
        if os.path.exists(path):
            print("Key pair file exists. Loading it.")
            return path
        else:
            raise Exception("Key pair file does not exist. Please create it manually.")

def create_key_pair(key_name="ec2-key-pair", region_name="us-east-1"):
    ec2_client = get_ec2_client(region_name)
    key_pair = ec2_client.create_key_pair(KeyName=key_name)

    private_key = key_pair["KeyMaterial"]

    # write private key to file with 400 permissions
    path = "aws_" + key_name + ".pem"
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT, 0o400), "w+") as handle:
        handle.write(private_key)
    return path

def get_public_ip(instance_id, region_name="us-east-1"):
    ec2_client = get_ec2_client(region_name)
    reservations = ec2_client.describe_instances(InstanceIds=[instance_id]).get("Reservations")
    #print(reservations[0]['Instances'][0].keys())
    #print(reservations[0]['Instances'][0].get("PublicDnsName"))

    ip_addresses = []
    for reservation in reservations:
        for instance in reservation['Instances']:
            ip_addresses.append(instance.get("PublicIpAddress"))
    return ip_addresses

def stop_instance(instance_id, region_name="us-east-1"):
    ec2_client = get_ec2_client(region_name)
    response = ec2_client.stop_instances(InstanceIds=[instance_id])
    print(response)
          
def terminate_instance(instance_id, region_name="us-east-1"):
    ec2_client = get_ec2_client(region_name)
    response = ec2_client.terminate_instances(InstanceIds=[instance_id])
    print(response)



# get date for logging
today = date.today()
d1 = today.strftime("%d/%m/%Y")

# set logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s | %(levelname)s | %(message)s')

stdout_handler = logging.StreamHandler(sys.stdout)
stdout_handler.setLevel(logging.DEBUG)
stdout_handler.setFormatter(formatter)

file_handler = logging.FileHandler(d1.replace('/', '-')+'logs.log')
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(formatter)


logger.addHandler(file_handler)
logger.addHandler(stdout_handler)

# Secrets
ACCESS_ID = "AKIA35YPCFVF4GEOS5HH"
ACCESS_KEY = "wxgzv0JZ4FIPC9RBo+/B6m7nwucxCN7lUH8jBzwB"
GIT_ACCESS_TOKEN = "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"

# ec2 module loading
region = "us-west-1"
ec2 = get_ec2_resource(region_name=region)
client = get_ec2_client(region_name=region)

key_name = "ec2-key-pair-joss"
key_path = create_key_pair_if_not_exists(key_name=key_name, region_name=region)
cur_dir = os.getcwd()
key_loc = cur_dir + '\\' + key_path
print("key_loc: ", key_loc)

# adjust dir
if 'capacity' not in cur_dir:
    new_dir = cur_dir + '/capacity'   
    os.chdir(new_dir)

# test param setting
# TODO: change to flags in cmd line
NUM_INSTANCES = 2

# create instances
instances = ec2.create_instances(ImageId='ami-0d382e80be7ffdae5',#'ami-065bb5126e4504910',
                                InstanceType='t2.2xlarge',
                                KeyName=key_name,
                                MinCount=1, 
                                MaxCount=NUM_INSTANCES,
                                Monitoring={
                                    'Enabled': True
                                },
                                SubnetId='subnet-073aafcf763786871',
                                SecurityGroupIds=['sg-015c4ff429e35d1cf'],
                               )

logging.info(instances)
print("Waiting for instances to start...")
time.sleep(5)


instance_ids = []
for i, instance in enumerate(instances):
    instance_id = instance.id
    instance_ids.append(instance_id)
    ip_addresses = get_public_ip(instance_id, region_name=region)
    ip = None if len(ip_addresses) == 0 else ip_addresses[0]
    print(f' -> instance id: {instance_id} at IP: {ip}')
print("")

# (OPTIONAL) check one random instance status

# rand_id = np.random.randint(0, len(test_instances))
# client.describe_instances(
#     InstanceIds=[test_instances[rand_id]])

# (OPTIONAL) start test instances
# only run if we are re-using previous created instances

# response_start = client.start_instances(
#     InstanceIds=test_instances,
#     AdditionalInfo='string'
# )

# logging.info(response_start)

# generate shell script for each test instance
try:
    for i, instance_id in enumerate(instance_ids):
        res = client.describe_instances(InstanceIds=[instance_id])
        ip_addresses = get_public_ip(instance_id, region_name=region)
        ip_address = None if len(ip_addresses) == 0 else ip_addresses[0]
        if ip_address is None:
            logging.error("No IP address found for instance:", instance_id)
            continue
        f = open(f"test{i}.sh", "a")
        with open("run_test.sh", "r") as rt:
            lines = rt.readlines()
            for line in lines:
                ip = 'ip-address'
                key_location = "key-location"
                mask = '[dp-test-access-token]'
                if mask in line:
                    line = line.replace(mask, GIT_ACCESS_TOKEN)
                if ip in line:
                    line = line.replace(ip, ip_address)
                if key_location in line:
                    line = line.replace(key_location, key_loc)
                f.write(line)
        f.close()
except Exception as e:
    logging.error(e) 


# # ------------------------------------ end test -------------------------------------------

# stop instances
# response_stop = client.stop_instances(
#     InstanceIds=instance_ids,
#     Force=True
# )
# logging.info(response_stop)

# # terminate instances
# response_terminate = client.terminate_instances(
#     InstanceIds=instance_ids,
# )
# logging.info(response_terminate)

# # delete shell scripts
# for i in range(len(instance_ids)):
#     os.remove(f"test{i}.sh")


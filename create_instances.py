import configparser
import json
import time
from utils import get_ec2_resource, get_ec2_client, create_key_pair_if_not_exists, get_public_ip, save_instance_ips

config = configparser.ConfigParser()
config.read('config.ini')

# Load parameters
with open("params.json", 'r') as f:
    params = json.loads(f.read())

# ec2 module loading
region = config["AWS"]["REGION"]
ec2 = get_ec2_resource(region_name=region)
client = get_ec2_client(region_name=region)

key_name = config["AWS_EC2"]["KEY_NAME"]
key_path = create_key_pair_if_not_exists(key_name=key_name, region_name=region)

# create instances
num_instances = len(params["room_groups"])
instances = []
for i in range(num_instances):
    room_group = params["room_groups"][i]
    instance = ec2.create_instances(ImageId=config["AWS_EC2"]["AMI"],
                                InstanceType=config["AWS_EC2"]["INSTANCE_TYPE"],
                                KeyName=key_name,
                                MinCount=1, 
                                MaxCount=1,
                                Monitoring={
                                    'Enabled': True
                                },
                                SubnetId=config["AWS_EC2"]["SUBNET_ID"],
                                SecurityGroupIds=[config["AWS_EC2"]["SECURITY_GROUP_ID"]],
                                TagSpecifications=[
                                    {
                                        'ResourceType': 'instance',
                                        'Tags': [
                                            {
                                                'Key': 'Name',
                                                'Value': 'Deliberation-load-test-' + room_group["name"]
                                            },
                                        ]
                                    },
                                ],
                               )
    instances += instance

print("\nWaiting for instances to start...")
time.sleep(5)


instance_ips = {}
for i, instance in enumerate(instances):
    instance_id = instance.id
    ip_addresses = get_public_ip(instance_id, region_name=region)
    ip = None if len(ip_addresses) == 0 else ip_addresses[0]
    print(f' -> instance id: {instance_id} at IP: {ip}')
    instance_ips[instance_id] = ip
print("\n instance_ips: ", instance_ips)
save_instance_ips(instance_ips)
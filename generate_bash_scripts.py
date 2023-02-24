from utils import load_instance_ips, create_key_pair_if_not_exists
import configparser
import os
import json

# load instance IPs
config = configparser.ConfigParser()
config.read('config.ini')
instance_ips = load_instance_ips()
region = config["AWS"]["REGION"]

# Get key location
key_name = config["AWS_EC2"]["KEY_NAME"]
key_path = create_key_pair_if_not_exists(key_name=key_name, region_name=region)
cur_dir = os.getcwd()
key_loc = cur_dir + '/' + key_path
print("key_loc: ", key_loc)

# Load parameters
with open("params.json", 'r') as f:
    params = json.loads(f.read())

# Delete old bash scripts
for i in range(len(instance_ips)):
    if os.path.exists(f"test{i}.sh"):
        os.remove(f"test{i}.sh")

# Create new bash scripts
for i, instance_id in enumerate(instance_ips):
    ip_address = instance_ips[instance_id]
    if ip_address is None:
        print("No IP address found for instance:", instance_id)
        continue
    f = open(f"test{i}.sh", "w")
    with open("run_test.sh", "r") as rt:
        lines = rt.readlines()
        to_replace = [["[IP-ADDRESS]", ip_address],
                        ["[KEY-LOCATION]", key_loc],
                        ["[GITHUB-TOKEN]", config["GITHUB"]["TOKEN"]],
                        ["[GITHUB-USER]", config["GITHUB"]["USER_NAME"]],
                        ["[GITHUB-REPO]", config["GITHUB"]["REPO_NAME"]],
                        ["[NUM-OF-USERS]", str(params["num_users_per_room"] * params["room_groups"][i]["num_rooms"])],
                        ["[ROOM-GROUP-NAME]", params["room_groups"][i]["name"]],
                        ["[NUM-OF-ROOMS]", str(params["room_groups"][i]["num_rooms"])],
                        ["[TEST-DURATION]", str(params["test_duration"])],
                        ["[DELAY-BETWEEN-PARTICIPANTS]", str(params["delay_between_participants"])],
                        ["[DELAY-TO-ENTER-ROOM]", str(params["delay_to_enter_room"])]]
        for line in lines:
            for replace in to_replace:
                if replace[0] in line:
                    line = line.replace(replace[0], replace[1])
            f.write(line)
    f.close()
from utils import load_instance_ips, terminate_instance
import configparser

config = configparser.ConfigParser()
config.read('config.ini')

instance_ips = load_instance_ips()
instance_ids = list(instance_ips.keys())
print("Instance IDs: ", instance_ids)

# terminate instances
print("\nTerminating instances...")
for instance_id in instance_ids:
    terminate_instance(instance_id, region_name=config["AWS"]["REGION"])
print("DONE! (Terminating instances)")